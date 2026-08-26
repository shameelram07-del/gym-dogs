'use client';
import { useState, useEffect, useCallback } from 'react';
import { todayISO } from '@/lib/day';
import { exerciseLibrary, muscleGroups } from '@/lib/exercises';
import {
  countForMinutes, suggestName, runNoteFor, stripRunNote,
  catalogueFor, buildFromSelection, fillToCount,
} from '@/lib/session';
import { captureError } from '@/lib/monitoring';

const PLANS_API_URL = 'https://gymdogs-api-g9d0gve4angygdcj.newzealandnorth-01.azurewebsites.net/api/workoutPlans';
const PLANS_API_KEY = process.env.NEXT_PUBLIC_PLANS_API_KEY;
const AI_COACH_URL = 'https://gymdogs-api-g9d0gve4angygdcj.newzealandnorth-01.azurewebsites.net/api/aiCoach';
const AI_COACH_KEY = process.env.NEXT_PUBLIC_AI_COACH_KEY;
const COMMUNITY_URL = 'https://gymdogs-api-g9d0gve4angygdcj.newzealandnorth-01.azurewebsites.net/api/communityPosts';
const CLIENTS_KEY = process.env.NEXT_PUBLIC_API_KEY;

export const emptyExercise = () => ({ muscleGroup: 'CHEST', name: '', equipment: '', sets: 3, reps: '10-12', cue: '' });

// The session tag is the STYLE, not the shape — what the groups are is the
// coach's job and he picks that above the button. FULL BODY used to be in this
// list and was a leftover from before that change: it is a shape, it already
// exists as a day preset, and picking Target = Push with Style = Full body told
// the model "chest, shoulders, triceps only" and "balanced across the whole
// session" in the same prompt.
export const STYLES = ['STRENGTH', 'HYPERTROPHY', 'CARDIO', 'DELOAD'];

const STYLE_BRIEF = {
  STRENGTH:    'heavier compound movements, lower reps (4-8), longer rests between sets.',
  HYPERTROPHY: 'mid reps (8-15), a bit more volume, a mix of machines and free weights.',
  CARDIO:      'conditioning is the point — keep any resistance work light and the reps high.',
  DELOAD:      'lighter than usual. Fewer sets, comfortable reps, nothing taken near failure.',
};

const templateSession = (groups, count, people) => {
  const built = buildFromSelection(groups, count, people);
  return built.length ? built : [emptyExercise()];
};

/**
 * The title, as the model actually returns it.
 *
 * It comes back wrapped in quotes often enough that the field would otherwise
 * read “Iron Harvest”, quote marks and all, and a model that decides to write a
 * sentence must not land a sentence in a heading — anything long is discarded
 * and `suggestName` takes over.
 */
function cleanTitle(raw) {
  if (typeof raw !== 'string') return '';
  const t = raw
    .replace(/["“”‘’]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.]+$/, '');
  return t.length > 0 && t.length <= 40 ? t : '';
}

/**
 * The reply, in either shape it arrives in.
 *
 * The prompt now asks for {"title":…,"exercises":[…]}, but a bare array is still
 * accepted — the model drops back to the old shape often enough that treating
 * one as a failure would silently swap a real AI session for a template.
 */
function parseAiReply(text) {
  if (!text) return { title: '', items: [] };
  const obj = text.match(/\{[\s\S]*\}/);
  if (obj) {
    try {
      const d = JSON.parse(obj[0]);
      if (d && Array.isArray(d.exercises)) return { title: cleanTitle(d.title), items: d.exercises };
    } catch { /* not the object shape — try the array below */ }
  }
  const arr = text.match(/\[[\s\S]*\]/);
  if (arr) {
    try {
      const d = JSON.parse(arr[0]);
      if (Array.isArray(d)) return { title: '', items: d };
    } catch { /* nothing usable in there */ }
  }
  return { title: '', items: [] };
}

function findExercise(name) {
  const target = String(name).toLowerCase().trim();
  for (const group of muscleGroups) {
    const found = exerciseLibrary[group]?.find((e) => e.name.toLowerCase() === target);
    if (found) return { muscleGroup: group, name: found.name, equipment: found.equipment, sets: found.defaultSets, reps: found.defaultReps, cue: found.cue };
  }
  return null;
}

/**
 * Everything the session builder knows, held OUTSIDE the builder component.
 *
 * This is deliberate and it is the one regression this rebuild had to avoid.
 * The old screen kept all three tabs in a single component, so switching to
 * Challenges and back preserved a half-built session by accident. Rendering
 * `{view === 'session' && <SessionBuilder/>}` over local state would unmount
 * the builder and silently destroy unpublished work — a worse screen than the
 * one we started with. Called from page.js, which never unmounts, so the state
 * outlives any tab switch.
 */
export function useSessionBuilder({ userId, clients }) {
  // ── the brief (inputs to the generator) ──
  const [targetGroups, setTargetGroups] = useState([]);
  const [planTag, setPlanTag] = useState('STRENGTH');
  const [minutes, setMinutes] = useState(60);
  const [people, setPeople] = useState(1);
  // null means "follow the minutes"; a number means the coach overrode it.
  const [countOverride, setCountOverride] = useState(null);
  const [briefOpen, setBriefOpen] = useState(true);

  // ── the session (the result) ──
  // Starts EMPTY, not with one blank row. An empty list is what lets the
  // session and publish sections not render at all before you have generated
  // anything, which is the whole reason the screen is now short.
  const [exercises, setExercises] = useState([]);
  const [runNote, setRunNote] = useState('');
  const [openRow, setOpenRow] = useState(null);   // one expanded at a time
  const [swapFor, setSwapFor] = useState(null);   // index being swapped, or null
  // Which rows have been touched by hand. Regenerate replaces all of them, so
  // it has to be able to say what it is about to throw away.
  const [editedRows, setEditedRows] = useState([]);

  // ── publishing (facts about a finished session) ──
  const [planName, setPlanName] = useState('');
  // Tracked rather than diffed against the suggestion: if he types a name, an
  // auto-suggestion must never overwrite it, and comparing strings would fail
  // the moment he happened to type what we would have suggested anyway.
  const [nameTouched, setNameTouched] = useState(false);
  const [dateMode, setDateMode] = useState('today');
  const [sessionDate, setSessionDate] = useState(todayISO());
  const [assignedTo, setAssignedTo] = useState([]);   // empty = everyone
  const [notes, setNotes] = useState('');

  // ── server + status ──
  const [activePlan, setActivePlan] = useState(null);
  const [drafts, setDrafts] = useState([]);
  const [draftId, setDraftId] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);

  const exCount = countOverride ?? countForMinutes(minutes);
  const canGenerate = targetGroups.length > 0;
  const hasSession = exercises.length > 0;

  const fetchActivePlan = useCallback(async () => {
    try {
      const res = await fetch(PLANS_API_URL, { headers: { 'x-functions-key': PLANS_API_KEY } });
      if (res.ok) setActivePlan(await res.json());
    } catch (e) {
      captureError(e, { screen: 'coach', action: 'load-active-plan', endpoint: 'workoutPlans' });
    }
  }, []);

  const fetchDrafts = useCallback(async () => {
    try {
      const res = await fetch(`${PLANS_API_URL}?drafts=true`, { headers: { 'x-functions-key': PLANS_API_KEY } });
      if (res.ok) { const d = await res.json(); setDrafts(Array.isArray(d) ? d : []); }
    } catch (e) {
      captureError(e, { screen: 'coach', action: 'load-drafts', endpoint: 'workoutPlans' });
    }
  }, []);

  useEffect(() => {
    if (!userId) return;
    fetchActivePlan();
    fetchDrafts();
  }, [userId, fetchActivePlan, fetchDrafts]);

  // ── editing the session ──

  const markEdited = (idx) => setEditedRows((prev) => (prev.includes(idx) ? prev : [...prev, idx]));

  const updateExercise = (idx, field, value) => {
    setExercises((prev) => { const u = [...prev]; u[idx] = { ...u[idx], [field]: value }; return u; });
    markEdited(idx);
  };

  /** Swap keeps the row's position and block letter — only the movement changes. */
  const swapExercise = (idx, lib) => {
    setExercises((prev) => {
      const u = [...prev];
      u[idx] = { ...u[idx], name: lib.name, equipment: lib.equipment, sets: lib.defaultSets, reps: lib.defaultReps, cue: lib.cue };
      return u;
    });
    markEdited(idx);
    setSwapFor(null);
  };

  const addExercise = () => {
    setExercises((prev) => [...prev, emptyExercise()]);
    setOpenRow(exercises.length);   // open the new blank row, it needs filling in
  };

  const removeExercise = (idx) => {
    setExercises((prev) => prev.filter((_, i) => i !== idx));
    setOpenRow(null);
    setEditedRows((prev) => prev.filter((i) => i !== idx).map((i) => (i > idx ? i - 1 : i)));
  };

  /** The hand-build path, so the generator is not the only way in. */
  const startByHand = () => {
    setExercises([emptyExercise()]);
    setRunNote('');
    setEditedRows([]);
    setOpenRow(0);
    setBriefOpen(false);
    if (!nameTouched && targetGroups.length) setPlanName(suggestName(targetGroups));
  };

  const toggleGroup = (mg) => setTargetGroups((prev) => (
    prev.includes(mg) ? prev.filter((g) => g !== mg) : [...prev, mg]
  ));

  // ── generate ──

  const generatePlan = async () => {
    if (!canGenerate) return;
    setGenerating(true); setSaveMsg(null);
    // Read once — these must not shift under the await.
    const groups = targetGroups;
    const count = exCount;
    const heads = Math.max(1, Number(people) || 1);
    const mins = Math.max(10, Number(minutes) || 60);
    try {
      const prompt = [
        `You are a strength coach. Design one ${planTag} gym session lasting about ${mins} minutes.`,
        `Return EXACTLY ${count} exercises. Not ${count - 1}, not ${count + 1} — exactly ${count}. Count them before you reply.`,
        `Train ONLY these muscle groups: ${groups.join(', ')}. Spread the exercises across them roughly evenly.`,
        'Order the session compounds first, isolation last.',
        `Style: ${STYLE_BRIEF[planTag] || STYLE_BRIEF.STRENGTH}`,
        `Fit it into ${mins} minutes. On a short session pull the SETS back rather than only cutting exercises.`,
        '',
        heads >= 2
          ? `${heads} people are training together, so build this as PAIRED BLOCKS. Give every exercise a "block" letter and share each letter between exactly two exercises — "A","A","B","B" and so on — so one person works the first while the other works the second, then they swap.`
          : 'One person is training, so set "block" to null on every exercise and just return a straight list.',
        ...(heads >= 2 ? [
          'Rules for every block, all of which matter:',
          '- The two exercises must NEVER need the same station. The [square brackets] in the catalogue give the equipment: never pair Plate Loaded with Plate Loaded, Cable with Cable, or Pin Loaded with Pin Loaded.',
          '- Pair a big compound with something lighter — a leg press with a cable abduction, not two heavy squats back to back.',
          '- Prefer pairing across different muscle groups from the selection, so neither person works the same muscle twice in a row.',
          heads % 2 === 1
            ? '- There is an odd number of people, so the last block may be a single exercise that three of them rotate through.'
            : null,
        ].filter(Boolean) : []),
        '',
        'Choose ONLY exercises from this catalogue, copying the names exactly.',
        '',
        'Also NAME the session. Short and punchy — 2 to 4 words, title case, no quotes and no emoji.',
        'Something a coach would chalk on the board: "Iron Harvest", "Steel Rain", "The Long Pull". Not "Pull Day".',
        'Reply with ONLY a JSON object, no prose, in the form {"title":"Iron Harvest","exercises":[{"name":"exact name","sets":3,"reps":"10-12","block":"A"}]}.',
        `Catalogue:\n${catalogueFor(groups)}`,
      ].filter((l) => l !== null && l !== undefined).join('\n');

      let text = '';
      let capped = false;
      try {
        const res = await fetch(AI_COACH_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-functions-key': AI_COACH_KEY },
          body: JSON.stringify({ message: prompt, prompt, userId }),
        });
        if (res.ok) { const d = await res.json(); text = d.reply || d.message || (typeof d === 'string' ? d : ''); }
        else if (res.status === 429) capped = true;   // the AI budget, not a fault
        else captureError(new Error(`aiCoach failed (${res.status})`), {
          screen: 'coach', action: 'generate-plan', endpoint: 'aiCoach', status: res.status,
        });
      } catch (e) {
        captureError(e, { screen: 'coach', action: 'generate-plan', endpoint: 'aiCoach' });
      }

      let parsed = [];
      const { title: aiTitle, items } = parseAiReply(text);
      if (items.length) {
        try {
          const chosen = new Set(groups);
          const seen = new Set();
          parsed = items.map((item) => {
            const lib = findExercise(item && item.name);
            // A name that isn't in the library, is a repeat, or belongs to a
            // group he didn't ask for is dropped rather than shown.
            if (!lib || !chosen.has(lib.muscleGroup) || seen.has(lib.name)) return null;
            seen.add(lib.name);
            // Never trust the model's types. gpt-5 returns "sets":"4" as a
            // string, and reps has come back as a bare number.
            const sets = Math.round(Number(item.sets));
            const reps = typeof item.reps === 'number' && Number.isFinite(item.reps)
              ? String(item.reps)
              : typeof item.reps === 'string' ? item.reps.trim() : '';
            return {
              ...lib,
              sets: Number.isFinite(sets) && sets > 0 ? sets : lib.sets,
              reps: reps || lib.reps,
              block: item.block ? String(item.block).toUpperCase() : null,
            };
          }).filter(Boolean).slice(0, count);
        } catch (e) {
          captureError(e, { screen: 'coach', action: 'parse-ai-plan' });
        }
      }

      const usedAI = parsed.length >= 3;
      // The pairing rule is verified here, not trusted.
      const built = usedAI ? fillToCount(parsed, groups, count, heads) : templateSession(groups, count, heads);
      // A template session is not the one the model named, so it gets the
      // target-derived name rather than a title describing exercises it doesn't have.
      applyGenerated(built, heads, groups, usedAI ? aiTitle : '');
      setSaveMsg({
        type: 'success',
        text: usedAI
          ? 'Session ready — read it through, then publish.'
          : capped
            ? 'AI is done for today, so this is a template draft — read it through, then publish.'
            : 'Built from template — read it through, then publish.',
      });
    } catch (e) {
      applyGenerated(templateSession(groups, count, Math.max(1, Number(people) || 1)), Math.max(1, Number(people) || 1), groups);
      setSaveMsg({ type: 'success', text: 'Built from template — read it through, then publish.' });
      captureError(e, { screen: 'coach', action: 'generate-plan', tag: planTag });
    } finally {
      setGenerating(false);
    }
  };

  /** Shared by generate and regenerate: install a fresh session and collapse the brief. */
  function applyGenerated(built, heads, groups, aiTitle = '') {
    setExercises(built);
    setRunNote(runNoteFor(heads, built));
    setEditedRows([]);          // a fresh session has no hand edits
    setOpenRow(null);
    setBriefOpen(false);        // the screen never shows a full brief AND a full session
    // Gym Daddy's title if there is one, the target-derived name if not — and
    // either way it only ever loses to a name he typed himself.
    if (!nameTouched) setPlanName(aiTitle || suggestName(groups));
  }

  /**
   * Regenerate, warning first if there is anything to lose.
   * An untouched session is replaced without a prompt — there is nothing at risk.
   */
  const regenerate = () => {
    if (editedRows.length > 0) {
      const names = editedRows
        .map((i) => exercises[i] && exercises[i].name)
        .filter(Boolean);
      const what = names.length ? names.join(', ') : `${editedRows.length} row${editedRows.length === 1 ? '' : 's'}`;
      if (!window.confirm(`Regenerating replaces all ${exercises.length} exercises, including your changes to ${what}.\n\nCarry on?`)) return;
    }
    generatePlan();
  };

  // ── drafts ──

  const editDraft = (d) => {
    setPlanName(d.name || '');
    setNameTouched(Boolean(d.name));       // a saved name is his, not a suggestion
    setPlanTag(STYLES.includes(d.tag) ? d.tag : 'STRENGTH');
    setSessionDate(d.date || todayISO());
    setDateMode(d.date && d.date !== todayISO() ? 'pick' : 'today');
    setNotes(d.notes || '');
    // The draft's own notes already carry any run note it was saved with, so
    // holding a second copy here would publish it twice.
    setRunNote('');
    setAssignedTo(Array.isArray(d.assignedTo) ? d.assignedTo : []);
    setExercises(d.exercises && d.exercises.length ? d.exercises : [emptyExercise()]);
    setEditedRows([]);
    setOpenRow(null);
    // You opened a draft to change its exercises, not to re-brief the
    // generator, so the brief stays collapsed and the session is what you land on.
    setBriefOpen(false);
    setDraftId(d.id);
    setSaveMsg({ type: 'success', text: `Editing draft: ${d.name || 'Untitled'}` });
    setTimeout(() => document.getElementById('gd-session')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  };

  const deleteDraft = async (d) => {
    // Remember where it was, so a failed archive can put it back rather than
    // leaving it deleted on screen and alive on the server.
    const index = drafts.findIndex((x) => x.id === d.id);
    const wasEditing = draftId === d.id;
    setDrafts((prev) => prev.filter((x) => x.id !== d.id));
    if (wasEditing) setDraftId(null);
    try {
      const res = await fetch(PLANS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-functions-key': PLANS_API_KEY },
        body: JSON.stringify({ ...d, archived: true, isActive: false }),
      });
      // fetch only rejects on a network error, so a 500 sailed through here and
      // the draft looked deleted until it reappeared on the next load.
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
    } catch (e) {
      setDrafts((prev) => {
        if (prev.some((x) => x.id === d.id)) return prev;
        const restored = [...prev];
        restored.splice(index < 0 ? restored.length : index, 0, d);
        return restored;
      });
      if (wasEditing) setDraftId(d.id);
      setSaveMsg({ type: 'error', text: 'Could not delete that draft. Try again.' });
      captureError(e, { screen: 'coach', action: 'delete-draft', endpoint: 'workoutPlans' });
    }
  };

  // ── publish ──

  /** Who the session is for, in words. Used by the confirm and the feed post. */
  const audienceLabel = () => (
    assignedTo.length === 0
      ? 'the whole pack'
      : assignedTo
          .map((uid) => clients.find((c) => c.userId === uid)?.name?.split(' ')[0])
          .filter(Boolean).join(', ') || 'the selected members'
  );

  const handlePublish = async (isActive) => {
    if (!planName.trim()) { setSaveMsg({ type: 'error', text: 'Give the session a name.' }); return; }
    if (exercises.some((e) => !e.name.trim())) { setSaveMsg({ type: 'error', text: 'Every row needs an exercise chosen.' }); return; }

    // Publishing is immediate and public: it goes live for every member and
    // posts to the feed. Ending a challenge already confirms and is the less
    // risky action, so the riskier button was the unguarded one.
    if (isActive) {
      const ok = window.confirm(
        `Publish "${planName.trim()}" to ${audienceLabel()}?\n\n` +
        'It becomes the active session immediately and is announced on the community feed.'
      );
      if (!ok) return;
    }

    setSaving(true); setSaveMsg(null);
    try {
      const cleanExercises = exercises.map(({ equipFilter, ...e }) => e);
      // How the session runs goes out with it, above whatever safety notes were
      // typed. stripRunNote clears an older one first so a draft that gets
      // regenerated twice doesn't collect a line each time.
      const fullNotes = [runNote, stripRunNote(notes)].filter(Boolean).join('\n\n');
      // Never cached at module scope — computed here so a phone left open
      // overnight publishes for the real today, not yesterday.
      const date = dateMode === 'today' ? todayISO() : sessionDate;
      const plan = {
        id: draftId || Date.now().toString(),
        name: planName, tag: planTag, date, notes: fullNotes,
        exercises: cleanExercises, isActive, assignedTo,
        createdAt: new Date().toISOString(),
      };
      const res = await fetch(PLANS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-functions-key': PLANS_API_KEY },
        body: JSON.stringify(plan),
      });
      if (!res.ok) {
        setSaveMsg({ type: 'error', text: 'Failed to save. Try again.' });
        captureError(new Error(`Publish failed (${res.status})`), {
          screen: 'coach', action: isActive ? 'publish' : 'save-draft', endpoint: 'workoutPlans', status: res.status,
        });
        return;
      }

      setSaveMsg({ type: 'success', text: isActive ? 'Session published and set as active.' : 'Session saved as draft.' });
      fetchDrafts();
      if (!isActive) { setDraftId(plan.id); return; }

      setActivePlan(plan);
      reset();

      // Announce it on the community feed.
      try {
        await fetch(COMMUNITY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-functions-key': CLIENTS_KEY || '' },
          body: JSON.stringify({
            userId,
            name: 'Coach Shameel',
            initials: 'CS',
            text: `📋 New session published: ${plan.name} (${plan.exercises.length} exercises) — assigned to ${audienceLabel()}. Get after it.`,
            tag: '📋 New session',
          }),
        });
      } catch (e) {
        // The session published fine; only the announcement failed.
        captureError(e, { screen: 'coach', action: 'announce-session', endpoint: 'communityPosts' });
      }
    } catch (e) {
      setSaveMsg({ type: 'error', text: 'Failed to save. Try again.' });
      captureError(e, { screen: 'coach', action: isActive ? 'publish' : 'save-draft', endpoint: 'workoutPlans' });
    } finally { setSaving(false); }
  };

  /** Back to an empty screen after publishing. */
  function reset() {
    setDraftId(null);
    setExercises([]);
    setRunNote('');
    setEditedRows([]);
    setOpenRow(null);
    setPlanName('');
    setNameTouched(false);
    setDateMode('today');
    setSessionDate(todayISO());
    setNotes('');
    setAssignedTo([]);
    setBriefOpen(true);
  }

  return {
    // brief
    targetGroups, toggleGroup, setTargetGroups, planTag, setPlanTag,
    minutes, setMinutes, people, setPeople, exCount, countOverride, setCountOverride,
    briefOpen, setBriefOpen, canGenerate,
    // session
    exercises, hasSession, runNote, openRow, setOpenRow, swapFor, setSwapFor,
    editedRows, updateExercise, swapExercise, addExercise, removeExercise, startByHand,
    generating, generatePlan, regenerate,
    // publish
    planName, setPlanName, nameTouched, setNameTouched,
    dateMode, setDateMode, sessionDate, setSessionDate,
    assignedTo, setAssignedTo, notes, setNotes, audienceLabel,
    saving, saveMsg, handlePublish,
    // server
    activePlan, drafts, draftId, editDraft, deleteDraft,
  };
}

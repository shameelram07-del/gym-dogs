'use client';
import { todayISO, toLocalISO, onDayChange } from '@/lib/day';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useMsal } from '@azure/msal-react';
import BottomNav from '@/components/BottomNav';
import Reveal from '@/components/Reveal';
import { randomQuote } from '@/lib/quotes';
import { exerciseLibrary, muscleGroups } from '@/lib/exercises';
import { captureError, breadcrumb } from '@/lib/monitoring';

const API_URL = 'https://gymdogs-api-g9d0gve4angygdcj.newzealandnorth-01.azurewebsites.net/api/gymLogs';
const API_KEY = process.env.NEXT_PUBLIC_API_KEY;
const PLANS_API_URL = 'https://gymdogs-api-g9d0gve4angygdcj.newzealandnorth-01.azurewebsites.net/api/workoutPlans';
const PLANS_API_KEY = process.env.NEXT_PUBLIC_PLANS_API_KEY;
const AI_COACH_URL = 'https://gymdogs-api-g9d0gve4angygdcj.newzealandnorth-01.azurewebsites.net/api/aiCoach';
const AI_COACH_KEY = process.env.NEXT_PUBLIC_AI_COACH_KEY;
const PROFILES_URL = 'https://gymdogs-api-g9d0gve4angygdcj.newzealandnorth-01.azurewebsites.net/api/userProfiles';
const PROFILES_KEY = process.env.NEXT_PUBLIC_PROFILES_API_KEY;

const COACH_ID = '6d765ac9-47b2-4d3f-b36a-9d784015b917';

const eyebrow = { fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', color: 'var(--ink-3)', textTransform: 'uppercase', margin: 0 };
const CARD_R = 26;

// Localhost-only preview data so the screen can be reviewed without sign-in.
// On the live site this never triggers (hostname is not "localhost").
const IS_LOCAL = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const DEMO_PLAN = {
  id: 'demo', name: 'Chest & Shoulders',
  exercises: [
    { name: 'Incline DB Press', sets: 3, reps: '8-10', cue: 'Keep elbows around 45 degrees and control the descent.' },
    { name: 'Cable Lateral Raise', sets: 3, reps: '15', cue: 'Lead with the elbows and pause at the top.' },
    { name: 'Machine Chest Press', sets: 3, reps: '12' },
  ],
};

function toSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function ExercisePhoto({ name, size = 80 }) {
  const [error, setError] = useState(false);
  const slug = toSlug(name);
  if (error) {
    return (
      <div style={{
        width: size, height: size, borderRadius: 14, flexShrink: 0,
        background: 'var(--soft)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.4,
      }}>💪</div>
    );
  }
  return (
    <div style={{ width: size, height: size, borderRadius: 14, flexShrink: 0, overflow: 'hidden', border: '1px solid var(--line)', background: 'var(--soft)' }}>
      <img src={`/images/exercises/${slug}.jpg`} alt={name} onError={() => setError(true)}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </div>
  );
}

// Count-up number for the celebration screen — mockup port.
function CountNum({ value, decimals = 0, suffix = '' }) {
  const [display, setDisplay] = useState(0);
  const raf = useRef(null);
  useEffect(() => {
    const target = typeof value === 'number' ? value : parseFloat(value) || 0;
    const t0 = performance.now();
    const ms = 1200;
    cancelAnimationFrame(raf.current);
    const step = (t) => {
      const p = Math.min((t - t0) / ms, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(target * eased);
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [value]);
  return <>{display.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}{suffix}</>;
}

function DurationTimer() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(i);
  }, []);
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return <span>{m}:{s}</span>;
}

function RestTimer({ onDone, trigger }) {
  const [seconds, setSeconds] = useState(90);
  const [running, setRunning] = useState(false);
  const ref = useRef(null);

  // Auto-start (or restart) the timer whenever a set is marked done.
  useEffect(() => {
    if (!trigger) return;
    setSeconds(90);
    setRunning(true);
  }, [trigger]);

  useEffect(() => {
    if (running && seconds > 0) {
      ref.current = setInterval(() => setSeconds(s => {
        if (s <= 1) { clearInterval(ref.current); setRunning(false); onDone?.(); return 0; }
        return s - 1;
      }), 1000);
    }
    return () => clearInterval(ref.current);
  }, [running]);

  const pct = (seconds / 90) * 100;
  const circ = 2 * Math.PI * 22;
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ position: 'relative', width: 46, height: 46 }}>
        <svg width="46" height="46" viewBox="0 0 48 48">
          <circle cx="24" cy="24" r="22" fill="none" stroke="var(--soft)" strokeWidth="4" />
          <circle cx="24" cy="24" r="22" fill="none" stroke="var(--blue)" strokeWidth="4"
            strokeDasharray={`${circ * pct / 100} ${circ}`}
            strokeLinecap="round" transform="rotate(-90 24 24)" />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>⏱</div>
      </div>
      <div>
        <p style={{ margin: 0, fontSize: 18, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: 'var(--ink)' }}>{m}:{s}</p>
        <p style={{ margin: 0, fontSize: 9, color: 'var(--ink-3)', letterSpacing: '0.06em', fontWeight: 600 }}>REST</p>
      </div>
      <button onClick={() => { setRunning(r => !r); }} style={{
        width: 32, height: 32, borderRadius: '50%', background: 'var(--soft)',
        border: '1px solid var(--line)', color: 'var(--ink)', fontSize: 13,
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {running ? '⏸' : '▶'}
      </button>
      <button onClick={() => setSeconds(90)} style={{
        width: 32, height: 32, borderRadius: '50%', background: 'var(--soft)',
        border: '1px solid var(--line)', color: 'var(--ink-3)', fontSize: 12,
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>↺</button>
    </div>
  );
}

export default function WorkoutPage() {
  const router = useRouter();
  const { accounts, inProgress } = useMsal();
  const [userId, setUserId] = useState(null);
  const [userName, setUserName] = useState('');
  const [activePlan, setActivePlan] = useState(null);
  const [exercises, setExercises] = useState([]); // live, editable session list (starts = published plan)
  const [picker, setPicker] = useState(null);     // null | { mode: 'add' } | { mode: 'swap', idx }
  const [pickerGroup, setPickerGroup] = useState('CHEST');
  const [planLoading, setPlanLoading] = useState(true);
  const [planError, setPlanError] = useState(null);
  const [logs, setLogs] = useState({});
  const [lastSession, setLastSession] = useState({});
  const [activeExIdx, setActiveExIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const [coachNote, setCoachNote] = useState(null);
  const [coachNoteLoading, setCoachNoteLoading] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [finishQuote, setFinishQuote] = useState('');
  const [shared, setShared] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [prs, setPrs] = useState([]); // [{name, kg, prevKg}]
  const startRef = useRef(Date.now());
  const activeCardRef = useRef(null);
  const saveTimer = useRef(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState(''); // '' | 'saving' | 'saved' | 'unsaved'
  const [restTrigger, setRestTrigger] = useState(0); // bump to auto-start rest timer
  const [toast, setToast] = useState('');
  const toastRef = useRef(null);

  // Held in state, never cached at module scope: a phone left open overnight
  // would otherwise keep saving sets under yesterday's date. On rollover the
  // existing activePlan.date guards below correctly stop saving to the old day.
  const [TODAY, setTODAY] = useState(todayISO());

  useEffect(() => onDayChange(TODAY, setTODAY), [TODAY]);

  const showToast = (msg) => {
    setToast(msg);
    clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(''), 2400);
  };

  useEffect(() => {
    if (inProgress !== 'none') return;
    if (accounts.length === 0) {
      if (IS_LOCAL) { setUserId('demo'); setUserName('Shameel'); return; }
      router.push('/login');
      return;
    }
    const user = accounts[0];
    setUserId(user.localAccountId);
    const isGuid = (s) => !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim());
    const name = user.name && user.name !== 'unknown' && !isGuid(user.name)
      ? user.name.split(' ')[0]
      : user.username?.split('@')[0] || 'Athlete';
    setUserName(name);
  }, [accounts, inProgress, router]);

  // Prefer the saved profile display name (e.g. "Gym Daddy") over the raw login
  // name, so shared posts and coach notes use the nickname like the other screens.
  useEffect(() => {
    if (!userId || userId === 'demo') return;
    (async () => {
      try {
        const res = await fetch(`${PROFILES_URL}?userId=${userId}`, { headers: { 'x-functions-key': PROFILES_KEY || '' } });
        if (res.ok) {
          const data = await res.json();
          const p = Array.isArray(data) ? data.find(x => x.userId === userId) : data;
          const isGuid = (s) => !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s).trim());
          if (p && p.name && !isGuid(p.name)) setUserName(p.name);
        }
      } catch (e) {
        captureError(e, { screen: 'workout', action: 'load-display-name', endpoint: 'userProfiles' });
      }
    })();
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    if (userId === 'demo') {
      setActivePlan(DEMO_PLAN);
      setExercises(DEMO_PLAN.exercises);
      const emptyLogs = {};
      DEMO_PLAN.exercises.forEach((ex, idx) => {
        emptyLogs[idx] = Array(ex.sets).fill(null).map(() => ({ kg: '', reps: '', done: false }));
      });
      setLogs(emptyLogs);
      setPlanLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`${PLANS_API_URL}?userId=${userId}`, { headers: { 'x-functions-key': PLANS_API_KEY } });
        if (res.ok) {
          const data = await res.json();
          setActivePlan(data);
          const emptyLogs = {};
          (data.exercises || []).forEach((ex, idx) => {
            emptyLogs[idx] = Array(ex.sets).fill(null).map(() => ({ kg: '', reps: '', done: false }));
          });
          // Restore an in-progress session for this plan/day if one was saved,
          // so leaving the screen without hitting Finish no longer loses progress.
          let restored = null;
          try {
            const raw = localStorage.getItem('gd-workout-progress');
            if (raw) {
              const s = JSON.parse(raw);
              if (s && s.planId === data.id && s.date === TODAY && Array.isArray(s.exercises) && s.logs) restored = s;
            }
          } catch (e) {
            // We wrote this blob ourselves — if it won't parse, an in-progress
            // session was just silently thrown away.
            captureError(e, { screen: 'workout', action: 'restore-progress' });
          }
          if (restored) {
            setExercises(restored.exercises);
            setLogs(restored.logs);
            if (typeof restored.activeExIdx === 'number') setActiveExIdx(restored.activeExIdx);
            if (restored.startedAt) startRef.current = restored.startedAt;
            showToast('↩ Restored your in-progress session');
          } else {
            setExercises(Array.isArray(data.exercises) ? data.exercises : []);
            setLogs(emptyLogs);
          }
        } else {
          // Not an error: the coach simply hasn't published one.
          setPlanError('No active session found.');
        }
      } catch (e) {
        setPlanError('Could not load session.');
        captureError(e, { screen: 'workout', action: 'load-plan', endpoint: 'workoutPlans' });
      }
      finally { setPlanLoading(false); }
    })();
  }, [userId]);

  useEffect(() => {
    if (!userId || !activePlan || userId === 'demo') return;
    (async () => {
      const results = {};
      await Promise.all(activePlan.exercises.map(async (ex, idx) => {
        try {
          const res = await fetch(`${API_URL}?userId=${userId}&exName=${encodeURIComponent(ex.name)}&session=last`,
            { headers: { 'x-functions-key': API_KEY } });
          if (res.ok) {
            const data = await res.json();
            if (data.length > 0) results[idx] = JSON.parse(data[0].sets_data || '[]');
          }
        } catch (e) {
          // Losing this loses the progressive-overload pre-fill, which reads as
          // "the app forgot what I lifted last week".
          captureError(e, { screen: 'workout', action: 'last-session', endpoint: 'gymLogs' });
        }
      }));
      setLastSession(results);

      // Progressive overload: pre-fill each set's kg with last session's weight
      // so logging starts from where you left off (reps left blank on purpose).
      setLogs(prev => {
        const next = { ...prev };
        Object.entries(results).forEach(([idx, lastSets]) => {
          if (!next[idx] || !Array.isArray(lastSets)) return;
          next[idx] = next[idx].map((s, i) => {
            if (s.kg) return s;
            const src = lastSets[i] || lastSets[lastSets.length - 1];
            return src && src.kg ? { ...s, kg: String(src.kg) } : s;
          });
        });
        return next;
      });
    })();
  }, [userId, activePlan]);

  // Auto-save the live session on every change so navigating away, refreshing,
  // or the app closing never loses logged progress. Cleared once Finish saves.
  useEffect(() => {
    if (!activePlan || userId === 'demo' || planLoading || showComplete) return;
    try {
      localStorage.setItem('gd-workout-progress', JSON.stringify({
        planId: activePlan.id, date: TODAY, exercises, logs, activeExIdx, startedAt: startRef.current,
      }));
    } catch (e) {
      // Not cosmetic: this is the crash-recovery copy of the live session.
      captureError(e, { screen: 'workout', action: 'autosave-local' });
    }
  }, [logs, exercises, activeExIdx, activePlan, planLoading, showComplete, userId, TODAY]);

  // Push a single exercise's sets to the server (upsert — safe to call repeatedly).
  const postLog = (idx, ex, rows) => {
    if (!activePlan || userId === 'demo' || !ex?.name) return Promise.resolve();
    return fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-functions-key': API_KEY },
      body: JSON.stringify({ userId, planId: activePlan.id, planName: activePlan.name, date: TODAY, exIdx: idx, exName: ex.name, sets_data: JSON.stringify(rows || []) }),
    })
      .then(res => { if (!res.ok) throw new Error(`autosave failed (${res.status})`); })
      .catch((e) => {
        // Keep the real cause — the caller only needs to know it failed, but a
        // report saying "autosave failed" and nothing else is unanswerable.
        captureError(e, { screen: 'workout', action: 'autosave-set', endpoint: 'gymLogs', exIdx: idx });
        throw new Error('autosave failed');
      });
  };

  // Live auto-save: ~1.2s after you stop changing anything, upsert every exercise
  // that has data to the server. No "Finish" needed to keep progress.
  useEffect(() => {
    if (!activePlan || userId === 'demo' || planLoading || showComplete) return;
    if (activePlan.date && activePlan.date !== TODAY) return; // don't save a previous day's session under today
    // A set only counts as "logged" if reps were entered or it was ticked done —
    // pre-filled weights (progressive overload) alone must NOT create a session.
    const isLogged = (s) => (s.reps && String(s.reps).trim()) || s.done;
    const hasData = exercises.some((_, i) => (logs[i] || []).some(isLogged));
    if (!hasData) return;
    setAutoSaveStatus('saving');
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await Promise.all(exercises.map((ex, idx) => {
          const rows = logs[idx] || [];
          return rows.some(isLogged) ? postLog(idx, ex, rows) : null;
        }).filter(Boolean));
        setAutoSaveStatus('saved');
      } catch (e) {
        // Don't show "saved" over a write that never landed. Finish still
        // retries every exercise, so the session isn't lost.
        // Deliberately not captured here — postLog already reported the real
        // cause, and this would only add a second event saying "it failed".
        setAutoSaveStatus('unsaved');
      }
    }, 1200);
    return () => clearTimeout(saveTimer.current);
  }, [logs, exercises, activePlan, planLoading, showComplete, userId, TODAY]);

  // Bring the expanded exercise into view when it changes (tap or auto-advance),
  // so "opening" an exercise happens where you can see it.
  useEffect(() => {
    if (planLoading || !exercises.length) return;
    activeCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [activeExIdx, planLoading]);

  const updateSet = (exIdx, setIdx, field, value) => {
    setLogs(prev => {
      const updated = [...prev[exIdx]];
      updated[setIdx] = { ...updated[setIdx], [field]: value };
      return { ...prev, [exIdx]: updated };
    });
  };

  const toggleDone = (exIdx, setIdx) => {
    // Compute the next state first so side effects (timer, toast, advance)
    // run exactly once, outside the React updater.
    const updated = [...(logs[exIdx] || [])];
    if (!updated[setIdx]) return;
    const nowDone = !updated[setIdx].done;
    updated[setIdx] = { ...updated[setIdx], done: nowDone };
    const next = { ...logs, [exIdx]: updated };
    setLogs(next);

    if (!nowDone) return;

    // Auto-start the rest timer on every completed set.
    setRestTrigger(Date.now());

    // If the whole exercise is now done, advance to the next unfinished one.
    if (exercises.length && updated.every(s => s.done)) {
      const nextIdx = exercises.findIndex((_, i) =>
        i !== exIdx && !((next[i] || []).length > 0 && (next[i] || []).every(s => s.done))
      );
      if (nextIdx !== -1) {
        showToast(`✅ ${exercises[exIdx].name} done — next: ${exercises[nextIdx].name}`);
        setTimeout(() => setActiveExIdx(nextIdx), 700);
      } else {
        showToast('🎉 All exercises done — hit Finish workout!');
      }
    }
  };

  const addSet = (exIdx) => {
    setLogs(prev => ({ ...prev, [exIdx]: [...(prev[exIdx] || []), { kg: '', reps: '', done: false }] }));
  };

  const removeSet = (exIdx, setIdx) => {
    setLogs(prev => {
      const rows = (prev[exIdx] || []).filter((_, i) => i !== setIdx);
      return { ...prev, [exIdx]: rows.length ? rows : [{ kg: '', reps: '', done: false }] };
    });
  };

  // Turn an index-keyed object ({0:.., 1:..}) into a contiguous array, mutate, and rekey —
  // keeps logs / lastSession aligned with the exercises array after add/remove.
  const asArray = (obj, len) => Array.from({ length: len }, (_, i) => obj[i]);
  const reArray = (arr) => arr.reduce((o, v, i) => { o[i] = v; return o; }, {});

  const blankSets = (n) => Array(Math.max(1, n || 3)).fill(null).map(() => ({ kg: '', reps: '', done: false }));
  const fromLib = (e) => ({ name: e.name, sets: e.defaultSets ?? 3, reps: e.defaultReps ?? '10-12', cue: e.cue ?? '', equipment: e.equipment });

  const addExerciseToSession = (libEx) => {
    const newIdx = exercises.length;
    setExercises(prev => [...prev, fromLib(libEx)]);
    setLogs(prev => ({ ...prev, [newIdx]: blankSets(libEx.defaultSets) }));
    setActiveExIdx(newIdx);
    setPicker(null);
    showToast(`➕ Added ${libEx.name}`);
  };

  const swapExercise = (idx, libEx) => {
    const old = exercises[idx];
    const hadData = (logs[idx] || []).some(s => s.kg || s.reps || s.done);
    setExercises(prev => prev.map((e, i) => (i === idx ? fromLib(libEx) : e)));
    setLogs(prev => ({ ...prev, [idx]: blankSets(libEx.defaultSets) }));
    setLastSession(prev => { const n = { ...prev }; delete n[idx]; return n; });
    if (hadData && old?.name && old.name !== libEx.name) postLog(idx, old, []); // clear old exercise's saved volume
    setPicker(null);
    showToast(`🔁 Swapped in ${libEx.name}`);
  };

  const removeExerciseFromSession = (idx) => {
    const len = exercises.length;
    if (len <= 1) { showToast('Cannot remove the only exercise'); return; }
    const removed = exercises[idx];
    const hadData = (logs[idx] || []).some(s => s.kg || s.reps || s.done);
    setExercises(prev => prev.filter((_, i) => i !== idx));
    setLogs(prev => { const a = asArray(prev, len); a.splice(idx, 1); return reArray(a); });
    setLastSession(prev => { const a = asArray(prev, len); a.splice(idx, 1); return reArray(a); });
    setActiveExIdx(a => (a > idx ? a - 1 : Math.min(a, len - 2)));
    if (hadData) postLog(idx, removed, []); // clear its saved volume on the server
    showToast(`🗑 Removed ${removed?.name || 'exercise'}`);
  };

  const adjustKg = (exIdx, setIdx, delta) => {
    setLogs(prev => {
      const updated = [...prev[exIdx]];
      const current = parseFloat(updated[setIdx].kg) || 0;
      updated[setIdx] = { ...updated[setIdx], kg: Math.max(0, current + delta).toString() };
      return { ...prev, [exIdx]: updated };
    });
  };

  const getAICoachNote = async (summary) => {
    setCoachNoteLoading(true);
    try {
      const p = `${userName} just finished a ${activePlan.name} session. ${summary}. Write a short motivating post-session note. 2-3 sentences.`;
      const res = await fetch(AI_COACH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-functions-key': AI_COACH_KEY },
        // Send both keys / accept either shape — the function contract varies.
        body: JSON.stringify({ message: p, prompt: p, userId })
      });
      if (res.ok) { const data = await res.json(); setCoachNote(data.reply || data.message); }
      else captureError(new Error(`aiCoach failed (${res.status})`), { screen: 'workout', action: 'coach-note', endpoint: 'aiCoach', status: res.status });
    } catch (e) {
      captureError(e, { screen: 'workout', action: 'coach-note', endpoint: 'aiCoach' });
    } finally { setCoachNoteLoading(false); }
  };

  const handleSave = async () => {
    if (!userId || !activePlan) return;
    if (userId === 'demo') { setSaved(true); setFinishQuote(randomQuote()); setTimeout(() => setSaved(false), 3000); return; }
    setSaving(true); setError(null);
    breadcrumb('finish workout', { exercises: exercises.length });
    try {
      // fetch only rejects on a network error, so a 500 would sail through
      // Promise.all — and the localStorage clear below would then throw away
      // the session that never reached the server. Check every response.
      const results = await Promise.all(exercises.map((ex, idx) =>
        fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-functions-key': API_KEY },
          body: JSON.stringify({ userId, planId: activePlan.id, planName: activePlan.name, date: TODAY, exIdx: idx, exName: ex.name, sets_data: JSON.stringify(logs[idx] || []) })
        })
      ));
      const failed = results.filter(r => !r.ok);
      if (failed.length) throw new Error(`${failed.length} of ${results.length} exercises failed to save (${failed[0].status})`);
      setSaved(true);
      // Deliberate: the sets are already on the server by this point, so a
      // failure to clear the local copy costs nothing.
      try { localStorage.removeItem('gd-workout-progress'); } catch (e) {}
      // Mark today's session complete for this user so the dashboard shows it done.
      // The sets are already saved by this point, so a failure here isn't worth
      // failing the finish over — but it's the reason "done today" goes missing,
      // so it must not fail silently.
      fetch(PROFILES_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-functions-key': PROFILES_KEY || '' }, body: JSON.stringify({ userId, lastWorkoutDate: TODAY }) })
        .then(r => {
          if (!r.ok) {
            console.error(`Workout: lastWorkoutDate not saved (${r.status}) — dashboard won't show today as done`);
            captureError(new Error(`lastWorkoutDate not saved (${r.status})`), {
              screen: 'workout', action: 'mark-done', endpoint: 'userProfiles', status: r.status,
            });
          }
        })
        .catch(e => {
          console.error('Workout: lastWorkoutDate not saved', e);
          captureError(e, { screen: 'workout', action: 'mark-done', endpoint: 'userProfiles' });
        });
      setFinishQuote(randomQuote());

      // PR detection: today's heaviest set vs last session's, per exercise
      const newPrs = [];
      exercises.forEach((ex, idx) => {
        const todayMax = Math.max(0, ...(logs[idx] || []).map(s => parseFloat(s.kg) || 0));
        const prevMax = Math.max(0, ...(lastSession[idx] || []).map(s => parseFloat(s.kg) || 0));
        if (prevMax > 0 && todayMax > prevMax) newPrs.push({ name: ex.name, kg: todayMax, prevKg: prevMax });
      });
      setPrs(newPrs);
      setShowComplete(true);

      const summary = exercises.map((ex, idx) => {
        const sets = (logs[idx] || []).filter(s => s.kg || s.reps).map(s => `${s.kg||'?'}kg x ${s.reps||'?'} reps`).join(', ');
        return sets ? `${ex.name}: ${sets}` : null;
      }).filter(Boolean).join('. ');
      if (summary) getAICoachNote(summary);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      // The user is told, but a session that wouldn't save is the single worst
      // failure in this app — it's an hour of someone's work.
      setError(e.message || 'Failed to save. Please try again.');
      captureError(e, { screen: 'workout', action: 'finish', endpoint: 'gymLogs', exercises: exercises.length });
    }
    finally { setSaving(false); }
  };

  const shareToFeed = async () => {
    if (!userId || !activePlan || shared || sharing) return;
    setSharing(true);
    try {
      const vol = Object.values(logs).flat().reduce((a, s) => a + (parseFloat(s.kg) || 0) * (parseInt(s.reps) || 0), 0);
      const volStr = vol >= 1000 ? `${(vol / 1000).toFixed(1)}k` : `${Math.round(vol)}`;
      const nSets = Object.values(logs).flat().filter(s => s.done || s.kg || s.reps).length;
      const res = await fetch('https://gymdogs-api-g9d0gve4angygdcj.newzealandnorth-01.azurewebsites.net/api/communityPosts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-functions-key': API_KEY || '' },
        body: JSON.stringify({
          userId,
          name: userName,
          text: prs.length > 0
            ? `Crushed ${activePlan.name} — ${nSets} sets, ${volStr}kg total volume. NEW PR: ${prs[0].name} ${prs[0].kg}kg 🏆`
            : `Crushed ${activePlan.name} — ${nSets} sets, ${volStr}kg total volume 💪`,
          tag: prs.length > 0 ? '🏆 New PR' : '🏋️ Session done',
        }),
      });
      if (res.ok) { setShared(true); showToast('🔥 Posted to the community feed'); }
      else {
        showToast('Could not share — try again');
        captureError(new Error(`Share failed (${res.status})`), {
          screen: 'workout', action: 'share-to-feed', endpoint: 'communityPosts', status: res.status,
        });
      }
    } catch (e) {
      showToast('Could not share — try again');
      captureError(e, { screen: 'workout', action: 'share-to-feed', endpoint: 'communityPosts' });
    }
    finally { setSharing(false); }
  };

  const formatLast = (exIdx) => {
    const sets = lastSession[exIdx];
    if (!sets || sets.length === 0) return null;
    return sets.filter(s => s.kg || s.reps).map(s => `${s.kg||'?'}kg × ${s.reps||'?'}`).join(', ');
  };

  const totalSets = exercises.reduce((sum, _, idx) => sum + (logs[idx]?.length || 0), 0);
  const doneSets = exercises.reduce((sum, _, idx) => sum + (logs[idx]?.filter(s => s.done).length || 0), 0);
  const totalVolume = exercises.reduce((sum, _, idx) => {
    return sum + (logs[idx] || []).reduce((s, set) => s + (parseFloat(set.kg) || 0) * (parseInt(set.reps) || 0), 0);
  }, 0);
  const doneExercises = exercises.filter((_, idx) => (logs[idx] || []).every(s => s.done) && (logs[idx] || []).length > 0).length;
  const progressPct = exercises.length ? (doneExercises / exercises.length) * 100 : 0;

  if (!userId || planLoading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: 'var(--ink)' }}>
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" style={{ animation: 'gdFloat 2s ease-in-out infinite' }}><path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" /></svg>
        <p style={{ color: 'var(--ink-3)', letterSpacing: '0.06em', fontSize: 13 }}>Loading your session...</p>
        <BottomNav />
      </div>
    );
  }

  if (planError || !activePlan) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: 'var(--ink)', padding: '0 28px', textAlign: 'center' }}>
        <div style={{ fontSize: 48 }}>📋</div>
        <p style={{ fontWeight: 800, fontSize: 18 }}>No active session</p>
        <p style={{ color: 'var(--ink-3)', fontSize: 13, lineHeight: 1.6 }}>{planError || 'Your coach has not published a session yet.'}</p>
        <button onClick={() => router.push('/dashboard')} style={{ marginTop: 16, background: 'var(--accent)', border: 'none', borderRadius: 16, padding: '14px 28px', color: 'var(--on-accent)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
          Back to dashboard
        </button>
        <BottomNav />
      </div>
    );
  }

  // Date-strict: a published plan stays active until replaced, so if it's from a
  // previous day, don't present it as today's workout — prompt for a fresh one.
  const isCoach = userId === COACH_ID;
  if (userId !== 'demo' && activePlan.date !== TODAY) {
    const whenStr = new Date(activePlan.date + 'T00:00:00').toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'short' });
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14, color: 'var(--ink)', padding: '0 28px', textAlign: 'center' }}>
        <div style={{ fontSize: 48 }}>🐕</div>
        <p className="gd-disp" style={{ fontWeight: 700, fontSize: 21 }}>No session for today yet</p>
        <p style={{ color: 'var(--ink-3)', fontSize: 13, lineHeight: 1.6, maxWidth: 300 }}>
          {isCoach
            ? `Your last session (${activePlan.name} · ${whenStr}) isn't today's. Publish today's workout in the Coach tab.`
            : `Nothing's been published for today yet. Ask Coach Shameel to set today's session, or give Gym Daddy a nudge.`}
        </p>
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button onClick={() => router.push(isCoach ? '/coach' : '/community')} style={{ background: 'var(--accent)', border: 'none', borderRadius: 16, padding: '14px 24px', color: 'var(--on-accent)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            {isCoach ? "Create today's session" : 'Message the pack'}
          </button>
          <button onClick={() => router.push('/dashboard')} style={{ background: 'var(--soft)', border: '1px solid var(--line)', borderRadius: 16, padding: '14px 24px', color: 'var(--ink-2)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            Home
          </button>
        </div>
        <button onClick={() => router.push('/history')} style={{ marginTop: 2, background: 'none', border: 'none', color: 'var(--accent-strong)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>📅 View past workouts</button>
        <BottomNav />
      </div>
    );
  }

  const activeEx = exercises[activeExIdx] || exercises[0] || {};
  const activeSets = logs[activeExIdx] || [];
  const lastData = formatLast(activeExIdx);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)', paddingBottom: 'calc(160px + env(safe-area-inset-bottom))' }}>

      {/* ── HEADER ──
          Reveal wraps only the static chrome. The exercise cards are NOT wrapped
          individually: a card swaps between <button> (collapsed) and <div>
          (expanded) under the same key, so React remounts it on every tap and a
          per-card Reveal would fade the whole thing in each time you log a set. */}
      <Reveal delay={0} style={{ padding: '52px 20px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.push('/dashboard')} aria-label="Back" style={{ width: 38, height: 38, borderRadius: 12, background: 'var(--soft)', border: '1px solid var(--line)', color: 'var(--ink)', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
          <div>
            <p style={eyebrow}>Active session</p>
            <p className="gd-disp" style={{ margin: '1px 0 0', fontSize: 18, fontWeight: 700 }}>{activePlan.name}</p>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p className="gd-disp" style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--blue)', fontVariantNumeric: 'tabular-nums' }}><DurationTimer /></p>
          <p style={{ ...eyebrow, fontSize: 9 }}>Duration</p>
          {autoSaveStatus && (
            <p style={{ margin: '5px 0 0', fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', color: autoSaveStatus === 'saved' ? 'var(--accent-strong)' : autoSaveStatus === 'unsaved' ? 'var(--red-ink)' : 'var(--ink-3)' }}>
              {autoSaveStatus === 'saving' ? 'Saving…' : autoSaveStatus === 'unsaved' ? '⚠ Not saved' : '✓ Saved'}
            </p>
          )}
        </div>
      </Reveal>

      <div style={{ padding: '0 20px' }}>

        {/* ── EXERCISE PAGER ── */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {exercises.map((_, i) => {
            const exDone = (logs[i] || []).length > 0 && (logs[i] || []).every(s => s.done);
            return (
              <div key={i} style={{
                flex: 1, height: 4, borderRadius: 999,
                background: (i === activeExIdx || exDone) ? 'var(--grad)' : 'var(--soft)',
                opacity: i === activeExIdx ? 1 : exDone ? 0.4 : 1,
              }} />
            );
          })}
        </div>

        {/* ── PROGRESS STATS ── */}
        <Reveal delay={80} style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: CARD_R, padding: '14px 16px', marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
            {[
              { label: 'Exercises', val: `${doneExercises}/${exercises.length}` },
              { label: 'Sets', val: `${doneSets}/${totalSets}` },
              { label: 'Volume', val: `${totalVolume > 0 ? totalVolume.toLocaleString() : '0'} kg` },
            ].map((s, i) => (
              <div key={i}>
                <p className="gd-disp" style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{s.val}</p>
                <p style={{ ...eyebrow, fontSize: 10, marginTop: 1 }}>{s.label}</p>
              </div>
            ))}
          </div>
          <div style={{ background: 'var(--soft)', borderRadius: 999, height: 6, overflow: 'hidden' }}>
            <div className="gd-shimbar" style={{ width: `${progressPct}%`, height: '100%', borderRadius: 999, background: 'var(--grad)', transition: 'width 0.3s' }} />
          </div>
        </Reveal>

        {/* ── AI COACH NOTE ── */}
        {(coachNote || coachNoteLoading) && (
          <div style={{ background: `linear-gradient(135deg, var(--ai-card-1), var(--ai-card-2))`, borderRadius: CARD_R, padding: '14px 16px', marginBottom: 14 }}>
            <p style={{ ...eyebrow, fontSize: 10, color: 'var(--on-dark-2)', marginBottom: 4 }}>✨ Coach · post session</p>
            {coachNoteLoading
              ? <div style={{ display: 'flex', gap: 4 }}>{[0,1,2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--on-dark-2)' }} />)}</div>
              : <p style={{ margin: 0, fontSize: 13, color: 'var(--on-dark)', lineHeight: 1.5 }}>{coachNote}</p>
            }
          </div>
        )}

        {/* ── GYM DADDY QUOTE + SHARE (after saving) ── */}
        {finishQuote && (
          <div style={{ background: 'var(--accent-tint)', borderRadius: CARD_R, padding: '14px 16px', marginBottom: 14 }}>
            <p style={{ ...eyebrow, fontSize: 10, color: 'var(--accent-strong)', marginBottom: 4 }}>🐕 Gym Daddy</p>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--ink)', fontWeight: 600, lineHeight: 1.5 }}>&ldquo;{finishQuote}&rdquo;</p>
            <button onClick={shareToFeed} disabled={shared || sharing} style={{
              marginTop: 12, width: '100%', border: 'none', borderRadius: 12, padding: '11px 0',
              background: shared ? 'var(--soft)' : 'var(--accent)',
              color: shared ? 'var(--accent-strong)' : 'var(--on-accent)',
              fontSize: 13, fontWeight: 700, cursor: shared ? 'default' : 'pointer',
              opacity: sharing ? 0.7 : 1,
            }}>
              {shared ? '✓ Shared with the pack' : sharing ? 'Sharing…' : '🔥 Share to the pack'}
            </button>
          </div>
        )}

        {/* ── ERROR ── */}
        {error && (
          <div style={{ background: 'var(--red-tint)', borderRadius: 12, padding: '10px 14px', color: 'var(--red-ink)', fontSize: 13, textAlign: 'center', marginBottom: 14 }}>{error}</div>
        )}

        {/* ── EXERCISES · tap any card to expand & log it in place (any order) ── */}
        <p style={{ ...eyebrow, margin: '0 4px 9px' }}>Exercises · tap to open</p>
        <Reveal delay={160} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {exercises.map((ex, idx) => {
            const sets = logs[idx] || [];
            const isDone = sets.length > 0 && sets.every(s => s.done);
            const open = idx === activeExIdx;
            const last = formatLast(idx);

            if (!open) {
              return (
                <button key={idx} onClick={() => setActiveExIdx(idx)} style={{
                  width: '100%', background: 'var(--card)', border: '1px solid var(--line)',
                  borderRadius: CARD_R, padding: '14px 16px', cursor: 'pointer', textAlign: 'left',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', border: `2px solid ${isDone ? 'var(--accent)' : 'var(--line)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: isDone ? 'var(--accent)' : 'var(--ink-3)', flexShrink: 0 }}>
                    {isDone ? '✓' : idx + 1}
                  </div>
                  <ExercisePhoto name={ex.name} size={44} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{ex.name}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--ink-3)' }}>{ex.sets} sets · {ex.reps} reps</p>
                  </div>
                  <span style={{ color: 'var(--ink-3)', fontSize: 18 }}>›</span>
                </button>
              );
            }

            return (
              <div key={idx} ref={activeCardRef} style={{ background: 'var(--card)', border: '1px solid var(--accent)', borderRadius: CARD_R, overflow: 'hidden', scrollMarginTop: 16 }}>
                <div style={{ padding: '16px 18px 4px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ ...eyebrow, color: 'var(--accent-strong)' }}>Exercise {idx + 1} of {exercises.length}</p>
                    <h2 className="gd-disp" style={{ margin: '5px 0 0', fontSize: 22, fontWeight: 700, lineHeight: 1.1 }}>{ex.name}</h2>
                    {last && (
                      <p style={{ margin: '7px 0 0', fontSize: 12, color: 'var(--ink-2)' }}>Last time: {last}</p>
                    )}
                  </div>
                  <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <button onClick={() => setShowGuide(!showGuide)} style={{ background: 'var(--soft)', border: '1px solid var(--line)', borderRadius: 12, padding: '8px 12px', color: 'var(--ink-2)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      Guide
                    </button>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => setPicker({ mode: 'swap', idx })} aria-label="Swap exercise" style={{ flex: 1, background: 'var(--soft)', border: '1px solid var(--line)', borderRadius: 12, padding: '8px 10px', color: 'var(--ink-2)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                        Swap
                      </button>
                      <button onClick={() => removeExerciseFromSession(idx)} aria-label="Skip exercise" style={{ flex: 1, background: 'var(--soft)', border: '1px solid var(--line)', borderRadius: 12, padding: '8px 10px', color: 'var(--ink-3)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                        Skip
                      </button>
                    </div>
                  </div>
                </div>

                {showGuide && ex.cue && (
                  <div style={{ margin: '12px 18px 0', background: 'var(--accent-tint)', borderRadius: 12, padding: '10px 14px' }}>
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--accent-strong)', lineHeight: 1.6 }}>🎯 {ex.cue}</p>
                  </div>
                )}

                <div style={{ padding: '14px 18px 4px', display: 'grid', gridTemplateColumns: '30px 1fr 1fr 40px', gap: 8 }}>
                  {['Set', 'Kg', 'Reps', ''].map((h, i) => (
                    <p key={i} style={{ margin: 0, fontSize: 10, color: 'var(--ink-3)', fontWeight: 700, letterSpacing: '0.06em', textAlign: i === 0 ? 'center' : 'left', textTransform: 'uppercase' }}>{h}</p>
                  ))}
                </div>

                <div style={{ padding: '0 18px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {sets.map((set, setIdx) => (
                    <div key={setIdx} style={{
                      display: 'grid', gridTemplateColumns: '30px 1fr 1fr 40px', gap: 8, alignItems: 'center',
                    }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-3)', textAlign: 'center' }}>{setIdx + 1}</div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: set.done ? 'var(--accent-tint)' : 'var(--soft)', borderRadius: 10, padding: '8px 8px' }}>
                        <button onClick={() => adjustKg(idx, setIdx, -2.5)} aria-label="decrease" style={{ background: 'none', border: 'none', color: 'var(--ink-3)', fontSize: 16, cursor: 'pointer', padding: '0 2px', lineHeight: 1 }}>−</button>
                        <input type="number" inputMode="decimal" value={set.kg} onChange={(e) => updateSet(idx, setIdx, 'kg', e.target.value)}
                          style={{ flex: 1, background: 'none', border: 'none', color: set.done ? 'var(--accent-strong)' : 'var(--ink)', fontSize: 16, fontWeight: 700, textAlign: 'center', outline: 'none', width: '100%', minWidth: 0 }}
                          placeholder="0" />
                        <button onClick={() => adjustKg(idx, setIdx, 2.5)} aria-label="increase" style={{ background: 'none', border: 'none', color: 'var(--ink-3)', fontSize: 16, cursor: 'pointer', padding: '0 2px', lineHeight: 1 }}>+</button>
                      </div>

                      <div style={{ background: set.done ? 'var(--accent-tint)' : 'var(--soft)', borderRadius: 10, padding: '8px 8px', display: 'flex', alignItems: 'center' }}>
                        <input type="number" inputMode="numeric" value={set.reps} onChange={(e) => updateSet(idx, setIdx, 'reps', e.target.value)}
                          style={{ width: '100%', background: 'none', border: 'none', color: set.done ? 'var(--accent-strong)' : 'var(--ink)', fontSize: 16, fontWeight: 700, textAlign: 'center', outline: 'none' }}
                          placeholder="0" />
                      </div>

                      <button onClick={() => toggleDone(idx, setIdx)} aria-label="mark set done" style={{
                        width: 34, height: 34, borderRadius: '50%', border: `2px solid ${set.done ? 'var(--accent)' : 'var(--line)'}`,
                        background: set.done ? 'var(--accent)' : 'transparent',
                        color: set.done ? 'var(--on-accent)' : 'transparent', fontSize: 15, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto',
                        boxShadow: set.done ? '0 0 12px var(--accent-glow)' : 'none',
                        animation: set.done ? 'gdPop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none',
                      }}>✓</button>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 8, margin: '6px 18px 16px' }}>
                  <button onClick={() => addSet(idx)} style={{
                    flex: 1, background: 'var(--soft)', border: 'none', borderRadius: 12, padding: '12px 0',
                    color: 'var(--accent-strong)', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  }}>
                    + Add set
                  </button>
                  {sets.length > 1 && (
                    <button onClick={() => removeSet(idx, sets.length - 1)} style={{
                      flex: 1, background: 'var(--soft)', border: 'none', borderRadius: 12, padding: '12px 0',
                      color: 'var(--ink-3)', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                    }}>
                      − Remove set
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          <button onClick={() => setPicker({ mode: 'add' })} style={{
            width: '100%', background: 'transparent', border: '1px dashed var(--line)', borderRadius: 16,
            padding: '14px 0', color: 'var(--accent-strong)', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}>+ Add exercise</button>
        </Reveal>

      </div>

      {/* ── BOTTOM ACTION BAR ── */}
      <div style={{
        position: 'fixed', bottom: 'calc(60px + env(safe-area-inset-bottom))', left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, zIndex: 101,
        background: 'var(--nav-bg)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
        borderTop: '1px solid var(--line-2)',
        padding: '12px 16px',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 12, alignItems: 'center' }}>
          <RestTimer trigger={restTrigger} onDone={() => showToast('⏱ Rest over — go!')} />
          <button onClick={handleSave} disabled={saving} className="gd-disp" style={{
            background: 'var(--grad)',
            border: 'none', borderRadius: 16, padding: '15px 0',
            color: '#fff', fontSize: 14, fontWeight: 700,
            cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
            boxShadow: 'var(--glow-grad), inset 0 1px 0 rgba(255,255,255,0.3)',
          }}>
            {saved ? 'Saved!' : saving ? 'Saving…' : 'Finish workout'}
          </button>
        </div>
      </div>

      {/* ── SESSION COMPLETE ── */}
      {showComplete && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'var(--bg)', overflowY: 'auto', padding: '76px 26px 44px', textAlign: 'center' }}>
          <style>{`@keyframes gdfall{0%{transform:translateY(0) rotate(0);opacity:1}100%{transform:translateY(440px) rotate(540deg);opacity:0}}
          @keyframes gdrise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
          .gdc{animation:gdrise .6s cubic-bezier(0.22,1,0.36,1) both}
          `}</style>
          {[...Array(26)].map((_, i) => (
            <div key={i} style={{
              position: 'absolute', left: `${28 + ((i * 7) % 44)}%`, top: `${8 + ((i * 5) % 12)}%`,
              width: 6 + (i % 3) * 3, height: 6 + (i % 3) * 3, borderRadius: 2,
              background: ['var(--ember)', 'var(--steel)', 'var(--vio)', 'var(--ice)', 'var(--gold)'][i % 5],
              animation: `gdfall 1.7s cubic-bezier(0.22,1,0.36,1) ${(i % 7) * 0.08}s forwards`,
              pointerEvents: 'none',
            }} />
          ))}

          <div className="gdc" style={{
            width: 74, height: 74, borderRadius: 999, background: 'var(--accent-tint)',
            border: '1.5px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px', boxShadow: '0 0 36px var(--accent-glow)',
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12.5l5 5L20 6.5" /></svg>
          </div>

          <p className="gdc" style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: 'var(--ink-3)', textTransform: 'uppercase' }}>Session complete</p>
          <p className="gdc gd-disp gd-grad-text" style={{ margin: '10px 0 2px', fontSize: 56, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
            {totalVolume >= 1000
              ? <CountNum value={totalVolume / 1000} decimals={1} suffix="k" />
              : <CountNum value={Math.round(totalVolume)} />}
          </p>
          <p className="gdc" style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: 'var(--accent-strong)', textTransform: 'uppercase' }}>kg total volume</p>

          <div className="gdc" style={{ display: 'flex', gap: 10, justifyContent: 'center', margin: '26px 0' }}>
            <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16, padding: '12px 18px', boxShadow: 'var(--shadow-card)' }}>
              <p style={{ margin: 0, fontSize: 18, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{doneSets}</p>
              <p style={{ margin: '3px 0 0', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--ink-3)' }}>SETS</p>
            </div>
            <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16, padding: '12px 18px', boxShadow: 'var(--shadow-card)' }}>
              <p style={{ margin: 0, fontSize: 18, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{Math.max(1, Math.round((Date.now() - startRef.current) / 60000))} min</p>
              <p style={{ margin: '3px 0 0', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--ink-3)' }}>DURATION</p>
            </div>
            <div style={{ background: 'var(--card)', border: `1px solid ${prs.length ? 'var(--gold)' : 'var(--line)'}`, borderRadius: 16, padding: '12px 18px', boxShadow: 'var(--shadow-card)' }}>
              <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: prs.length ? 'var(--gold)' : 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{prs.length > 0 ? `+${prs.length}` : '0'}</p>
              <p style={{ margin: '3px 0 0', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--ink-3)' }}>NEW PR</p>
            </div>
          </div>

          {prs.map((pr, i) => (
            <div key={i} className="gdc gd-shine" style={{ background: 'var(--gold-tint)', border: '1px solid var(--gold)', borderRadius: 18, padding: '14px 16px', marginBottom: 10, textAlign: 'left', display: 'flex', gap: 12, alignItems: 'center' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M8 21h8M12 21v-4M17 4H7v5a5 5 0 0 0 10 0V4z" /><path d="M17 6h3v2a3 3 0 0 1-3 3M7 6H4v2a3 3 0 0 0 3 3" /></svg>
              <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: 'var(--ink-2)' }}>
                <b style={{ color: 'var(--ink)' }}>{pr.name} — {pr.kg}kg.</b> Lifetime best, up from {pr.prevKg}kg.
              </p>
            </div>
          ))}

          {finishQuote && (
            <p className="gdc" style={{ margin: '16px auto 24px', maxWidth: 300, fontSize: 13, color: 'var(--ink-3)', fontStyle: 'italic', lineHeight: 1.55 }}>&ldquo;{finishQuote}&rdquo;</p>
          )}

          <button className="gdc" onClick={shareToFeed} disabled={shared || sharing} style={{
            width: '100%', border: 'none', borderRadius: 16, padding: 16,
            background: shared ? 'var(--soft)' : 'var(--grad)',
            color: shared ? 'var(--accent-strong)' : '#fff',
            fontSize: 15, fontWeight: 800, cursor: shared ? 'default' : 'pointer',
            boxShadow: shared ? 'none' : 'var(--glow-grad)',
          }}>
            {shared ? '✓ Shared with the pack' : sharing ? 'Sharing…' : 'Share to the pack'}
          </button>
          <button className="gdc" onClick={() => { setShowComplete(false); router.push('/dashboard'); }} style={{
            width: '100%', marginTop: 10, border: '1px solid var(--line)', borderRadius: 16, padding: 15,
            background: 'transparent', color: 'var(--ink-2)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}>
            Back home
          </button>
        </div>
      )}

      {/* ── TOAST ── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 'calc(130px + env(safe-area-inset-bottom))', left: '50%', transform: 'translateX(-50%)',
          zIndex: 150, background: 'var(--ai-card-1)', color: '#fff', fontSize: 13, fontWeight: 600,
          padding: '10px 18px', borderRadius: 999, maxWidth: 'calc(100% - 40px)', textAlign: 'center',
        }}>
          {toast}
        </div>
      )}

      {/* ── EXERCISE PICKER (add / swap) ── */}
      {picker && (
        <div onClick={() => setPicker(null)} style={{ position: 'fixed', inset: 0, zIndex: 320, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, background: 'var(--card)', borderRadius: '22px 22px 0 0', borderTop: '1px solid var(--line)', maxHeight: '80vh', display: 'flex', flexDirection: 'column', padding: '18px 18px calc(20px + env(safe-area-inset-bottom))' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{picker.mode === 'swap' ? 'Swap exercise' : 'Add exercise'}</p>
              <button onClick={() => setPicker(null)} aria-label="Close" style={{ background: 'var(--soft)', border: 'none', borderRadius: 10, width: 32, height: 32, color: 'var(--ink-2)', fontSize: 16, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 10 }}>
              {muscleGroups.map(mg => (
                <button key={mg} onClick={() => setPickerGroup(mg)} style={{
                  flexShrink: 0, padding: '7px 14px', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                  background: pickerGroup === mg ? 'var(--accent-tint)' : 'var(--soft)',
                  color: pickerGroup === mg ? 'var(--accent-strong)' : 'var(--ink-2)',
                }}>{mg}</button>
              ))}
            </div>
            <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
              {(exerciseLibrary[pickerGroup] || []).map(e => (
                <button key={e.name} onClick={() => (picker.mode === 'swap' ? swapExercise(picker.idx, e) : addExerciseToSession(e))} style={{
                  textAlign: 'left', background: 'var(--soft)', border: '1px solid var(--line)', borderRadius: 14, padding: '12px 14px',
                  cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
                }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{e.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600, flexShrink: 0 }}>{e.equipment}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <BottomNav />

    </div>
  );
}

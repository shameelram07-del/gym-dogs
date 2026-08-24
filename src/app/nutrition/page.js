'use client';
import { todayISO, toLocalISO, onDayChange } from '@/lib/day';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useMsal } from '@azure/msal-react';
import BottomNav from '@/components/BottomNav';
import TargetsSetup from '@/components/TargetsSetup';
import AddFoodSheet from '@/components/AddFoodSheet';
import EditItemSheet from '@/components/EditItemSheet';
import Reveal from '@/components/Reveal';
import { pushRecent, toCustomFood, upsertCustomFood } from '@/lib/food';
import { captureError } from '@/lib/monitoring';
import {
  calculateTargets, DEFAULT_TARGETS, seedFromProfile,
  summariseDay, upsertDay, flattenEntries, migrateWater,
  coachFallback, buildCoachPrompt, unknownMacros,
} from '@/lib/nutrition';

const PROFILES_URL = 'https://gymdogs-api-g9d0gve4angygdcj.newzealandnorth-01.azurewebsites.net/api/userProfiles';
const PROFILES_KEY = process.env.NEXT_PUBLIC_PROFILES_API_KEY;
const AI_COACH_URL = 'https://gymdogs-api-g9d0gve4angygdcj.newzealandnorth-01.azurewebsites.net/api/aiCoach';
const AI_COACH_KEY = process.env.NEXT_PUBLIC_AI_COACH_KEY;

// Cost control. This card is the first thing in the app that could actually
// spend money, so every one of these exists to stop it calling the model more
// than the day's eating genuinely warrants.
const COACH_DEBOUNCE_MS = 8000;   // adding three things to a meal is one call
const COACH_KCAL_DELTA  = 150;    // smaller than this isn't worth a new read
const COACH_MAX_CALLS   = 6;      // hard ceiling per user per day
const COACH_TIMEOUT_MS  = 20000;

const eyebrow = { fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', color: 'var(--ink-3)', textTransform: 'uppercase', margin: 0 };
const cardStyle = { background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 26, padding: 18 };
const pillBase = { padding: '9px 12px', borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: '1px solid var(--line)', background: 'var(--soft)', color: 'var(--ink-2)' };
const pillOn = { ...pillBase, background: 'var(--accent-tint)', borderColor: 'var(--accent)', color: 'var(--accent-strong)' };

const timeOf = (iso) => {
  const d = new Date(iso);
  return isNaN(d) ? '' : d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

// Grouping by part of the day gives the list shape without forcing anyone to
// decide whether 10pm chips count as "dinner" or "snacks".
const PARTS = [
  { id: 'morning',   label: 'Morning',   until: 11 },
  { id: 'midday',    label: 'Midday',    until: 15 },
  { id: 'afternoon', label: 'Afternoon', until: 18 },
  { id: 'evening',   label: 'Evening',   until: 24 },
];
function partOf(iso) {
  const d = new Date(iso);
  if (!iso || isNaN(d)) return PARTS[3];
  const h = d.getHours();
  return PARTS.find((p) => h < p.until) || PARTS[3];
}

// A little visual anchor per row. Cheap, and it makes a long list scannable.
const EMOJI = [
  [/burger|zinger|patty|whopper/i, '🍔'], [/chip|fries|wedges/i, '🍟'],
  [/chicken|wing|drumstick/i, '🍗'], [/rice|sushi|noodle|ramen/i, '🍚'],
  [/coffee|latte|flat white|espresso/i, '☕'], [/beer|wine|cider/i, '🍺'],
  [/drink|coke|pepsi|juice|soda|lemonade/i, '🥤'], [/shake|protein|whey/i, '🥛'],
  [/milk|yoghurt|yogurt|cheese/i, '🧀'], [/egg/i, '🥚'], [/bread|toast|sandwich|roll|wrap/i, '🥪'],
  [/salad|greens|lettuce|veg/i, '🥗'], [/apple|banana|fruit|berry|orange/i, '🍎'],
  [/steak|beef|mince|lamb/i, '🥩'], [/fish|salmon|tuna|prawn/i, '🐟'], [/pizza/i, '🍕'],
  [/pasta|spaghetti/i, '🍝'], [/choc|candy|lolly|sweet|dessert|cake|biscuit|bar/i, '🍫'],
  [/nut|almond|peanut/i, '🥜'], [/potato|gravy|mash/i, '🥔'], [/soup|stew|curry/i, '🍲'],
  [/oat|cereal|porridge|muesli/i, '🥣'],
];
const emojiFor = (name) => (EMOJI.find(([re]) => re.test(name || '')) || [null, '🍽️'])[1];

// MacroFactor writes macros as one compact line with the letters carrying colour.
function MacroLine({ item }) {
  const bits = [
    { v: item.protein, l: 'P', c: 'var(--accent-strong)' },
    { v: item.carbs,   l: 'C', c: 'var(--blue-ink)' },
    { v: item.fat,     l: 'F', c: 'var(--orange-ink)' },
  ];
  return (
    <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>
      <strong style={{ color: 'var(--ink-2)', fontWeight: 700 }}>{item.calories}</strong> kcal
      {bits.map((b) => (
        <span key={b.l}> &middot; {b.v === null || b.v === undefined
          ? <span style={{ color: 'var(--ember)' }} title="Not in the food database — tap to fill it in">?</span>
          : Math.round(b.v)}<span style={{ color: b.c, fontWeight: 700 }}>{b.l}</span></span>
      ))}
    </span>
  );
}

export default function NutritionPage() {
  const router = useRouter();
  const { accounts, inProgress } = useMsal();
  const [userId, setUserId] = useState(null);
  const [profileRef, setProfileRef] = useState(null);
  const [items, setItems] = useState([]);   // flat, in the order they were eaten
  const [waterMl, setWaterMl] = useState(0);
  const [adding, setAdding] = useState(false);
  const [editingWater, setEditingWater] = useState(false);
  const [editing, setEditing] = useState(null);   // the logged item being corrected
  const [saveError, setSaveError] = useState('');

  // Coach note. The text lives in state for rendering; the whole cached object
  // lives in a ref so the save helpers below always write the current one
  // without needing it in their dependency lists.
  const [coachNote, setCoachNote] = useState('');
  const [coachBusy, setCoachBusy] = useState(false);
  const noteRef = useRef({ date: '', text: '', itemCount: 0, kcal: 0, calls: 0, generatedAt: null });

  // The live day, mirrored into refs. Anything that SAVES must read these rather
  // than its own render's closure. The coach note fires its write up to 28
  // seconds after the render that scheduled it (8s debounce + a 20s model call),
  // and writing that stale snapshot back is what brought deleted food back onto
  // the day and rolled the rest of the profile back with it.
  const itemsRef = useRef(items);
  const waterRef = useRef(waterMl);
  const profileLatest = useRef(profileRef);
  // nutritionLog, foodRecent, foodCustom and foodFavourites are read-modify-write:
  // the new value is built from the stored one. Until the profile has actually
  // come back we don't know the stored one, and building from `[]` would send a
  // list containing only today — wiping the history the adaptive targets read.
  const profileLoaded = useRef(false);
  useEffect(() => { itemsRef.current = items; }, [items]);
  useEffect(() => { waterRef.current = waterMl; }, [waterMl]);
  useEffect(() => { profileLatest.current = profileRef; }, [profileRef]);
  // Recomputed, never cached at module scope: a phone that sat on this page all
  // night must roll over to the new day rather than keep yesterday's total.
  const [TODAY, setTODAY] = useState(todayISO());

  useEffect(() => onDayChange(TODAY, (next) => {
    setTODAY(next);
    setItems([]); itemsRef.current = [];
    setWaterMl(0); waterRef.current = 0;
    // New day, new note — and a fresh call budget.
    noteRef.current = { date: '', text: '', itemCount: 0, kcal: 0, calls: 0, generatedAt: null };
    setCoachNote('');
  }), [TODAY]);

  // Targets setup
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupForm, setSetupForm] = useState(null);
  const [showMaths, setShowMaths] = useState(false);

  useEffect(() => {
    if (inProgress !== 'none') return;
    if (accounts.length === 0) { router.push('/login'); return; }
    const uid = accounts[0].localAccountId;
    setUserId(uid);
    (async () => {
      try {
        const res = await fetch(`${PROFILES_URL}?userId=${uid}`, { headers: { 'x-functions-key': PROFILES_KEY } });
        if (res.ok) {
          const data = await res.json();
          const p = Array.isArray(data) ? data.find((x) => x.userId === uid) : data;
          // The read succeeded, so we now know what is stored — even if this
          // user has no profile document yet, in which case there is no history
          // and building from an empty list is correct.
          profileLoaded.current = true;
          if (p && !p.error) {
            profileLatest.current = { ...p, ...(profileLatest.current || {}) };
            setProfileRef(profileLatest.current);
            if (p.nutrition && p.nutrition.date === todayISO()) {
              // flattenEntries covers days saved before meal buckets were dropped
              const loaded = flattenEntries(p.nutrition.items || p.nutrition.meals);
              const water = migrateWater(p.nutrition);
              // Don't overwrite anything logged while this request was in flight.
              if (itemsRef.current.length === 0) { itemsRef.current = loaded; setItems(loaded); }
              if (waterRef.current === 0) { waterRef.current = water; setWaterMl(water); }
              // Restore today's cached note so reopening the screen spends nothing.
              const cached = p.nutrition.coachNote;
              if (cached && cached.date === todayISO()) {
                noteRef.current = cached;
                setCoachNote(cached.text || '');
              }
            }
          }
        }
      } catch (e) {
        // Silently losing this leaves the screen showing an empty day over the
        // top of food that is actually saved.
        captureError(e, { screen: 'nutrition', action: 'load-day', endpoint: 'userProfiles' });
      }
    })();
  }, [accounts, inProgress, router]);

  // ── Targets ──────────────────────────────────────────────────────────
  // Recomputed from the saved setup + real weigh-in and intake history, so they
  // track the user instead of sitting frozen at whatever was worked out on day 1.
  const saved = profileRef && profileRef.nutritionGoals;
  const targets = useMemo(() => {
    if (!saved) return null;
    return calculateTargets(saved, (profileRef && profileRef.nutritionLog) || [], (profileRef && profileRef.weighIns) || []);
  }, [saved, profileRef]);

  const T = targets || DEFAULT_TARGETS;
  // Explicit override wins; otherwise the bodyweight-derived suggestion.
  const waterGoalMl = (profileRef && profileRef.waterGoalMl) || T.waterMl || 2500;

  // null macros sum as 0 because there's nothing else to add — but the day is
  // then marked, so a total that's missing a food's protein doesn't read as a
  // measured low-protein day.
  const total = items.reduce((a, i) => ({
    calories: a.calories + (i.calories || 0),
    protein: a.protein + (i.protein || 0),
    carbs: a.carbs + (i.carbs || 0),
    fat: a.fat + (i.fat || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  const unknown = unknownMacros(items);

  async function saveProfile(patch) {
    if (!userId) return;
    // Keep a merged copy locally, so reads on this screen see the latest.
    const next = { ...(profileLatest.current || {}), userId, ...patch };
    profileLatest.current = next;
    setProfileRef(next);
    // But only ever SEND what changed. The API merges by field, so posting the
    // whole document made every write re-assert a snapshot of everything else:
    // it silently reverted whatever another screen had saved in between, and if
    // this ran before the profile GET came back it wrote a near-empty profile
    // over the top of a real one.
    try {
      const res = await fetch(PROFILES_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-functions-key': PROFILES_KEY },
        body: JSON.stringify({ userId, ...patch }),
      });
      // The screen already shows the food as logged. If the write failed, say
      // so — otherwise it silently disappears on the next reload.
      if (!res.ok) throw new Error(`Save failed (${res.status})`);
      setSaveError('');
    } catch (e) {
      setSaveError("Today's food isn't saved — check your connection.");
      // Field NAMES only — what was being written, never the values, which are
      // this person's weight, goal and food log.
      captureError(e, {
        screen: 'nutrition', action: 'save-profile', endpoint: 'userProfiles',
        fields: Object.keys(patch || {}).join(','),
      });
    }
  }

  // Every write to profile.nutrition goes through this. Building the object by
  // hand at each call site is how the cached coachNote would get silently
  // dropped the next time an item was logged — and a dropped cache is a paid
  // model call.
  function nutritionPayload(itemsArg, waterArg) {
    const out = { date: TODAY, items: itemsArg, waterMl: waterArg };
    if (noteRef.current.date === TODAY) out.coachNote = noteRef.current;
    return out;
  }

  // Saving a meal also files the day's totals into nutritionLog — that history
  // is what the adaptive expenditure model reads from.
  /**
   * The day's rollup, but only once we know what history is already stored.
   * Before that, sending it would replace the whole log with a single day.
   */
  function logPatch(itemsArg) {
    if (!profileLoaded.current) return {};
    return {
      nutritionLog: upsertDay((profileLatest.current && profileLatest.current.nutritionLog) || [], summariseDay(itemsArg, TODAY)),
    };
  }

  function saveNutrition(itemsArg, waterArg) {
    saveProfile({
      nutrition: nutritionPayload(itemsArg, waterArg),
      ...logPatch(itemsArg),
    });
  }

  // ── Coach note ───────────────────────────────────────────────────────
  async function generateCoachNote(kcal, count) {
    setCoachBusy(true);
    let text = '';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), COACH_TIMEOUT_MS);
    try {
      const trend = (profileRef && profileRef.weighIns) || [];
      const prompt = buildCoachPrompt({
        items,
        targets: T,
        expenditure: targets.expenditure,
        weeklyRate: targets.weeklyRate,
        expenditureSource: targets.expenditureSource,
        log: (profileRef && profileRef.nutritionLog) || [],
        goalWeight: profileRef && profileRef.goalWeight,
        latestWeighIn: trend.length ? trend[trend.length - 1].kg : null,
        hour: new Date().getHours(),
        today: TODAY,
      });
      const res = await fetch(AI_COACH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-functions-key': AI_COACH_KEY || '' },
        // userId so the backend's member snapshot comes along; both keys because
        // the function contract varies between screens.
        body: JSON.stringify({ message: prompt, prompt, userId }),
        signal: controller.signal,
      });
      if (res.ok) {
        const d = await res.json();
        const reply = d.reply || d.message || (typeof d === 'string' ? d : '');
        if (reply && String(reply).trim()) text = String(reply).trim();
      } else {
        console.error(`Nutrition coach: aiCoach failed (${res.status})`);
        captureError(new Error(`aiCoach failed (${res.status})`), {
          screen: 'nutrition', action: 'coach-note', endpoint: 'aiCoach', status: res.status,
        });
      }
    } catch (e) {
      console.error('Nutrition coach: aiCoach failed', e);
      // The 20s cut-off firing is our own timeout, not a fault — the card falls
      // back to the deterministic read and nobody sees an error.
      if (e.name !== 'AbortError') {
        captureError(e, { screen: 'nutrition', action: 'coach-note', endpoint: 'aiCoach' });
      }
    } finally {
      clearTimeout(timer);
    }

    // The call is recorded even when it failed, so a broken endpoint can't be
    // retried six times a minute. An empty `text` renders the deterministic
    // fallback instead — the card never shows an error.
    const prev = noteRef.current;
    noteRef.current = {
      date: TODAY,
      text,
      itemCount: count,
      kcal,
      calls: (prev.date === TODAY ? prev.calls : 0) + 1,
      generatedAt: new Date().toISOString(),
    };
    setCoachNote(text);
    setCoachBusy(false);
    // Persist the cached note against what is on the day RIGHT NOW. Reading the
    // closure's `items`/`waterMl` here re-saved a snapshot from before the call
    // started. And if midnight passed while the model was thinking, don't write
    // at all — the rollover has already cleared the day this note describes.
    if (todayISO() === TODAY) {
      saveProfile({ nutrition: nutritionPayload(itemsRef.current, waterRef.current) });
    }
  }

  useEffect(() => {
    // An empty day must drop any note it was holding, or yesterday's read
    // survives the midnight rollover and gets shown against a blank day.
    if (items.length === 0) { setCoachNote(''); setCoachBusy(false); return; }
    // No targets set yet: a model call would only describe generic numbers.
    if (!userId || !targets) { setCoachBusy(false); return; }

    const kcal = Math.round(total.calories);
    const n = noteRef.current;
    const freshToday = n.date === TODAY;

    // Water moves none of these, so filling a glass never triggers a call.
    const unchanged = freshToday && n.itemCount === items.length && Math.abs(kcal - n.kcal) <= COACH_KCAL_DELTA;
    if (unchanged || (freshToday && n.calls >= COACH_MAX_CALLS)) {
      setCoachNote(n.text || '');
      return;
    }

    const id = setTimeout(() => generateCoachNote(kcal, items.length), COACH_DEBOUNCE_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, userId, TODAY, total.calories, !!targets]);

  function openSetup() {
    setSetupForm(seedFromProfile(profileRef));
    setSetupOpen(true);
  }

  function saveSetup(parsed) {
    if (!parsed) return;
    saveProfile({ nutritionGoals: { ...parsed, setAt: TODAY }, weight: parsed.weight, height: parsed.height, age: parsed.age });
    setSetupOpen(false);
  }

  if (!userId) return null;

  const remaining = Math.max(T.calories - total.calories, 0);
  const calPct = Math.min(total.calories / T.calories, 1);
  const R = 52, CIRC = 2 * Math.PI * R;

  // The sheet stays open after an add, so a whole meal goes in without reopening.
  const addItem = (item) => {
    const stamped = { ...item, at: new Date().toISOString() };
    // From the ref, not `items`: the sheet stays open so a whole meal can be
    // logged in one visit, and several adds can land before React re-renders.
    // Reading the closure there kept only the last one.
    const next = [...itemsRef.current, stamped];
    itemsRef.current = next;
    setItems(next);
    saveProfile({
      nutrition: nutritionPayload(next, waterRef.current),
      ...logPatch(next),
      ...(profileLoaded.current
        ? { foodRecent: pushRecent((profileLatest.current && profileLatest.current.foodRecent) || [], item) }
        : {}),
    });
  };

  const removeItem = (id) => {
    const next = itemsRef.current.filter((i) => i.id !== id);
    itemsRef.current = next;
    setItems(next);
    saveNutrition(next, waterRef.current);
  };

  // Saving a correction can also mint a personal food entry, which then outranks
  // the database next time the same thing is logged.
  const saveEdit = (next, remember) => {
    const arr = itemsRef.current.map((i) => (i.id === next.id ? next : i));
    itemsRef.current = arr;
    setItems(arr);
    const patch = {
      nutrition: nutritionPayload(arr, waterRef.current),
      ...logPatch(arr),
    };
    if (remember && profileLoaded.current) {
      patch.foodCustom = upsertCustomFood((profileLatest.current && profileLatest.current.foodCustom) || [], toCustomFood(next));
    }
    saveProfile(patch);
    setEditing(null);
  };

  const setWater = (ml) => {
    const v = Math.max(0, Math.min(ml, 6000));
    waterRef.current = v;
    setWaterMl(v);
    saveNutrition(itemsRef.current, v);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)', paddingBottom: 100 }}>

      {/* ── HEADER ── */}
      <div style={{ padding: '52px 20px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <h1 className="gd-disp" style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>Nutrition</h1>
          <p style={{ margin: '1px 0 0', fontSize: 13, color: 'var(--ink-3)' }}>Today</p>
        </div>
        {targets && (
          <button onClick={openSetup} style={{ ...pillBase, padding: '7px 12px', fontSize: 12 }}>Targets</button>
        )}
      </div>

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {saveError && (
          <div style={{ background: 'var(--red-tint)', borderRadius: 12, padding: '10px 12px' }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--red-ink)' }}>&#9888; {saveError}</p>
          </div>
        )}

        {/* ── SET UP YOUR TARGETS ── */}
        {!targets && (
          <div style={{ ...cardStyle, background: 'var(--ai-card-1)', borderColor: 'transparent' }}>
            <p style={{ ...eyebrow, color: 'rgba(255,255,255,0.6)' }}>Set up</p>
            <h2 className="gd-disp" style={{ margin: '8px 0 6px', fontSize: 19, fontWeight: 800, color: '#fff' }}>
              These numbers aren&rsquo;t yours yet
            </h2>
            <p style={{ margin: '0 0 14px', fontSize: 14, lineHeight: 1.5, color: 'rgba(255,255,255,0.72)' }}>
              You&rsquo;re looking at a generic {DEFAULT_TARGETS.calories} kcal. Answer four questions and I&rsquo;ll work out your real
              targets &mdash; then keep adjusting them as your weigh-ins come in.
            </p>
            <button onClick={openSetup} className="gd-disp" style={{ width: '100%', padding: 14, borderRadius: 18, border: 'none', background: 'var(--grad)', color: 'var(--on-accent)', fontSize: 15, fontWeight: 700, cursor: 'pointer', boxShadow: 'var(--glow-grad)' }}>
              Work out my targets
            </button>
          </div>
        )}

        {/* ── CALORIE SUMMARY ── */}
        <Reveal delay={0} style={{ ...cardStyle, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ position: 'relative', width: 104, height: 104, flexShrink: 0 }}>
              <svg width="104" height="104" viewBox="0 0 120 120">
                <defs>
                  {/* The --grad run, as SVG stops — a CSS gradient can't be a stroke */}
                  <linearGradient id="calRing" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="var(--ice)" />
                    <stop offset="52%" stopColor="var(--steel)" />
                    <stop offset="100%" stopColor="var(--steel-deep)" />
                  </linearGradient>
                </defs>
                <circle cx="60" cy="60" r={R} fill="none" stroke="var(--soft)" strokeWidth="12" />
                <circle cx="60" cy="60" r={R} fill="none" stroke="url(#calRing)" strokeWidth="12" strokeLinecap="round"
                  strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - calPct)} transform="rotate(-90 60 60)"
                  style={{ transition: 'stroke-dashoffset .5s cubic-bezier(.4,0,.2,1)' }} />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span className="gd-disp" style={{ fontSize: 27, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.03em' }}>{Math.round(total.calories)}</span>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.11em', color: 'var(--ink-3)', marginTop: 4 }}>EATEN</span>
              </div>
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <p className="gd-disp" style={{ margin: 0, fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>
                {remaining}
              </p>
              <p style={{ margin: '5px 0 0', fontSize: 13.5, color: 'var(--ink-2)' }}>
                kcal left of <strong style={{ color: 'var(--ink)' }}>{T.calories}</strong>
                {!targets && <span style={{ color: 'var(--ink-3)' }}> (generic)</span>}
              </p>
              {total.calories > T.calories && (
                <p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--orange-ink)', fontWeight: 600 }}>
                  {Math.round(total.calories - T.calories)} over &mdash; one day doesn&rsquo;t undo a week.
                </p>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            {[
              { key: 'protein', label: 'Protein', letter: 'P', value: total.protein, goal: T.protein, color: 'var(--accent)' },
              { key: 'carbs',   label: 'Carbs',   letter: 'C', value: total.carbs,   goal: T.carbs,   color: 'var(--blue)' },
              { key: 'fat',     label: 'Fat',     letter: 'F', value: total.fat,     goal: T.fat,     color: 'var(--orange)' },
            ].map((m) => {
              const pct = m.goal ? Math.min((m.value / m.goal) * 100, 100) : 0;
              const over = m.value > m.goal;
              const gap = unknown.includes(m.key);
              return (
                <div key={m.letter} style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)' }}>{m.label}</span>
                    <span style={{ fontSize: 11.5, color: over ? 'var(--orange-ink)' : 'var(--ink-3)', fontWeight: 600 }}>
                      {Math.round(m.value)}{gap && <span style={{ color: 'var(--ember)' }} title="At least one food today has no figure for this">+?</span>}<span style={{ color: 'var(--ink-3)' }}>/{m.goal}g</span>
                    </span>
                  </div>
                  <div style={{ height: 7, background: 'var(--soft)', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: m.color, borderRadius: 999, transition: 'width .4s ease' }} />
                  </div>
                </div>
              );
            })}
          </div>

          {unknown.length > 0 && (
            <p style={{ margin: '12px 0 0', fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.45 }}>
              <span style={{ color: 'var(--ember)', fontWeight: 700 }}>+?</span>{' '}
              Something you logged today has no figure for it, so the real total is higher. Tap the
              item to fill it in.
            </p>
          )}
        </Reveal>

        {/* ── GYM DADDY — a read of the day, not just the numbers ── */}
        <Reveal delay={75} style={{ ...cardStyle, background: `linear-gradient(135deg, var(--ai-card-1), var(--ai-card-2))`, borderColor: 'transparent' }}>
          <p style={{ ...eyebrow, color: 'var(--ice)' }}>Gym Daddy</p>
          <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.55, color: 'var(--on-dark)' }}>
            {coachNote || coachFallback(total, T, new Date().getHours(), unknown)}
          </p>
          {coachBusy && (
            <div style={{ marginTop: 12, height: 6, background: 'var(--on-dark-soft)', borderRadius: 999, overflow: 'hidden' }}>
              <div className="gd-shimbar" style={{ height: '100%', width: '100%', background: 'var(--grad-soft)', borderRadius: 999 }} />
            </div>
          )}
        </Reveal>

        {/* ── EXPENDITURE / HOW THESE NUMBERS ARE SET ── */}
        {targets && (
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={eyebrow}>Your daily burn</p>
                <p className="gd-disp" style={{ margin: '6px 0 0', fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em' }}>
                  {targets.expenditure}<span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-3)', marginLeft: 4 }}>kcal</span>
                </p>
              </div>
              <span style={{
                ...pillBase, padding: '5px 10px', fontSize: 11, cursor: 'default',
                ...(targets.expenditureSource === 'measured' ? { background: 'var(--accent-tint)', borderColor: 'var(--accent)', color: 'var(--accent-strong)' } : {}),
              }}>
                {targets.expenditureSource === 'measured' ? 'Measured' : targets.expenditureSource === 'blended' ? 'Learning' : 'Estimated'}
              </span>
            </div>

            <p style={{ margin: '10px 0 0', fontSize: 13, lineHeight: 1.5, color: 'var(--ink-2)' }}>
              {targets.expenditureSource === 'formula'
                ? <>Starting estimate from your height, weight, age and training. Log your food and weigh in weekly and I&rsquo;ll replace this with your <strong>actual</strong> burn.</>
                : <>Worked out from what you really ate and how your weight actually moved &mdash; not a formula. {targets.stats && `${targets.stats.loggedDays} days logged over ${targets.stats.spanDays}.`}</>}
            </p>

            {targets.weeklyRate !== 0 && (
              <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--ink-2)' }}>
                Aiming for <strong>{targets.weeklyRate > 0 ? '+' : ''}{targets.weeklyRate} kg</strong> a week
                {targets.rateCapped && <span style={{ color: 'var(--orange-ink)' }}> (capped to a safe pace)</span>}.
              </p>
            )}
            {targets.floored && (
              <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--orange-ink)' }}>
                Held at a safe minimum &mdash; going lower isn&rsquo;t worth it.
              </p>
            )}

            <button onClick={() => setShowMaths(!showMaths)} style={{ marginTop: 12, background: 'none', border: 'none', padding: 0, color: 'var(--accent-strong)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              {showMaths ? 'Hide the maths' : 'Show the maths'}
            </button>
            {showMaths && (
              <div style={{ marginTop: 10, padding: 12, background: 'var(--soft)', borderRadius: 12, fontSize: 12.5, lineHeight: 1.6, color: 'var(--ink-2)' }}>
                <div>Formula estimate: <strong>{targets.formulaExpenditure} kcal</strong></div>
                {targets.measuredExpenditure !== null
                  ? <>
                      <div>Measured from your data: <strong>{targets.measuredExpenditure} kcal</strong></div>
                      <div>Confidence in the measurement: <strong>{Math.round(targets.confidence * 100)}%</strong></div>
                      <div style={{ marginTop: 6 }}>Trend weight: <strong>{targets.currentWeight} kg</strong></div>
                    </>
                  : <div style={{ marginTop: 6 }}>No measurement yet &mdash; {targets.reason}.</div>}
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--line)', color: 'var(--ink-3)' }}>
                  Estimates, not medical advice. Adjust if the scale disagrees for a fortnight.
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── WATER ── */}
        <Reveal delay={150} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <p style={eyebrow}>Water</p>
            <button onClick={() => setEditingWater(!editingWater)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 13, color: 'var(--ink-2)', fontWeight: 600 }}>
              <strong className="gd-disp" style={{ fontSize: 17, color: 'var(--ink)' }}>{(waterMl / 1000).toFixed(2).replace(/\.?0+$/, '')}</strong>
              {' / '}{(waterGoalMl / 1000).toFixed(1)} L
            </button>
          </div>

          <div style={{ height: 10, background: 'var(--soft)', borderRadius: 999, overflow: 'hidden', marginBottom: 12 }}>
            <div style={{ width: `${Math.min((waterMl / waterGoalMl) * 100, 100)}%`, height: '100%', background: 'var(--blue)', borderRadius: 999, transition: 'width .3s ease' }} />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {[250, 500, 1000].map((ml) => (
              <button key={ml} onClick={() => setWater(waterMl + ml)} style={{
                flex: 1, padding: '11px 6px', borderRadius: 12, cursor: 'pointer', border: '1px solid var(--line)',
                background: 'var(--soft)', color: 'var(--ink-2)', fontSize: 13.5, fontWeight: 700,
              }}>+{ml < 1000 ? `${ml}ml` : '1L'}</button>
            ))}
            <button onClick={() => setWater(waterMl - 250)} disabled={waterMl <= 0} aria-label="Undo a glass" style={{
              padding: '11px 15px', borderRadius: 12, cursor: waterMl > 0 ? 'pointer' : 'not-allowed', border: '1px solid var(--line)',
              background: 'var(--soft)', color: 'var(--ink-3)', fontSize: 15, fontWeight: 700,
            }}>&minus;</button>
          </div>

          {editingWater && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line-2)' }}>
              <p style={{ ...eyebrow, marginBottom: 9 }}>Daily goal</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[1500, 2000, 2500, 3000, 3500, 4000].map((g) => (
                  <button key={g} onClick={() => { saveProfile({ waterGoalMl: g }); setEditingWater(false); }} style={{
                    padding: '8px 13px', borderRadius: 999, cursor: 'pointer', fontSize: 13, fontWeight: 700,
                    border: `1px solid ${g === waterGoalMl ? 'var(--accent)' : 'var(--line)'}`,
                    background: g === waterGoalMl ? 'var(--accent-tint)' : 'var(--soft)',
                    color: g === waterGoalMl ? 'var(--accent-strong)' : 'var(--ink-2)',
                  }}>{(g / 1000).toFixed(1)} L</button>
                ))}
              </div>
            </div>
          )}
        </Reveal>

        {/* ── TODAY'S FOOD — grouped by part of the day ── */}
        <Reveal delay={220} style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px 14px' }}>
            <p style={eyebrow}>What you&rsquo;ve eaten</p>
            {items.length > 0 && (
              <span style={{ fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 600 }}>
                {items.length} item{items.length === 1 ? '' : 's'} &middot; {Math.round(total.calories)} kcal
              </span>
            )}
          </div>

          {items.length === 0 && (
            <p style={{ margin: 0, padding: '0 18px 18px', fontSize: 13.5, color: 'var(--ink-3)', lineHeight: 1.55 }}>
              Nothing yet. Add things as you eat them &mdash; scan a barcode, photograph the label, or just describe it.
            </p>
          )}

          {PARTS.map((part) => {
            const rows = items.filter((i) => partOf(i.at).id === part.id);
            if (!rows.length) return null;
            const kcal = rows.reduce((a, i) => a + (i.calories || 0), 0);
            return (
              <div key={part.id}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                  padding: '9px 18px', background: 'var(--soft)', borderTop: '1px solid var(--line-2)',
                }}>
                  <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--ink-2)' }}>{part.label}</span>
                  <span style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}>{kcal} kcal</span>
                </div>

                {rows.map((item) => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderTop: '1px solid var(--line-2)' }}>
                    <span style={{ fontSize: 19, width: 26, textAlign: 'center', flexShrink: 0 }}>{emojiFor(item.name)}</span>
                    <button onClick={() => setEditing(item)} style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', color: 'inherit' }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                        <p style={{ margin: 0, fontSize: 14.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</p>
                        {(item.grams || item.portion) && (
                          <span style={{ fontSize: 11.5, color: 'var(--ink-3)', flexShrink: 0, fontWeight: 600 }}>
                            {item.grams ? `${item.grams} g` : item.portion}
                          </span>
                        )}
                      </div>
                      {/* A meal logged as one line still says what was in it. */}
                      {Array.isArray(item.components) && item.components.length > 0 && (
                        <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.45, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.components.map((c) => c.name).join(' · ')}
                        </p>
                      )}
                      <div style={{ marginTop: 3, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <MacroLine item={item} />
                        {item.at && <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{timeOf(item.at)}</span>}
                        {item.corrected && <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--accent-strong)', letterSpacing: '0.04em' }}>EDITED</span>}
                      </div>
                    </button>
                    <button onClick={() => removeItem(item.id)} aria-label={`Remove ${item.name}`} style={{
                      background: 'none', border: 'none', color: 'var(--ink-3)', fontSize: 19, cursor: 'pointer', flexShrink: 0, padding: '4px 2px',
                    }}>×</button>
                  </div>
                ))}
              </div>
            );
          })}

          {items.length > 0 && (
            <p style={{ margin: 0, padding: '10px 18px 0', fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5, borderTop: '1px solid var(--line-2)' }}>
              Tap anything to fix its numbers &mdash; and I&rsquo;ll remember it for next time.
            </p>
          )}
          <button onClick={() => setAdding(true)} style={{
            width: '100%', padding: 15, background: 'var(--soft)', border: 'none', borderTop: '1px solid var(--line-2)',
            color: 'var(--accent-strong)', fontSize: 15, fontWeight: 800, cursor: 'pointer', marginTop: items.length ? 10 : 0,
          }}>
            + Add food
          </button>
        </Reveal>

      </div>

      {/* ── TARGETS SETUP (full-screen stepped flow) ── */}
      {setupOpen && setupForm && (
        <TargetsSetup
          initial={setupForm}
          profile={profileRef}
          onSave={saveSetup}
          onCancel={() => setSetupOpen(false)}
        />
      )}

      {/* ── FIX A LOGGED ITEM ── */}
      {editing && (
        <EditItemSheet
          item={editing}
          onSave={saveEdit}
          onDelete={(id) => { removeItem(id); setEditing(null); }}
          onClose={() => setEditing(null)}
        />
      )}

      {/* ── ADD FOOD ── */}
      {adding && (
        // Favourites are read-modify-write too: the sheet builds the new list
        // from what it was given, so before the profile lands it would replace
        // the stored favourites with a list of one.
        <AddFoodSheet
          profile={profileRef}
          onAdd={addItem}
          onSaveFavourites={(favs) => { if (profileLoaded.current) saveProfile({ foodFavourites: favs }); }}
          onClose={() => setAdding(false)}
        />
      )}

      <BottomNav />
    </div>
  );
}

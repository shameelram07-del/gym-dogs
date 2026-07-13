'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useMsal } from '@azure/msal-react';
import BottomNav from '@/components/BottomNav';
import { randomQuote } from '@/lib/quotes';
import { exerciseLibrary, muscleGroups } from '@/lib/exercises';

const API_URL = 'https://gymdogs-api-g9d0gve4angygdcj.newzealandnorth-01.azurewebsites.net/api/gymLogs';
const API_KEY = process.env.NEXT_PUBLIC_API_KEY;
const PLANS_API_URL = 'https://gymdogs-api-g9d0gve4angygdcj.newzealandnorth-01.azurewebsites.net/api/workoutPlans';
const PLANS_API_KEY = process.env.NEXT_PUBLIC_PLANS_API_KEY;
const AI_COACH_URL = 'https://gymdogs-api-g9d0gve4angygdcj.newzealandnorth-01.azurewebsites.net/api/aiCoach';
const AI_COACH_KEY = process.env.NEXT_PUBLIC_AI_COACH_KEY;

const TODAY = new Date().toISOString().split('T')[0];

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
  const [restTrigger, setRestTrigger] = useState(0); // bump to auto-start rest timer
  const [toast, setToast] = useState('');
  const toastRef = useRef(null);

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
          setExercises(Array.isArray(data.exercises) ? data.exercises : []);
          const emptyLogs = {};
          data.exercises.forEach((ex, idx) => {
            emptyLogs[idx] = Array(ex.sets).fill(null).map(() => ({ kg: '', reps: '', done: false }));
          });
          setLogs(emptyLogs);
        } else {
          setPlanError('No active session found.');
        }
      } catch { setPlanError('Could not load session.'); }
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
        } catch {}
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
    setExercises(prev => prev.map((e, i) => (i === idx ? fromLib(libEx) : e)));
    setLogs(prev => ({ ...prev, [idx]: blankSets(libEx.defaultSets) }));
    setLastSession(prev => { const n = { ...prev }; delete n[idx]; return n; });
    setPicker(null);
    showToast(`🔁 Swapped in ${libEx.name}`);
  };

  const removeExerciseFromSession = (idx) => {
    const len = exercises.length;
    if (len <= 1) { showToast('Cannot remove the only exercise'); return; }
    const name = exercises[idx]?.name;
    setExercises(prev => prev.filter((_, i) => i !== idx));
    setLogs(prev => { const a = asArray(prev, len); a.splice(idx, 1); return reArray(a); });
    setLastSession(prev => { const a = asArray(prev, len); a.splice(idx, 1); return reArray(a); });
    setActiveExIdx(a => (a > idx ? a - 1 : Math.min(a, len - 2)));
    showToast(`🗑 Removed ${name || 'exercise'}`);
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
    } catch {} finally { setCoachNoteLoading(false); }
  };

  const handleSave = async () => {
    if (!userId || !activePlan) return;
    if (userId === 'demo') { setSaved(true); setFinishQuote(randomQuote()); setTimeout(() => setSaved(false), 3000); return; }
    setSaving(true); setError(null);
    try {
      await Promise.all(exercises.map((ex, idx) =>
        fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-functions-key': API_KEY },
          body: JSON.stringify({ userId, planId: activePlan.id, planName: activePlan.name, date: TODAY, exIdx: idx, exName: ex.name, sets_data: JSON.stringify(logs[idx] || []) })
        })
      ));
      setSaved(true);
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
    } catch { setError('Failed to save. Please try again.'); }
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
      else showToast('Could not share — try again');
    } catch (e) { showToast('Could not share — try again'); }
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
      </div>
    );
  }

  const activeEx = exercises[activeExIdx] || exercises[0] || {};
  const activeSets = logs[activeExIdx] || [];
  const lastData = formatLast(activeExIdx);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)', paddingBottom: 'calc(160px + env(safe-area-inset-bottom))' }}>

      {/* ── HEADER ── */}
      <div style={{ padding: '52px 20px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.push('/dashboard')} aria-label="Back" style={{ width: 38, height: 38, borderRadius: 12, background: 'var(--soft)', border: '1px solid var(--line)', color: 'var(--ink)', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
          <div>
            <p style={{ margin: 0, fontSize: 11, color: 'var(--ink-3)', fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase' }}>Active session</p>
            <p className="gd-disp" style={{ margin: '1px 0 0', fontSize: 18, fontWeight: 700 }}>{activePlan.name}</p>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p className="gd-disp" style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--blue)', fontVariantNumeric: 'tabular-nums' }}><DurationTimer /></p>
          <p style={{ margin: 0, fontSize: 9, color: 'var(--ink-3)', letterSpacing: '0.06em', fontWeight: 600 }}>DURATION</p>
        </div>
      </div>

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

        {/* ── EXERCISE SELECTOR — tap any exercise, any order (busy-machine friendly) ── */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 6 }}>
          {exercises.map((ex, i) => {
            const exDone = (logs[i] || []).length > 0 && (logs[i] || []).every(s => s.done);
            const active = i === activeExIdx;
            return (
              <button key={i} onClick={() => setActiveExIdx(i)} style={{
                flexShrink: 0, display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer',
                padding: '8px 13px', borderRadius: 999, fontSize: 12.5, fontWeight: 700,
                border: `1px solid ${active ? 'var(--accent)' : 'var(--line)'}`,
                background: active ? 'var(--accent-tint)' : 'var(--card)',
                color: active ? 'var(--accent-strong)' : 'var(--ink-2)',
              }}>
                <span style={{
                  width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, background: exDone ? 'var(--accent)' : 'var(--soft)', color: exDone ? 'var(--on-accent)' : 'var(--ink-3)',
                }}>{exDone ? '✓' : i + 1}</span>
                {ex.name}
              </button>
            );
          })}
          <button onClick={() => { setPicker({ mode: 'add' }); }} style={{
            flexShrink: 0, cursor: 'pointer', padding: '8px 14px', borderRadius: 999, fontSize: 12.5, fontWeight: 700,
            border: '1px dashed var(--line)', background: 'transparent', color: 'var(--accent-strong)',
          }}>+ Add</button>
        </div>

        {/* ── PROGRESS STATS ── */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 18, padding: '14px 16px', marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
            {[
              { label: 'Exercises', val: `${doneExercises}/${exercises.length}` },
              { label: 'Sets', val: `${doneSets}/${totalSets}` },
              { label: 'Volume', val: `${totalVolume > 0 ? totalVolume.toLocaleString() : '0'} kg` },
            ].map((s, i) => (
              <div key={i}>
                <p className="gd-disp" style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{s.val}</p>
                <p style={{ margin: '1px 0 0', fontSize: 10, color: 'var(--ink-3)', fontWeight: 600 }}>{s.label}</p>
              </div>
            ))}
          </div>
          <div style={{ background: 'var(--soft)', borderRadius: 4, height: 5 }}>
            <div className="gd-shimbar" style={{ width: `${progressPct}%`, height: '100%', borderRadius: 4, background: 'var(--grad)', transition: 'width 0.3s' }} />
          </div>
        </div>

        {/* ── AI COACH NOTE ── */}
        {(coachNote || coachNoteLoading) && (
          <div style={{ background: `linear-gradient(135deg, var(--ai-card-1), var(--ai-card-2))`, borderRadius: 18, padding: '14px 16px', marginBottom: 14 }}>
            <p style={{ margin: '0 0 4px', fontSize: 10, color: '#C9C5FF', fontWeight: 700, letterSpacing: '0.08em' }}>✨ COACH · POST SESSION</p>
            {coachNoteLoading
              ? <div style={{ display: 'flex', gap: 4 }}>{[0,1,2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#9B82FF' }} />)}</div>
              : <p style={{ margin: 0, fontSize: 13, color: '#D9D9E3', lineHeight: 1.5 }}>{coachNote}</p>
            }
          </div>
        )}

        {/* ── GYM DADDY QUOTE + SHARE (after saving) ── */}
        {finishQuote && (
          <div style={{ background: 'var(--accent-tint)', borderRadius: 18, padding: '14px 16px', marginBottom: 14 }}>
            <p style={{ margin: '0 0 4px', fontSize: 10, color: 'var(--accent-strong)', fontWeight: 700, letterSpacing: '0.08em' }}>🐕 GYM DADDY</p>
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

        {/* ── ACTIVE EXERCISE ── */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--accent)', borderRadius: 22, overflow: 'hidden', marginBottom: 14 }}>
          <div style={{ padding: '16px 18px 4px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--accent-strong)', fontWeight: 700, letterSpacing: '0.08em' }}>EXERCISE {activeExIdx + 1} OF {exercises.length}</p>
              <h2 className="gd-disp" style={{ margin: '5px 0 0', fontSize: 23, fontWeight: 700, lineHeight: 1.1 }}>{activeEx.name}</h2>
              {lastData && (
                <p style={{ margin: '7px 0 0', fontSize: 12, color: 'var(--ink-2)' }}>Last time: {lastData}</p>
              )}
            </div>
            <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button onClick={() => setShowGuide(!showGuide)} style={{ background: 'var(--soft)', border: '1px solid var(--line)', borderRadius: 12, padding: '8px 12px', color: 'var(--ink-2)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                Guide
              </button>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => { setPicker({ mode: 'swap', idx: activeExIdx }); }} aria-label="Swap exercise" style={{ flex: 1, background: 'var(--soft)', border: '1px solid var(--line)', borderRadius: 12, padding: '8px 10px', color: 'var(--ink-2)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  Swap
                </button>
                <button onClick={() => removeExerciseFromSession(activeExIdx)} aria-label="Skip exercise" style={{ flex: 1, background: 'var(--soft)', border: '1px solid var(--line)', borderRadius: 12, padding: '8px 10px', color: 'var(--ink-3)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  Skip
                </button>
              </div>
            </div>
          </div>

          {showGuide && activeEx.cue && (
            <div style={{ margin: '12px 18px 0', background: 'var(--accent-tint)', borderRadius: 12, padding: '10px 14px' }}>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--accent-strong)', lineHeight: 1.6 }}>🎯 {activeEx.cue}</p>
            </div>
          )}

          {/* Column headers */}
          <div style={{ padding: '14px 18px 4px', display: 'grid', gridTemplateColumns: '30px 1fr 1fr 40px', gap: 8 }}>
            {['Set', 'Kg', 'Reps', ''].map((h, i) => (
              <p key={i} style={{ margin: 0, fontSize: 10, color: 'var(--ink-3)', fontWeight: 700, letterSpacing: '0.06em', textAlign: i === 0 ? 'center' : 'left', textTransform: 'uppercase' }}>{h}</p>
            ))}
          </div>

          {/* Set rows */}
          <div style={{ padding: '0 18px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {activeSets.map((set, setIdx) => (
              <div key={setIdx} style={{
                display: 'grid', gridTemplateColumns: '30px 1fr 1fr 40px', gap: 8, alignItems: 'center',
              }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-3)', textAlign: 'center' }}>{setIdx + 1}</div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: set.done ? 'var(--accent-tint)' : 'var(--soft)', borderRadius: 10, padding: '8px 8px' }}>
                  <button onClick={() => adjustKg(activeExIdx, setIdx, -2.5)} aria-label="decrease" style={{ background: 'none', border: 'none', color: 'var(--ink-3)', fontSize: 16, cursor: 'pointer', padding: '0 2px', lineHeight: 1 }}>−</button>
                  <input type="number" inputMode="decimal" value={set.kg} onChange={(e) => updateSet(activeExIdx, setIdx, 'kg', e.target.value)}
                    style={{ flex: 1, background: 'none', border: 'none', color: set.done ? 'var(--accent-strong)' : 'var(--ink)', fontSize: 16, fontWeight: 700, textAlign: 'center', outline: 'none', width: '100%', minWidth: 0 }}
                    placeholder="0" />
                  <button onClick={() => adjustKg(activeExIdx, setIdx, 2.5)} aria-label="increase" style={{ background: 'none', border: 'none', color: 'var(--ink-3)', fontSize: 16, cursor: 'pointer', padding: '0 2px', lineHeight: 1 }}>+</button>
                </div>

                <div style={{ background: set.done ? 'var(--accent-tint)' : 'var(--soft)', borderRadius: 10, padding: '8px 8px', display: 'flex', alignItems: 'center' }}>
                  <input type="number" inputMode="numeric" value={set.reps} onChange={(e) => updateSet(activeExIdx, setIdx, 'reps', e.target.value)}
                    style={{ width: '100%', background: 'none', border: 'none', color: set.done ? 'var(--accent-strong)' : 'var(--ink)', fontSize: 16, fontWeight: 700, textAlign: 'center', outline: 'none' }}
                    placeholder="0" />
                </div>

                <button onClick={() => toggleDone(activeExIdx, setIdx)} aria-label="mark set done" style={{
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
            <button onClick={() => addSet(activeExIdx)} style={{
              flex: 1, background: 'var(--soft)', border: 'none', borderRadius: 12, padding: '12px 0',
              color: 'var(--accent-strong)', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}>
              + Add set
            </button>
            {activeSets.length > 1 && (
              <button onClick={() => removeSet(activeExIdx, activeSets.length - 1)} style={{
                flex: 1, background: 'var(--soft)', border: 'none', borderRadius: 12, padding: '12px 0',
                color: 'var(--ink-3)', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}>
                − Remove set
              </button>
            )}
          </div>
        </div>

        {/* ── ALL EXERCISES (tap to jump — any order) ── */}
        {exercises.length > 1 && (
          <>
            <p style={{ margin: '0 4px 9px', fontSize: 11, color: 'var(--ink-3)', fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase' }}>All exercises · tap to jump</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {exercises.map((ex, idx) => {
                if (idx === activeExIdx) return null;
                const isDone = (logs[idx] || []).length > 0 && (logs[idx] || []).every(s => s.done);
                return (
                  <button key={idx} onClick={() => setActiveExIdx(idx)} style={{
                    width: '100%', background: 'var(--card)', border: '1px solid var(--line)',
                    borderRadius: 16, padding: '12px 14px', cursor: 'pointer', textAlign: 'left',
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', border: `2px solid ${isDone ? 'var(--accent)' : 'var(--line)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: isDone ? 'var(--accent)' : 'var(--ink-3)', flexShrink: 0 }}>
                      {isDone ? '✓' : idx + 1}
                    </div>
                    <ExercisePhoto name={ex.name} size={48} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{ex.name}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--ink-3)' }}>{ex.sets} sets · {ex.reps} reps</p>
                    </div>
                    <span style={{ color: 'var(--ink-3)', fontSize: 18 }}>›</span>
                  </button>
                );
              })}
            </div>
          </>
        )}

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
              background: ['var(--ember)', 'var(--mag)', 'var(--vio)', 'var(--ice)', 'var(--gold)'][i % 5],
              animation: `gdfall 1.7s cubic-bezier(0.22,1,0.36,1) ${(i % 7) * 0.08}s forwards`,
              pointerEvents: 'none',
            }} />
          ))}

          <div className="gdc" style={{
            width: 74, height: 74, borderRadius: 999, background: 'var(--accent-tint)',
            border: '1.5px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px', boxShadow: '0 0 36px rgba(255,46,147,0.35)',
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

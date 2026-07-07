'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useMsal } from '@azure/msal-react';
import BottomNav from '@/components/BottomNav';
import { randomQuote } from '@/lib/quotes';

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
    if (activePlan && updated.every(s => s.done)) {
      const nextIdx = activePlan.exercises.findIndex((_, i) =>
        i !== exIdx && !((next[i] || []).length > 0 && (next[i] || []).every(s => s.done))
      );
      if (nextIdx !== -1) {
        showToast(`✅ ${activePlan.exercises[exIdx].name} done — next: ${activePlan.exercises[nextIdx].name}`);
        setTimeout(() => setActiveExIdx(nextIdx), 700);
      } else {
        showToast('🎉 All exercises done — hit Finish workout!');
      }
    }
  };

  const addSet = (exIdx) => {
    setLogs(prev => ({ ...prev, [exIdx]: [...(prev[exIdx] || []), { kg: '', reps: '', done: false }] }));
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
        body: JSON.stringify({ message: p, prompt: p })
      });
      if (res.ok) { const data = await res.json(); setCoachNote(data.reply || data.message); }
    } catch {} finally { setCoachNoteLoading(false); }
  };

  const handleSave = async () => {
    if (!userId || !activePlan) return;
    if (userId === 'demo') { setSaved(true); setFinishQuote(randomQuote()); setTimeout(() => setSaved(false), 3000); return; }
    setSaving(true); setError(null);
    try {
      await Promise.all(activePlan.exercises.map((ex, idx) =>
        fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-functions-key': API_KEY },
          body: JSON.stringify({ userId, planId: activePlan.id, planName: activePlan.name, date: TODAY, exIdx: idx, exName: ex.name, sets_data: JSON.stringify(logs[idx] || []) })
        })
      ));
      setSaved(true);
      setFinishQuote(randomQuote());
      const summary = activePlan.exercises.map((ex, idx) => {
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
          text: `Crushed ${activePlan.name} — ${nSets} sets, ${volStr}kg total volume 💪`,
          tag: '🏋️ Session done',
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

  const totalSets = activePlan ? activePlan.exercises.reduce((sum, _, idx) => sum + (logs[idx]?.length || 0), 0) : 0;
  const doneSets = activePlan ? activePlan.exercises.reduce((sum, _, idx) => sum + (logs[idx]?.filter(s => s.done).length || 0), 0) : 0;
  const totalVolume = activePlan ? activePlan.exercises.reduce((sum, _, idx) => {
    return sum + (logs[idx] || []).reduce((s, set) => s + (parseFloat(set.kg) || 0) * (parseInt(set.reps) || 0), 0);
  }, 0) : 0;
  const doneExercises = activePlan ? activePlan.exercises.filter((_, idx) => (logs[idx] || []).every(s => s.done) && (logs[idx] || []).length > 0).length : 0;
  const progressPct = activePlan ? (doneExercises / activePlan.exercises.length) * 100 : 0;

  if (!userId || planLoading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: 'var(--ink)' }}>
        <div style={{ fontSize: 48 }}>💪</div>
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

  const activeEx = activePlan.exercises[activeExIdx];
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
            <p style={{ margin: '1px 0 0', fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em' }}>{activePlan.name}</p>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--accent-strong)', fontVariantNumeric: 'tabular-nums' }}><DurationTimer /></p>
          <p style={{ margin: 0, fontSize: 9, color: 'var(--ink-3)', letterSpacing: '0.06em', fontWeight: 600 }}>DURATION</p>
        </div>
      </div>

      <div style={{ padding: '0 20px' }}>

        {/* ── EXERCISE PAGER ── */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {activePlan.exercises.map((_, i) => {
            const exDone = (logs[i] || []).length > 0 && (logs[i] || []).every(s => s.done);
            return (
              <div key={i} style={{
                flex: 1, height: 4, borderRadius: 999,
                background: i === activeExIdx ? 'var(--accent)' : exDone ? 'var(--accent)' : 'var(--soft)',
                opacity: i === activeExIdx ? 1 : exDone ? 0.4 : 1,
              }} />
            );
          })}
        </div>

        {/* ── PROGRESS STATS ── */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 18, padding: '14px 16px', marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
            {[
              { label: 'Exercises', val: `${doneExercises}/${activePlan.exercises.length}` },
              { label: 'Sets', val: `${doneSets}/${totalSets}` },
              { label: 'Volume', val: `${totalVolume > 0 ? totalVolume.toLocaleString() : '0'} kg` },
            ].map((s, i) => (
              <div key={i}>
                <p style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em' }}>{s.val}</p>
                <p style={{ margin: '1px 0 0', fontSize: 10, color: 'var(--ink-3)', fontWeight: 600 }}>{s.label}</p>
              </div>
            ))}
          </div>
          <div style={{ background: 'var(--soft)', borderRadius: 4, height: 5 }}>
            <div style={{ width: `${progressPct}%`, height: '100%', borderRadius: 4, background: 'var(--accent)', transition: 'width 0.3s' }} />
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
              <p style={{ margin: 0, fontSize: 11, color: 'var(--accent-strong)', fontWeight: 700, letterSpacing: '0.08em' }}>EXERCISE {activeExIdx + 1} OF {activePlan.exercises.length}</p>
              <h2 style={{ margin: '5px 0 0', fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{activeEx.name}</h2>
              {lastData && (
                <p style={{ margin: '7px 0 0', fontSize: 12, color: 'var(--ink-2)' }}>Last time: {lastData}</p>
              )}
            </div>
            <button onClick={() => setShowGuide(!showGuide)} style={{ flexShrink: 0, background: 'var(--soft)', border: '1px solid var(--line)', borderRadius: 12, padding: '8px 12px', color: 'var(--ink-2)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              Guide
            </button>
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
                }}>✓</button>
              </div>
            ))}
          </div>

          <button onClick={() => addSet(activeExIdx)} style={{
            width: 'calc(100% - 36px)', margin: '6px 18px 16px', background: 'var(--soft)',
            border: 'none', borderRadius: 12, padding: '12px 0',
            color: 'var(--accent-strong)', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}>
            + Add set
          </button>
        </div>

        {/* ── UP NEXT ── */}
        {activePlan.exercises.length > 1 && (
          <>
            <p style={{ margin: '0 4px 9px', fontSize: 11, color: 'var(--ink-3)', fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase' }}>Up next</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {activePlan.exercises.map((ex, idx) => {
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
          <button onClick={handleSave} disabled={saving} style={{
            background: saved ? 'var(--accent-strong)' : 'var(--accent)',
            border: 'none', borderRadius: 14, padding: '15px 0',
            color: 'var(--on-accent)', fontSize: 14, fontWeight: 700,
            cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
          }}>
            {saved ? 'Saved!' : saving ? 'Saving…' : 'Finish workout'}
          </button>
        </div>
      </div>

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

      <BottomNav />

    </div>
  );
}

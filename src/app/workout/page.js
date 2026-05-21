'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useMsal } from '@azure/msal-react';

const API_URL = 'https://gymdogs-api-g9d0gve4angygdcj.newzealandnorth-01.azurewebsites.net/api/gymLogs';
const API_KEY = process.env.NEXT_PUBLIC_API_KEY;
const PLANS_API_URL = 'https://gymdogs-api-g9d0gve4angygdcj.newzealandnorth-01.azurewebsites.net/api/workoutPlans';
const PLANS_API_KEY = process.env.NEXT_PUBLIC_PLANS_API_KEY;
const AI_COACH_URL = 'https://gymdogs-api-g9d0gve4angygdcj.newzealandnorth-01.azurewebsites.net/api/aiCoach';
const AI_COACH_KEY = process.env.NEXT_PUBLIC_AI_COACH_KEY;

const TODAY = new Date().toISOString().split('T')[0];

function toSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function ExercisePhoto({ name, size = 80 }) {
  const [error, setError] = useState(false);
  const slug = toSlug(name);
  if (error) {
    return (
      <div style={{
        width: size, height: size, borderRadius: 12, flexShrink: 0,
        background: 'linear-gradient(135deg, #2d1b69, #1a0a3d)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.4, border: '1px solid rgba(139,92,246,0.2)',
      }}>💪</div>
    );
  }
  return (
    <div style={{ width: size, height: size, borderRadius: 12, flexShrink: 0, overflow: 'hidden', border: '1px solid rgba(139,92,246,0.2)', background: '#0d0d1a' }}>
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

function RestTimer({ onDone }) {
  const [seconds, setSeconds] = useState(90);
  const [running, setRunning] = useState(false);
  const ref = useRef(null);

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
      <div style={{ position: 'relative', width: 48, height: 48 }}>
        <svg width="48" height="48" viewBox="0 0 48 48">
          <circle cx="24" cy="24" r="22" fill="none" stroke="rgba(139,92,246,0.2)" strokeWidth="3" />
          <circle cx="24" cy="24" r="22" fill="none" stroke="#7c3aed" strokeWidth="3"
            strokeDasharray={`${circ * pct / 100} ${circ}`}
            strokeLinecap="round" transform="rotate(-90 24 24)" />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: '#a78bfa' }}>
          REST
        </div>
      </div>
      <div>
        <p style={{ margin: 0, fontSize: 20, fontWeight: 900, fontVariantNumeric: 'tabular-nums', color: '#fff' }}>{m}:{s}</p>
        <p style={{ margin: 0, fontSize: 9, color: '#6b7280', letterSpacing: '0.06em' }}>REST TIMER</p>
      </div>
      <button onClick={() => { setRunning(r => !r); }} style={{
        width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 14,
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {running ? '⏸' : '▶'}
      </button>
      <button onClick={() => setSeconds(90)} style={{
        width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.1)', color: '#6b7280', fontSize: 12,
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

  useEffect(() => {
    if (inProgress !== 'none') return;
    if (accounts.length === 0) { router.push('/login'); return; }
    const user = accounts[0];
    setUserId(user.localAccountId);
    const name = user.name && user.name !== 'unknown'
      ? user.name.split(' ')[0]
      : user.username?.split('@')[0] || 'Athlete';
    setUserName(name);
  }, [accounts, inProgress, router]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const res = await fetch(PLANS_API_URL, { headers: { 'x-functions-key': PLANS_API_KEY } });
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
    if (!userId || !activePlan) return;
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
    setLogs(prev => {
      const updated = [...prev[exIdx]];
      updated[setIdx] = { ...updated[setIdx], done: !updated[setIdx].done };
      return { ...prev, [exIdx]: updated };
    });
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
      const res = await fetch(AI_COACH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-functions-key': AI_COACH_KEY },
        body: JSON.stringify({ message: `${userName} just finished a ${activePlan.name} session. ${summary}. Write a short motivating post-session note in Shameel's voice. 2-3 sentences.` })
      });
      if (res.ok) { const data = await res.json(); setCoachNote(data.reply); }
    } catch {} finally { setCoachNoteLoading(false); }
  };

  const handleSave = async () => {
    if (!userId || !activePlan) return;
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
      const summary = activePlan.exercises.map((ex, idx) => {
        const sets = (logs[idx] || []).filter(s => s.kg || s.reps).map(s => `${s.kg||'?'}kg x ${s.reps||'?'} reps`).join(', ');
        return sets ? `${ex.name}: ${sets}` : null;
      }).filter(Boolean).join('. ');
      if (summary) getAICoachNote(summary);
      setTimeout(() => setSaved(false), 3000);
    } catch { setError('Failed to save. Please try again.'); }
    finally { setSaving(false); }
  };

  const formatLast = (exIdx) => {
    const sets = lastSession[exIdx];
    if (!sets || sets.length === 0) return null;
    return sets.filter(s => s.kg || s.reps).map(s => `${s.kg||'?'}kg × ${s.reps||'?'}`).join(', ');
  };

  // Stats
  const totalSets = activePlan ? activePlan.exercises.reduce((sum, _, idx) => sum + (logs[idx]?.length || 0), 0) : 0;
  const doneSets = activePlan ? activePlan.exercises.reduce((sum, _, idx) => sum + (logs[idx]?.filter(s => s.done).length || 0), 0) : 0;
  const totalVolume = activePlan ? activePlan.exercises.reduce((sum, _, idx) => {
    return sum + (logs[idx] || []).reduce((s, set) => s + (parseFloat(set.kg) || 0) * (parseInt(set.reps) || 0), 0);
  }, 0) : 0;
  const doneExercises = activePlan ? activePlan.exercises.filter((_, idx) => (logs[idx] || []).every(s => s.done) && (logs[idx] || []).length > 0).length : 0;
  const progressPct = activePlan ? (doneExercises / activePlan.exercises.length) * 100 : 0;

  if (!userId || planLoading) {
    return (
      <div style={{ minHeight: '100vh', background: '#09090F', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: '#fff' }}>
        <div style={{ fontSize: 48 }}>💪</div>
        <p style={{ color: '#6b7280', letterSpacing: '0.1em', fontSize: 13 }}>Loading your session...</p>
      </div>
    );
  }

  if (planError || !activePlan) {
    return (
      <div style={{ minHeight: '100vh', background: '#09090F', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: '#fff', padding: '0 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 48 }}>📋</div>
        <p style={{ fontWeight: 800, fontSize: 18 }}>No Active Session</p>
        <p style={{ color: '#6b7280', fontSize: 13, lineHeight: 1.6 }}>{planError || "Your coach hasn't published a session yet."}</p>
        <button onClick={() => router.push('/dashboard')} style={{ marginTop: 16, background: 'linear-gradient(135deg, #6d28d9, #4f46e5)', border: 'none', borderRadius: 16, padding: '14px 28px', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  const activeEx = activePlan.exercises[activeExIdx];
  const activeSets = logs[activeExIdx] || [];
  const lastData = formatLast(activeExIdx);
  const upcomingExercises = activePlan.exercises.filter((_, idx) => idx !== activeExIdx);

  return (
    <div style={{ minHeight: '100vh', background: '#09090F', color: '#fff', fontFamily: "'Inter', sans-serif", paddingBottom: 160 }}>

      {/* ── HEADER ── */}
      <div style={{ padding: '52px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.push('/dashboard')} style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>←</button>
          <div>
            <p style={{ margin: 0, fontSize: 10, color: '#a78bfa', fontWeight: 700, letterSpacing: '0.1em' }}>WORKOUT</p>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>{activePlan.name}</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <img src="/images/icon_timer.png" alt="" style={{ width: 16, height: 16, objectFit: 'contain' }} onError={(e) => { e.target.style.display='none'; }} />
              <span style={{ fontSize: 18, fontWeight: 900, color: '#a78bfa', fontVariantNumeric: 'tabular-nums' }}><DurationTimer /></span>
            </div>
            <p style={{ margin: 0, fontSize: 9, color: '#6b7280', letterSpacing: '0.06em' }}>DURATION</p>
          </div>
        </div>
      </div>

      {/* ── PROGRESS STATS BAR ── */}
      <div style={{ margin: '0 20px 14px', background: '#13131A', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '12px 16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10 }}>
          {[
            { icon: '/images/icon_focus.png', label: 'EXERCISES', val: `${doneExercises} / ${activePlan.exercises.length}` },
            { icon: '/images/icon_workout.png', label: 'SETS', val: `${doneSets} / ${totalSets}` },
            { icon: '/images/icon_stats.png', label: 'VOLUME', val: `${totalVolume > 0 ? totalVolume.toLocaleString() : '0'} KG` },
          ].map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <img src={s.icon} alt="" style={{ width: 16, height: 16, objectFit: 'contain', opacity: 0.6 }} onError={(e) => { e.target.style.display='none'; }} />
              <div>
                <p style={{ margin: 0, fontSize: 9, color: '#6b7280', letterSpacing: '0.06em' }}>{s.label}</p>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 800 }}>{s.val}</p>
              </div>
            </div>
          ))}
        </div>
        {/* Progress bar */}
        <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 4, height: 4 }}>
          <div style={{ width: `${progressPct}%`, height: '100%', borderRadius: 4, background: 'linear-gradient(90deg, #7c3aed, #a78bfa)', transition: 'width 0.3s' }} />
        </div>
      </div>

      {/* ── AI COACH NOTE ── */}
      {(coachNote || coachNoteLoading) && (
        <div style={{ margin: '0 20px 14px', background: 'rgba(109,40,217,0.1)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 16, padding: '12px 14px', display: 'flex', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>SC</div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: '0 0 3px', fontSize: 10, color: '#a78bfa', fontWeight: 700, letterSpacing: '0.08em' }}>COACH SHAMEEL · POST SESSION</p>
            {coachNoteLoading
              ? <div style={{ display: 'flex', gap: 4 }}>{[0,1,2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#a78bfa' }} />)}</div>
              : <p style={{ margin: 0, fontSize: 12, color: '#c4b5fd', fontStyle: 'italic', lineHeight: 1.5 }}>"{coachNote}"</p>
            }
          </div>
        </div>
      )}

      {/* ── ERROR ── */}
      {error && (
        <div style={{ margin: '0 20px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '10px 14px', color: '#f87171', fontSize: 13, textAlign: 'center' }}>{error}</div>
      )}

      {/* ── ACTIVE EXERCISE CARD ── */}
      <div style={{ margin: '0 20px 14px', background: '#13131A', border: '2px solid rgba(139,92,246,0.5)', borderRadius: 20, overflow: 'hidden', boxShadow: '0 0 30px rgba(109,40,217,0.15)' }}>

        {/* Card header */}
        <div style={{ padding: '14px 16px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ margin: 0, fontSize: 11, color: '#a78bfa', fontWeight: 700, letterSpacing: '0.08em' }}>EXERCISE {activeExIdx + 1}</p>
          <button onClick={() => setShowGuide(!showGuide)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 10, padding: '6px 12px', color: '#a78bfa', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            <img src="/images/icon_focus.png" alt="" style={{ width: 14, height: 14, objectFit: 'contain' }} onError={(e) => { e.target.style.display='none'; }} />
            GUIDE
          </button>
        </div>

        {/* Exercise name + photo */}
        <div style={{ padding: '0 16px 12px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 900, fontStyle: 'italic', letterSpacing: '-0.02em', lineHeight: 1.0, textTransform: 'uppercase' }}>
              {activeEx.name}
            </h2>
            {lastData && (
              <p style={{ margin: '0 0 8px', fontSize: 12, color: '#a78bfa', fontWeight: 600 }}>
                Last time: {lastData}
              </p>
            )}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 700, color: '#60a5fa' }}>
                <img src="/images/icon_stats.png" alt="" style={{ width: 11, height: 11, objectFit: 'contain' }} onError={(e) => { e.target.style.display='none'; }} />
                PR ATTEMPT
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 700, color: '#f87171' }}>
                <img src="/images/icon_fire.png" alt="" style={{ width: 11, height: 11, objectFit: 'contain' }} onError={(e) => { e.target.style.display='none'; }} />
                HIGH INTENSITY
              </span>
            </div>
          </div>
          {/* Exercise photo / avatar placeholder */}
          <ExercisePhoto name={activeEx.name} size={110} />
        </div>

        {/* Guide cue */}
        {showGuide && activeEx.cue && (
          <div style={{ margin: '0 16px 12px', background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 12, padding: '10px 14px' }}>
            <p style={{ margin: 0, fontSize: 12, color: '#c4b5fd', lineHeight: 1.6 }}>🎯 {activeEx.cue}</p>
          </div>
        )}

        {/* Column headers */}
        <div style={{ padding: '6px 16px', display: 'grid', gridTemplateColumns: '32px 1fr 1fr 40px', gap: 8 }}>
          {['SET', 'KG', 'REPS', ''].map((h, i) => (
            <p key={i} style={{ margin: 0, fontSize: 10, color: '#6b7280', fontWeight: 700, letterSpacing: '0.08em', textAlign: i === 0 ? 'center' : 'left' }}>{h}</p>
          ))}
        </div>

        {/* Set rows */}
        <div style={{ padding: '0 16px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {activeSets.map((set, setIdx) => (
            <div key={setIdx} style={{
              display: 'grid', gridTemplateColumns: '32px 1fr 1fr 40px', gap: 8, alignItems: 'center',
              padding: '10px 12px', borderRadius: 14,
              background: set.done ? 'rgba(52,211,153,0.06)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${set.done ? 'rgba(52,211,153,0.2)' : 'rgba(255,255,255,0.06)'}`,
            }}>
              {/* Set number */}
              <div style={{ width: 28, height: 28, borderRadius: '50%', border: '1.5px solid rgba(139,92,246,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#a78bfa', margin: '0 auto' }}>
                {setIdx + 1}
              </div>

              {/* KG with +/- */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '6px 8px' }}>
                <button onClick={() => adjustKg(activeExIdx, setIdx, -2.5)} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 16, cursor: 'pointer', padding: '0 2px', lineHeight: 1 }}>−</button>
                <input type="number" value={set.kg} onChange={(e) => updateSet(activeExIdx, setIdx, 'kg', e.target.value)}
                  style={{ flex: 1, background: 'none', border: 'none', color: '#fff', fontSize: 16, fontWeight: 800, textAlign: 'center', outline: 'none', width: '100%', minWidth: 0 }}
                  placeholder="0" />
                <button onClick={() => adjustKg(activeExIdx, setIdx, 2.5)} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 16, cursor: 'pointer', padding: '0 2px', lineHeight: 1 }}>+</button>
              </div>

              {/* REPS */}
              <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '6px 8px', display: 'flex', alignItems: 'center' }}>
                <input type="number" value={set.reps} onChange={(e) => updateSet(activeExIdx, setIdx, 'reps', e.target.value)}
                  style={{ width: '100%', background: 'none', border: 'none', color: '#fff', fontSize: 16, fontWeight: 800, textAlign: 'center', outline: 'none' }}
                  placeholder="0" />
              </div>

              {/* Done tick */}
              <button onClick={() => toggleDone(activeExIdx, setIdx)} style={{
                width: 36, height: 36, borderRadius: 8, border: `2px solid ${set.done ? '#7c3aed' : 'rgba(255,255,255,0.15)'}`,
                background: set.done ? 'linear-gradient(135deg, #7c3aed, #4f46e5)' : 'transparent',
                color: set.done ? '#fff' : 'transparent', fontSize: 16, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>✓</button>
            </div>
          ))}
        </div>

        {/* Add set */}
        <button onClick={() => addSet(activeExIdx)} style={{
          width: 'calc(100% - 32px)', margin: '4px 16px 16px', background: 'rgba(255,255,255,0.03)',
          border: '1px dashed rgba(139,92,246,0.3)', borderRadius: 12, padding: '11px 0',
          color: '#a78bfa', fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', cursor: 'pointer',
        }}>
          + ADD SET
        </button>
      </div>

      {/* ── UPCOMING EXERCISES ── */}
      {upcomingExercises.length > 0 && (
        <div style={{ padding: '0 20px 14px' }}>
          <p style={{ margin: '0 0 10px', fontSize: 11, color: '#6b7280', fontWeight: 700, letterSpacing: '0.1em' }}>UPCOMING EXERCISES</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {activePlan.exercises.map((ex, idx) => {
              if (idx === activeExIdx) return null;
              const isDone = (logs[idx] || []).length > 0 && (logs[idx] || []).every(s => s.done);
              return (
                <button key={idx} onClick={() => setActiveExIdx(idx)} style={{
                  width: '100%', background: '#13131A',
                  border: `1px solid ${isDone ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.07)'}`,
                  borderRadius: 16, padding: '12px 14px', cursor: 'pointer', textAlign: 'left',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  {/* Number */}
                  <div style={{ width: 32, height: 32, borderRadius: '50%', border: `1.5px solid ${isDone ? '#34d399' : 'rgba(139,92,246,0.5)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: isDone ? '#34d399' : '#a78bfa', flexShrink: 0 }}>
                    {isDone ? '✓' : idx + 1}
                  </div>
                  {/* Photo */}
                  <ExercisePhoto name={ex.name} size={56} />
                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#fff' }}>{ex.name}</p>
                    <span style={{ display: 'inline-block', marginTop: 4, fontSize: 10, fontWeight: 600, color: '#9ca3af', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '2px 8px' }}>
                      {ex.sets} SETS · {ex.reps} REPS
                    </span>
                  </div>
                  {/* Guide + chevron */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <img src="/images/icon_focus.png" alt="" style={{ width: 14, height: 14, objectFit: 'contain', opacity: 0.6 }} onError={(e) => { e.target.style.display='none'; }} />
                    </div>
                    <span style={{ color: '#6b7280', fontSize: 16 }}>∨</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── BOTTOM BAR ── */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
        background: '#0d0d14', borderTop: '1px solid rgba(255,255,255,0.07)',
        padding: '12px 16px', paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1.6fr', gap: 10, alignItems: 'center' }}>

          {/* Rest timer */}
          <RestTimer />

          {/* Add exercise */}
          <button onClick={() => router.push('/coach')} style={{
            width: 52, height: 52, borderRadius: 14,
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            color: '#fff', cursor: 'pointer', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 2, flexShrink: 0,
          }}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>+</span>
            <span style={{ fontSize: 8, color: '#6b7280', fontWeight: 600, letterSpacing: '0.04em' }}>ADD</span>
          </button>

          {/* Finish workout */}
          <button onClick={handleSave} disabled={saving} style={{
            background: saved ? 'linear-gradient(135deg, #059669, #10b981)' : 'linear-gradient(135deg, #6d28d9, #4f46e5)',
            border: 'none', borderRadius: 14, padding: '14px 0',
            color: '#fff', fontSize: 13, fontWeight: 800, letterSpacing: '0.05em',
            cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            boxShadow: '0 4px 20px rgba(109,40,217,0.4)',
          }}>
            <span style={{ fontSize: 16 }}>{saved ? '✅' : '✓'}</span>
            {saved ? 'SAVED!' : saving ? 'SAVING...' : 'FINISH WORKOUT'}
          </button>
        </div>
      </div>

    </div>
  );
}
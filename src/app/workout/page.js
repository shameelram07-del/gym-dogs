'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useMsal } from '@azure/msal-react';
import BottomNav from '@/components/BottomNav';

const API_URL = 'https://gymdogs-api-g9d0gve4angygdcj.newzealandnorth-01.azurewebsites.net/api/gymLogs';
const API_KEY = process.env.NEXT_PUBLIC_API_KEY;
const PLANS_API_URL = 'https://gymdogs-api-g9d0gve4angygdcj.newzealandnorth-01.azurewebsites.net/api/workoutPlans';
const PLANS_API_KEY = process.env.NEXT_PUBLIC_PLANS_API_KEY;
const AI_COACH_URL = 'https://gymdogs-api-g9d0gve4angygdcj.newzealandnorth-01.azurewebsites.net/api/aiCoach';
const AI_COACH_KEY = process.env.NEXT_PUBLIC_AI_COACH_KEY;

const TODAY = new Date().toISOString().split('T')[0];

// Convert exercise name to image slug
function toSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// Exercise photo component with fallback
function ExercisePhoto({ name, size = 72 }) {
  const [error, setError] = useState(false);
  const slug = toSlug(name);
  
  if (error) {
    return (
      <div style={{
        width: size, height: size, borderRadius: 12, flexShrink: 0,
        background: 'linear-gradient(135deg, #1a0a3d, #0d1040)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 28,
      }}>
        💪
      </div>
    );
  }

  return (
    <div style={{
      width: size, height: size, borderRadius: 12, flexShrink: 0,
      background: '#0d0d1a', overflow: 'hidden',
      border: '1px solid rgba(139,92,246,0.2)',
    }}>
      <img
        src={`/images/exercises/${slug}.jpg`}
        alt={name}
        onError={() => setError(true)}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </div>
  );
}

// Elapsed timer
function ElapsedTimer() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return <span>{m}:{s}</span>;
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
  const [expandedIdx, setExpandedIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  const [coachNote, setCoachNote] = useState(null);
  const [coachNoteLoading, setCoachNoteLoading] = useState(false);

  // Auth
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

  // Load plan
  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const res = await fetch(PLANS_API_URL, {
          headers: { 'x-functions-key': PLANS_API_KEY }
        });
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
      } catch {
        setPlanError('Could not load session.');
      } finally {
        setPlanLoading(false);
      }
    })();
  }, [userId]);

  // Load last session
  useEffect(() => {
    if (!userId || !activePlan) return;
    (async () => {
      try {
        const results = {};
        await Promise.all(
          activePlan.exercises.map(async (ex, idx) => {
            const res = await fetch(
              `${API_URL}?userId=${userId}&exName=${encodeURIComponent(ex.name)}&session=last`,
              { headers: { 'x-functions-key': API_KEY } }
            );
            if (res.ok) {
              const data = await res.json();
              if (data.length > 0) results[idx] = JSON.parse(data[0].sets_data || '[]');
            }
          })
        );
        setLastSession(results);
      } catch { /* silent */ }
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
    setLogs(prev => ({
      ...prev,
      [exIdx]: [...(prev[exIdx] || []), { kg: '', reps: '', done: false }]
    }));
  };

  const completedCount = activePlan ? activePlan.exercises.filter((_, idx) => {
    const sets = logs[idx] || [];
    return sets.length > 0 && sets.every(s => s.done);
  }).length : 0;

  const getAICoachNote = async (summary) => {
    setCoachNoteLoading(true);
    try {
      const res = await fetch(AI_COACH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-functions-key': AI_COACH_KEY },
        body: JSON.stringify({
          message: `${userName} just finished a ${activePlan.name} session. ${summary}. Write a short motivating post-session note in Shameel's voice. 2-3 sentences, specific to their work.`
        })
      });
      if (res.ok) {
        const data = await res.json();
        setCoachNote(data.reply);
      }
    } catch { /* silent */ } finally {
      setCoachNoteLoading(false);
    }
  };

  const handleSave = async () => {
    if (!userId || !activePlan) return;
    setSaving(true);
    setError(null);
    try {
      await Promise.all(activePlan.exercises.map((ex, idx) =>
        fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-functions-key': API_KEY },
          body: JSON.stringify({
            userId, planId: activePlan.id, planName: activePlan.name,
            date: TODAY, exIdx: idx, exName: ex.name,
            sets_data: JSON.stringify(logs[idx] || [])
          })
        })
      ));
      setSaved(true);
      const summary = activePlan.exercises.map((ex, idx) => {
        const sets = (logs[idx] || []).filter(s => s.kg || s.reps)
          .map(s => `${s.kg||'?'}kg x ${s.reps||'?'} reps`).join(', ');
        return sets ? `${ex.name}: ${sets}` : null;
      }).filter(Boolean).join('. ');
      if (summary) getAICoachNote(summary);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const formatLast = (exIdx) => {
    const sets = lastSession[exIdx];
    if (!sets || sets.length === 0) return null;
    return sets.filter(s => s.kg || s.reps).map(s => `${s.kg||'?'}kg × ${s.reps||'?'}`).join('  ·  ');
  };

  // ── Loading
  if (!userId || planLoading) {
    return (
      <div style={{ minHeight: '100vh', background: '#08080F', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: '#fff' }}>
        <div style={{ fontSize: 48 }}>💪</div>
        <p style={{ color: '#6b7280', letterSpacing: '0.1em', fontSize: 13 }}>Loading your session...</p>
      </div>
    );
  }

  // ── No plan
  if (planError || !activePlan) {
    return (
      <div style={{ minHeight: '100vh', background: '#08080F', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: '#fff', padding: '0 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 48 }}>📋</div>
        <p style={{ fontWeight: 800, fontSize: 18 }}>No Active Session</p>
        <p style={{ color: '#6b7280', fontSize: 13, lineHeight: 1.6 }}>{planError || "Your coach hasn't published a session yet."}</p>
        <button onClick={() => router.push('/dashboard')} style={{ marginTop: 16, background: 'linear-gradient(135deg, #6d28d9, #4f46e5)', border: 'none', borderRadius: 16, padding: '14px 28px', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
          Back to Dashboard
        </button>
        <BottomNav />
      </div>
    );
  }

  const total = activePlan.exercises.length;
  const ringPct = total > 0 ? (completedCount / total) * 100 : 0;
  const ringCircumference = 2 * Math.PI * 28;

  return (
    <div style={{ minHeight: '100vh', background: '#08080F', color: '#fff', fontFamily: "'Inter', sans-serif", paddingBottom: 140 }}>

      {/* ── HEADER ── */}
      <div style={{ padding: '52px 20px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ flex: 1 }}>
            <button
              onClick={() => router.push('/dashboard')}
              style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 10, width: 36, height: 36, color: '#fff', fontSize: 18, cursor: 'pointer', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              ←
            </button>
            <h1 style={{ margin: 0, fontSize: 30, fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {activePlan.name.split('/').map((part, i) => (
                <span key={i}>
                  {i > 0 && <span style={{ color: '#fff' }}> / </span>}
                  <span style={{ color: i === 0 ? '#fff' : '#a78bfa' }}>{part.trim()}</span>
                </span>
              ))}
            </h1>
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <span style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', color: '#a5b4fc', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', padding: '4px 12px', borderRadius: 20 }}>
                {activePlan.tag}
              </span>
              <span style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#9ca3af', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', padding: '4px 12px', borderRadius: 20 }}>
                {total} EXERCISES
              </span>
            </div>
          </div>
          {/* Gym Dogs Logo */}
          <img
            src="/images/gymdogs_logo.png"
            alt="Gym Dogs"
            style={{ width: 72, height: 72, objectFit: 'contain', flexShrink: 0, marginLeft: 12 }}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        </div>
      </div>

      {/* ── PROGRESS CARD ── */}
      <div style={{ margin: '0 20px 16px' }}>
        <div style={{ background: '#111118', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Ring */}
          <div style={{ position: 'relative', width: 64, height: 64, flexShrink: 0 }}>
            <svg width="64" height="64" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(139,92,246,0.15)" strokeWidth="5" />
              <circle
                cx="32" cy="32" r="28" fill="none"
                stroke="url(#progressGrad)" strokeWidth="5"
                strokeDasharray={`${ringCircumference * ringPct / 100} ${ringCircumference}`}
                strokeLinecap="round" transform="rotate(-90 32 32)"
              />
              <defs>
                <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#a78bfa" />
                  <stop offset="100%" stopColor="#6d28d9" />
                </linearGradient>
              </defs>
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 18, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{completedCount}</span>
              <span style={{ fontSize: 9, color: '#6b7280', fontWeight: 600 }}>of {total}</span>
            </div>
          </div>

          {/* Progress text */}
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#6b7280', letterSpacing: '0.08em' }}>WORKOUT PROGRESS</p>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#e2e8f0' }}>{completedCount} of {total} exercises completed</p>
          </div>

          {/* Timer */}
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end', marginBottom: 2 }}>
              <span style={{ fontSize: 12 }}>🕐</span>
              <span style={{ fontSize: 20, fontWeight: 900, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
                <ElapsedTimer />
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 10, color: '#6b7280', fontWeight: 700, letterSpacing: '0.08em' }}>ELAPSED</p>
          </div>
        </div>
      </div>

      {/* ── AI COACH NOTE ── */}
      {(coachNote || coachNoteLoading) && (
        <div style={{ margin: '0 20px 16px', background: 'rgba(109,40,217,0.1)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 18, padding: '14px 16px', display: 'flex', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 12, background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>SC</div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: '0 0 4px', fontSize: 10, color: '#a78bfa', fontWeight: 700, letterSpacing: '0.08em' }}>COACH SHAMEEL · POST SESSION</p>
            {coachNoteLoading ? (
              <div style={{ display: 'flex', gap: 4 }}>
                {[0,1,2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#a78bfa', animation: 'bounce 0.8s infinite', animationDelay: `${i*0.15}s` }} />)}
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: 13, color: '#c4b5fd', fontStyle: 'italic', lineHeight: 1.5 }}>"{coachNote}"</p>
            )}
          </div>
        </div>
      )}

      {/* ── ERROR ── */}
      {error && (
        <div style={{ margin: '0 20px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 14, padding: '12px 16px', color: '#f87171', fontSize: 13, textAlign: 'center' }}>
          {error}
        </div>
      )}

      {/* ── EXERCISE CARDS ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 20px' }}>
        {activePlan.exercises.map((ex, exIdx) => {
          const isExpanded = expandedIdx === exIdx;
          const sets = logs[exIdx] || [];
          const allDone = sets.length > 0 && sets.every(s => s.done);
          const lastData = formatLast(exIdx);

          return (
            <div key={exIdx} style={{
              background: '#111118',
              border: `1px solid ${isExpanded ? 'rgba(139,92,246,0.5)' : allDone ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.07)'}`,
              borderRadius: 20,
              overflow: 'hidden',
              boxShadow: isExpanded ? '0 0 24px rgba(109,40,217,0.15)' : 'none',
              transition: 'border-color 0.2s, box-shadow 0.2s',
            }}>

              {/* Card header row */}
              <button
                onClick={() => setExpandedIdx(isExpanded ? null : exIdx)}
                style={{ width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' }}
              >
                {/* Number circle */}
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                  border: `2px solid ${allDone ? '#34d399' : '#6d28d9'}`,
                  background: allDone ? 'rgba(52,211,153,0.1)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 800, color: allDone ? '#34d399' : '#a78bfa',
                }}>
                  {allDone ? '✓' : exIdx + 1}
                </div>

                {/* Exercise photo */}
                <ExercisePhoto name={ex.name} size={68} />

                {/* Name + sets/reps */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>{ex.name}</p>
                  <span style={{ display: 'inline-block', marginTop: 6, fontSize: 10, fontWeight: 700, color: '#9ca3af', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '3px 10px', letterSpacing: '0.04em' }}>
                    {ex.sets} SETS · {ex.reps} REPS
                  </span>
                </div>

                {/* Chevron */}
                <span style={{ color: '#6b7280', fontSize: 16, flexShrink: 0 }}>
                  {isExpanded ? '∧' : '∨'}
                </span>
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div style={{ borderTop: '1px solid rgba(139,92,246,0.15)', padding: '12px 16px 16px' }}>

                  {/* Last session reference */}
                  {lastData && (
                    <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 10 }}>
                      <span style={{ fontSize: 10, color: '#6b7280', fontWeight: 600, letterSpacing: '0.06em' }}>LAST TIME: </span>
                      <span style={{ fontSize: 11, color: '#34d399', fontWeight: 700, fontFamily: 'monospace' }}>{lastData}</span>
                    </div>
                  )}

                  {/* Set rows */}
                  {sets.map((set, setIdx) => (
                    <div key={setIdx} style={{
                      display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10,
                      padding: '10px 12px',
                      background: set.done ? 'rgba(52,211,153,0.05)' : setIdx === 0 ? 'rgba(109,40,217,0.08)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${set.done ? 'rgba(52,211,153,0.2)' : setIdx === 0 ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.06)'}`,
                      borderRadius: 14,
                    }}>
                      {/* Set label */}
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#a78bfa', width: 36, flexShrink: 0, letterSpacing: '0.04em' }}>
                        SET {setIdx + 1}
                      </span>

                      {/* KG input */}
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: '0 0 3px', fontSize: 9, color: '#6b7280', fontWeight: 700, letterSpacing: '0.06em' }}>KG</p>
                        <input
                          type="number"
                          placeholder="0"
                          value={set.kg}
                          onChange={(e) => updateSet(exIdx, setIdx, 'kg', e.target.value)}
                          style={{
                            width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 10, padding: '8px 10px', color: '#fff', fontSize: 18, fontWeight: 800,
                            outline: 'none', fontFamily: 'monospace', boxSizing: 'border-box',
                          }}
                        />
                      </div>

                      {/* REPS input */}
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: '0 0 3px', fontSize: 9, color: '#6b7280', fontWeight: 700, letterSpacing: '0.06em' }}>REPS</p>
                        <input
                          type="number"
                          placeholder="0"
                          value={set.reps}
                          onChange={(e) => updateSet(exIdx, setIdx, 'reps', e.target.value)}
                          style={{
                            width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 10, padding: '8px 10px', color: '#fff', fontSize: 18, fontWeight: 800,
                            outline: 'none', fontFamily: 'monospace', boxSizing: 'border-box',
                          }}
                        />
                      </div>

                      {/* Done tick */}
                      <button
                        onClick={() => toggleDone(exIdx, setIdx)}
                        style={{
                          width: 40, height: 40, borderRadius: '50%', flexShrink: 0, border: 'none', cursor: 'pointer',
                          background: set.done ? 'linear-gradient(135deg, #6d28d9, #4f46e5)' : 'rgba(255,255,255,0.06)',
                          color: set.done ? '#fff' : '#4b5563',
                          fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'background 0.2s',
                        }}
                      >
                        ✓
                      </button>
                    </div>
                  ))}

                  {/* Add set */}
                  <button
                    onClick={() => addSet(exIdx)}
                    style={{
                      width: '100%', background: 'transparent', border: 'none', cursor: 'pointer',
                      color: '#a78bfa', fontSize: 13, fontWeight: 700, letterSpacing: '0.04em',
                      padding: '10px 0 2px', textAlign: 'center',
                    }}
                  >
                    + ADD SET
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── BOTTOM BUTTONS ── */}
      <div style={{
        position: 'fixed', bottom: 70, left: 0, right: 0,
        padding: '12px 20px',
        background: 'linear-gradient(to top, #08080F 60%, transparent)',
        display: 'flex', gap: 12, zIndex: 50,
      }}>
        <button
          onClick={() => router.push('/coach')}
          style={{
            flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 16, padding: '16px 0', color: '#e2e8f0',
            fontSize: 13, fontWeight: 800, letterSpacing: '0.05em', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <span style={{ fontSize: 16 }}>⊕</span> ADD EXERCISE
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            flex: 2,
            background: saved ? 'linear-gradient(135deg, #059669, #10b981)' : 'linear-gradient(135deg, #6d28d9, #4f46e5)',
            border: 'none', borderRadius: 16, padding: '16px 0',
            color: '#fff', fontSize: 13, fontWeight: 800, letterSpacing: '0.05em',
            cursor: saving ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            opacity: saving ? 0.7 : 1,
            boxShadow: '0 4px 20px rgba(109,40,217,0.4)',
            transition: 'background 0.3s',
          }}
        >
          <span style={{ fontSize: 16 }}>💾</span>
          {saved ? 'SAVED!' : saving ? 'SAVING...' : 'SAVE WORKOUT'}
        </button>
      </div>

      <BottomNav />
    </div>
  );
}
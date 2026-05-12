'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMsal } from '@azure/msal-react';
import BottomNav from '@/components/BottomNav';

const API_URL = 'https://gymdogs-api-g9d0gve4angygdcj.newzealandnorth-01.azurewebsites.net/api/gymLogs';
const API_KEY = process.env.NEXT_PUBLIC_API_KEY;
const PLANS_API_URL = 'https://gymdogs-api-g9d0gve4angygdcj.newzealandnorth-01.azurewebsites.net/api/workoutPlans';
const PLANS_API_KEY = process.env.NEXT_PUBLIC_PLANS_API_KEY;

const TODAY = new Date().toISOString().split('T')[0]; // e.g. "2026-05-12"

export default function WorkoutPage() {
  const router = useRouter();
  const { accounts, inProgress } = useMsal();
  const [userId, setUserId] = useState(null);

  const [activePlan, setActivePlan] = useState(null);
  const [planLoading, setPlanLoading] = useState(true);
  const [planError, setPlanError] = useState(null);

  const [logs, setLogs] = useState({});
  const [lastSession, setLastSession] = useState({});
  const [activeGuide, setActiveGuide] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  // Auth guard
  useEffect(() => {
    if (inProgress !== 'none') return;
    if (accounts.length === 0) {
      router.push('/login');
      return;
    }
    setUserId(accounts[0].localAccountId);
  }, [accounts, inProgress, router]);

  // Fetch active plan
  useEffect(() => {
    if (!userId) return;
    const fetchPlan = async () => {
      try {
        const res = await fetch(PLANS_API_URL, {
          headers: { 'x-functions-key': PLANS_API_KEY }
        });
        if (res.ok) {
          const data = await res.json();
          setActivePlan(data);
          // Init empty logs for each exercise
          const emptyLogs = {};
          data.exercises.forEach((ex, idx) => {
            emptyLogs[idx] = Array(ex.sets).fill(null).map(() => ({ kg: '', reps: '', done: false }));
          });
          setLogs(emptyLogs);
        } else {
          setPlanError('No active session found. Ask your coach to publish one!');
        }
      } catch (e) {
        setPlanError('Could not load session. Please try again.');
      } finally {
        setPlanLoading(false);
      }
    };
    fetchPlan();
  }, [userId]);

// Fetch last session data by exercise name
  useEffect(() => {
    if (!userId || !activePlan) return;
    const fetchLastSession = async () => {
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
              if (data.length > 0) {
                results[idx] = JSON.parse(data[0].sets_data || '[]');
              }
            }
          })
        );
        setLastSession(results);
      } catch (e) {
        console.log('No last session data');
      }
    };
    fetchLastSession();
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

  const handleSave = async () => {
    if (!userId || !activePlan) return;
    setSaving(true);
    setError(null);
    try {
      const saves = activePlan.exercises.map((ex, idx) =>
        fetch(API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-functions-key': API_KEY
          },
          body: JSON.stringify({
            userId,
            planId: activePlan.id,
            planName: activePlan.name,
            date: TODAY,
            exIdx: idx,
            exName: ex.name,
            sets_data: JSON.stringify(logs[idx] || [])
          })
        })
      );
      await Promise.all(saves);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const formatLastSession = (exIdx) => {
    const sets = lastSession[exIdx];
    if (!sets || sets.length === 0) return null;
    return sets
      .filter(s => s.kg || s.reps)
      .map(s => `${s.kg || '?'}kg × ${s.reps || '?'}`)
      .join(', ');
  };

  if (!userId) return null;

  // Loading state
  if (planLoading) {
    return (
      <div className="min-h-screen bg-[#080C14] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">💪</div>
          <p className="text-slate-400 tracking-wider">Loading your session...</p>
        </div>
      </div>
    );
  }

  // No active plan
  if (planError || !activePlan) {
    return (
      <div className="min-h-screen bg-[#080C14] text-white flex items-center justify-center px-5">
        <div className="text-center">
          <div className="text-4xl mb-4">📋</div>
          <p className="text-white font-bold text-lg mb-2">No Active Session</p>
          <p className="text-slate-400 text-sm leading-relaxed">{planError || 'Your coach hasn\'t published a session yet. Check back soon!'}</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="mt-6 bg-gradient-to-r from-blue-500 to-violet-600 rounded-2xl px-6 py-3 text-sm font-bold tracking-wider"
          >
            Back to Dashboard
          </button>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080C14] text-white pb-32">

      {/* Header */}
      <div className="px-5 pt-12 pb-4 bg-gradient-to-b from-blue-500/10 to-transparent">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="w-9 h-9 bg-white/6 rounded-xl flex items-center justify-center text-lg"
          >
            ←
          </button>
          <span className="text-xs tracking-[3px] text-slate-500 uppercase">{TODAY}</span>
        </div>
        <h1 className="text-3xl font-black tracking-wider leading-tight uppercase">
          {activePlan.name.split(' ').map((word, i) =>
            i === 0
              ? <span key={i}>{word} </span>
              : <span key={i} className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">{word} </span>
          )}
        </h1>
        <div className="flex gap-2 mt-3 flex-wrap">
          <span className="bg-blue-500/15 border border-blue-500/30 text-blue-400 rounded-full px-3 py-1 text-xs font-bold tracking-wider">
            {activePlan.tag}
          </span>
          <span className="bg-white/6 border border-white/10 text-slate-400 rounded-full px-3 py-1 text-xs font-bold tracking-wider">
            {activePlan.exercises.length} EXERCISES
          </span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-5 mb-4 bg-red-500/10 border border-red-500/20 rounded-2xl p-3 text-red-400 text-sm text-center">
          {error}
        </div>
      )}

      {/* Exercises */}
      <div className="px-5 flex flex-col gap-4 mt-2">
        {activePlan.exercises.map((ex, exIdx) => (
          <div key={exIdx} className="bg-white/4 border border-white/8 rounded-3xl overflow-hidden">

            {/* Exercise header */}
            <div className="px-4 pt-4 pb-3 flex items-start justify-between border-b border-white/5">
              <div>
                <h3 className="font-bold text-base leading-tight">{ex.name}</h3>
                <p className="text-xs text-slate-500 mt-1">{ex.sets} sets · {ex.reps} reps</p>
              </div>
              {ex.cue && (
                <button
                  onClick={() => setActiveGuide(activeGuide === exIdx ? null : exIdx)}
                  className="bg-blue-500/12 border border-blue-500/20 rounded-xl px-3 py-2 text-xs text-blue-400 font-bold tracking-wider flex-shrink-0 ml-2"
                >
                  ▶ Guide
                </button>
              )}
            </div>

            {/* Guide dropdown */}
            {activeGuide === exIdx && ex.cue && (
              <div className="px-4 py-3 bg-blue-500/5 border-b border-blue-500/10">
                <p className="text-xs text-blue-300 leading-relaxed">🎯 {ex.cue}</p>
              </div>
            )}

            {/* Sets table */}
            <div className="px-4 py-3">
              <div className="grid grid-cols-4 gap-2 mb-2">
                {['SET', 'KG', 'REPS', ''].map((h) => (
                  <p key={h} className="text-xs tracking-widest text-slate-600 uppercase text-center">{h}</p>
                ))}
              </div>

              {(logs[exIdx] || []).map((set, idx) => (
                <div key={idx} className="grid grid-cols-4 gap-2 mb-2 items-center">
                  <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-xs text-slate-500 font-mono mx-auto">
                    {idx + 1}
                  </div>
                  <input
                    type="number"
                    placeholder="—"
                    value={set.kg}
                    onChange={(e) => updateSet(exIdx, idx, 'kg', e.target.value)}
                    className={`w-full text-center py-2 rounded-xl text-sm font-bold font-mono outline-none border ${
                      set.kg ? 'bg-blue-500/8 border-blue-500/30 text-blue-400' : 'bg-white/5 border-white/10 text-slate-400'
                    }`}
                  />
                  <input
                    type="number"
                    placeholder="—"
                    value={set.reps}
                    onChange={(e) => updateSet(exIdx, idx, 'reps', e.target.value)}
                    className={`w-full text-center py-2 rounded-xl text-sm font-bold font-mono outline-none border ${
                      set.reps ? 'bg-blue-500/8 border-blue-500/30 text-blue-400' : 'bg-white/5 border-white/10 text-slate-400'
                    }`}
                  />
                  <button
                    onClick={() => toggleDone(exIdx, idx)}
                    className={`w-8 h-8 rounded-xl flex items-center justify-center mx-auto text-sm transition-all ${
                      set.done ? 'bg-teal-500/15 text-teal-400' : 'bg-white/4 border border-dashed border-white/15 text-transparent'
                    }`}
                  >
                    ✓
                  </button>
                </div>
              ))}
            </div>

            {/* Last session reference */}
            <div className="px-4 py-3 border-t border-white/5 flex items-center gap-2">
              <span className="text-xs text-slate-600 tracking-wider">Last time:</span>
              {formatLastSession(exIdx) ? (
                <span className="text-xs text-teal-400 font-mono">{formatLastSession(exIdx)}</span>
              ) : (
                <span className="text-xs text-slate-600">No data yet</span>
              )}
            </div>

          </div>
        ))}
      </div>

      {/* Save button */}
      <div className="fixed bottom-20 left-5 right-5 z-20">
        <button
          onClick={handleSave}
          disabled={saving}
          className={`w-full py-4 rounded-2xl font-bold text-sm tracking-widest shadow-lg transition-all ${
            saved
              ? 'bg-teal-500 shadow-teal-500/30'
              : saving
              ? 'bg-white/10 text-slate-500'
              : 'bg-gradient-to-r from-blue-500 to-violet-600 shadow-blue-500/30'
          }`}
        >
          {saved ? '✅ SESSION SAVED!' : saving ? 'SAVING...' : '💾 SAVE SESSION'}
        </button>
      </div>

      <BottomNav />
    </div>
  );
}
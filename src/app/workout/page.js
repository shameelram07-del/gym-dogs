'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMsal } from '@azure/msal-react';
import BottomNav from '@/components/BottomNav';

const API_URL = 'https://gymdogs-api-g9d0gve4angygdcj.newzealandnorth-01.azurewebsites.net/api/gymLogs';
const API_KEY = process.env.NEXT_PUBLIC_API_KEY;

const WEEK = 3;
const DAY = 'monday';

const exercises = [
  {
    id: 1,
    name: 'Incline Dumbbell Press',
    detail: '3 sets · 10-12 reps · 45° incline',
    sets: 3,
    safe: true,
    guide: '🎯 Keep elbows at 45 degrees. Control the descent — 3 seconds down. Drive up and squeeze at the top. Keep lower back pressed to the bench throughout.'
  },
  {
    id: 2,
    name: 'Cable Lateral Raise',
    detail: '3 sets · 15 reps · each side',
    sets: 3,
    safe: true,
    guide: '🎯 Lead with your elbow, not your wrist. Stop at shoulder height. Keep a slight bend in the elbow throughout.'
  },
  {
    id: 3,
    name: 'Machine Chest Press',
    detail: '3 sets · 12 reps',
    sets: 3,
    safe: true,
    guide: '🎯 Keep your back flat against the pad. Drive through your chest. Control the return — dont let the weight slam.'
  }
];

const emptyLogs = () =>
  exercises.reduce((acc, ex) => {
    acc[ex.id] = Array(ex.sets).fill(null).map(() => ({ kg: '', reps: '', done: false }));
    return acc;
  }, {});

export default function WorkoutPage() {
  const router = useRouter();
  const { accounts } = useMsal();
  const [logs, setLogs] = useState(emptyLogs());
  const [lastWeek, setLastWeek] = useState({});
  const [activeGuide, setActiveGuide] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userId, setUserId] = useState(null);

  // Auth guard + get real user ID
  useEffect(() => {
    if (accounts.length === 0) {
      router.push('/login');
      return;
    }
    const user = accounts[0];
    setUserId(user.localAccountId);
  }, [accounts, router]);

  // Fetch last week data once we have the userId
  useEffect(() => {
    if (!userId) return;
    const fetchLastWeek = async () => {
      try {
        const res = await fetch(
          `${API_URL}?userId=${userId}&week=${WEEK - 1}&day=${DAY}`,
          { headers: { 'x-functions-key': API_KEY } }
        );
        if (res.ok) {
          const data = await res.json();
          const map = {};
          data.forEach((log) => {
            map[log.exIdx] = JSON.parse(log.sets_data || '[]');
          });
          setLastWeek(map);
        }
      } catch (e) {
        console.log('Could not load last week data:', e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchLastWeek();
  }, [userId]);

  const updateSet = (exId, setIdx, field, value) => {
    setLogs(prev => {
      const updated = [...prev[exId]];
      updated[setIdx] = { ...updated[setIdx], [field]: value };
      return { ...prev, [exId]: updated };
    });
  };

  const toggleDone = (exId, setIdx) => {
    setLogs(prev => {
      const updated = [...prev[exId]];
      updated[setIdx] = { ...updated[setIdx], done: !updated[setIdx].done };
      return { ...prev, [exId]: updated };
    });
  };

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    setError(null);
    try {
      const saves = exercises.map((ex, idx) =>
        fetch(API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-functions-key': API_KEY
          },
          body: JSON.stringify({
            userId: userId,
            week: WEEK,
            day: DAY,
            exIdx: idx,
            sets_data: JSON.stringify(logs[ex.id])
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

  const formatLastWeek = (exIdx) => {
    const sets = lastWeek[exIdx];
    if (!sets || sets.length === 0) return null;
    return sets
      .filter(s => s.kg || s.reps)
      .map(s => `${s.kg || '?'}kg × ${s.reps || '?'}`)
      .join(', ');
  };

  // Show nothing while checking auth
  if (!userId) return null;

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
          <span className="text-xs tracking-[3px] text-slate-500 uppercase">Monday · Week {WEEK}</span>
        </div>
        <h1 className="text-3xl font-black tracking-wider leading-tight">
          CHEST & <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">SHOULDERS</span>
        </h1>
        <div className="flex gap-2 mt-3 flex-wrap">
          <span className="bg-blue-500/15 border border-blue-500/30 text-blue-400 rounded-full px-3 py-1 text-xs font-bold tracking-wider">STRENGTH</span>
          <span className="bg-white/6 border border-white/10 text-slate-400 rounded-full px-3 py-1 text-xs font-bold tracking-wider">WEEK {WEEK}</span>
          <span className="bg-teal-500/10 border border-teal-500/20 text-teal-400 rounded-full px-3 py-1 text-xs font-bold tracking-wider">💚 DISC SAFE</span>
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
        {exercises.map((ex, exIdx) => (
          <div key={ex.id} className="bg-white/4 border border-white/8 rounded-3xl overflow-hidden">

            {/* Exercise header */}
            <div className="px-4 pt-4 pb-3 flex items-start justify-between border-b border-white/5">
              <div>
                <h3 className="font-bold text-base leading-tight">{ex.name}</h3>
                <p className="text-xs text-slate-500 mt-1">{ex.detail}</p>
              </div>
              <button
                onClick={() => setActiveGuide(activeGuide === ex.id ? null : ex.id)}
                className="bg-blue-500/12 border border-blue-500/20 rounded-xl px-3 py-2 text-xs text-blue-400 font-bold tracking-wider flex-shrink-0 ml-2"
              >
                ▶ Guide
              </button>
            </div>

            {/* Guide dropdown */}
            {activeGuide === ex.id && (
              <div className="px-4 py-3 bg-blue-500/5 border-b border-blue-500/10">
                <p className="text-xs text-blue-300 leading-relaxed">{ex.guide}</p>
              </div>
            )}

            {/* Sets table */}
            <div className="px-4 py-3">
              <div className="grid grid-cols-4 gap-2 mb-2">
                {['SET', 'KG', 'REPS', ''].map((h) => (
                  <p key={h} className="text-xs tracking-widest text-slate-600 uppercase text-center">{h}</p>
                ))}
              </div>

              {logs[ex.id].map((set, idx) => (
                <div key={idx} className="grid grid-cols-4 gap-2 mb-2 items-center">
                  <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-xs text-slate-500 font-mono mx-auto">
                    {idx + 1}
                  </div>
                  <input
                    type="number"
                    placeholder="—"
                    value={set.kg}
                    onChange={(e) => updateSet(ex.id, idx, 'kg', e.target.value)}
                    className={`w-full text-center py-2 rounded-xl text-sm font-bold font-mono outline-none border ${
                      set.kg ? 'bg-blue-500/8 border-blue-500/30 text-blue-400' : 'bg-white/5 border-white/10 text-slate-400'
                    }`}
                  />
                  <input
                    type="number"
                    placeholder="—"
                    value={set.reps}
                    onChange={(e) => updateSet(ex.id, idx, 'reps', e.target.value)}
                    className={`w-full text-center py-2 rounded-xl text-sm font-bold font-mono outline-none border ${
                      set.reps ? 'bg-blue-500/8 border-blue-500/30 text-blue-400' : 'bg-white/5 border-white/10 text-slate-400'
                    }`}
                  />
                  <button
                    onClick={() => toggleDone(ex.id, idx)}
                    className={`w-8 h-8 rounded-xl flex items-center justify-center mx-auto text-sm transition-all ${
                      set.done ? 'bg-teal-500/15 text-teal-400' : 'bg-white/4 border border-dashed border-white/15 text-transparent'
                    }`}
                  >
                    ✓
                  </button>
                </div>
              ))}
            </div>

            {/* Last week reference */}
            <div className="px-4 py-3 border-t border-white/5 flex items-center gap-2">
              <span className="text-xs text-slate-600 tracking-wider">Last week:</span>
              {loading ? (
                <span className="text-xs text-slate-600">Loading...</span>
              ) : formatLastWeek(exIdx) ? (
                <span className="text-xs text-teal-400 font-mono">{formatLastWeek(exIdx)}</span>
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
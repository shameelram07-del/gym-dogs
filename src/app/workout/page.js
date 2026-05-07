'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import BottomNav from '@/components/BottomNav';

const exercises = [
  {
    id: 1,
    name: 'Incline Dumbbell Press',
    detail: '3 sets · 10-12 reps · 45° incline',
    lastWeek: '20kg × 12, 12, 10',
    increase: '+2.5kg',
    sets: 3,
    safe: true
  },
  {
    id: 2,
    name: 'Cable Lateral Raise',
    detail: '3 sets · 15 reps · each side',
    lastWeek: '8kg × 15, 15, 14',
    increase: null,
    sets: 3,
    safe: true
  },
  {
    id: 3,
    name: 'Machine Chest Press',
    detail: '3 sets · 12 reps',
    lastWeek: '60kg × 12, 12, 11',
    increase: '+5kg',
    sets: 3,
    safe: true
  }
];

export default function WorkoutPage() {
  const router = useRouter();
  const [logs, setLogs] = useState(
    exercises.reduce((acc, ex) => {
      acc[ex.id] = Array(ex.sets).fill({ kg: '', reps: '', done: false });
      return acc;
    }, {})
  );

  const [activeGuide, setActiveGuide] = useState(null);
  const [saved, setSaved] = useState(false);

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

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

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
          <span className="text-xs tracking-[3px] text-slate-500 uppercase">Monday · Week 3</span>
        </div>
        <h1 className="text-3xl font-black tracking-wider leading-tight">
          CHEST & <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">SHOULDERS</span>
        </h1>
        <div className="flex gap-2 mt-3 flex-wrap">
          <span className="bg-blue-500/15 border border-blue-500/30 text-blue-400 rounded-full px-3 py-1 text-xs font-bold tracking-wider">STRENGTH</span>
          <span className="bg-white/6 border border-white/10 text-slate-400 rounded-full px-3 py-1 text-xs font-bold tracking-wider">WEEK 3</span>
          <span className="bg-teal-500/10 border border-teal-500/20 text-teal-400 rounded-full px-3 py-1 text-xs font-bold tracking-wider">💚 DISC SAFE</span>
        </div>
      </div>

      {/* Exercises */}
      <div className="px-5 flex flex-col gap-4 mt-2">
        {exercises.map((ex) => (
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
                <p className="text-xs text-blue-300 leading-relaxed">
                  🎯 Keep elbows pinned. Control the descent — 3 seconds down. Drive up and squeeze at the top. Keep lower back pressed to the bench throughout.
                </p>
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
              <span className="text-xs text-teal-400 font-mono">{ex.lastWeek}</span>
              {ex.increase && (
                <span className="ml-auto text-xs text-teal-400 font-bold">↑ {ex.increase}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Save button */}
      <div className="fixed bottom-20 left-5 right-5 z-20">
        <button
          onClick={handleSave}
          className={`w-full py-4 rounded-2xl font-bold text-sm tracking-widest shadow-lg transition-all ${
            saved ? 'bg-teal-500 shadow-teal-500/30' : 'bg-gradient-to-r from-blue-500 to-violet-600 shadow-blue-500/30'
          }`}
        >
          {saved ? '✅ SESSION SAVED!' : '💾 SAVE SESSION'}
        </button>
      </div>

      <BottomNav />
    </div>
  );
}
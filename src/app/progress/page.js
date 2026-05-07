'use client';

import { useState } from 'react';
import BottomNav from '@/components/BottomNav';

const weeklyData = [
  { week: 'W1', volume: 35 },
  { week: 'W2', volume: 55 },
  { week: 'W3', volume: 75 },
  { week: 'W4', volume: 20, future: true },
];

const prs = [
  { exercise: 'Incline DB Press', weight: '22.5kg', date: 'Today', isNew: true },
  { exercise: 'Cable Lateral Raise', weight: '10kg', date: '2 weeks ago', isNew: false },
  { exercise: 'Machine Chest Press', weight: '75kg', date: '1 week ago', isNew: false },
];

const bodyAreas = ['Chest', 'Shoulders', 'Back', 'Legs', 'Core', 'Arms'];
const levels = ['none', 'mild', 'moderate', 'severe'];

const getLevelStyle = (level) => {
  if (level === 'mild') return { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', dot: '🟡' };
  if (level === 'moderate') return { color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20', dot: '🟠' };
  if (level === 'severe') return { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', dot: '🔴' };
  return { color: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/20', dot: '🟢' };
};

export default function ProgressPage() {
  const [sorenessLevels, setSorenessLevels] = useState(
    bodyAreas.reduce((acc, area) => ({ ...acc, [area]: 'none' }), {})
  );

  const cycleLevel = (area) => {
    setSorenessLevels(prev => {
      const current = prev[area];
      const next = levels[(levels.indexOf(current) + 1) % levels.length];
      return { ...prev, [area]: next };
    });
  };

  return (
    <div className="min-h-screen bg-[#080C14] text-white pb-24">

      <div className="px-5 pt-12 pb-4 bg-gradient-to-b from-teal-500/10 to-transparent">
        <p className="text-xs tracking-[3px] text-slate-500 uppercase">Week 3 - Month 1</p>
        <h1 className="text-3xl font-black tracking-wider mt-1">
          MY <span className="bg-gradient-to-r from-teal-400 to-blue-400 bg-clip-text text-transparent">PROGRESS</span>
        </h1>
      </div>

      <div className="px-5 flex flex-col gap-4">

        <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/5 border border-yellow-500/20 rounded-3xl p-4 flex items-center gap-4">
          <span className="text-4xl">🏆</span>
          <div className="flex-1">
            <p className="font-bold text-base">New Personal Record!</p>
            <p className="text-xs text-slate-400 mt-1">Incline DB Press - Today</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black text-yellow-400 leading-none">22.5</p>
            <p className="text-xs text-slate-500">kg</p>
          </div>
        </div>

        <div className="bg-white/4 border border-white/8 rounded-3xl p-4">
          <div className="flex justify-between items-center mb-4">
            <p className="text-xs tracking-[3px] text-slate-500 uppercase">Weekly Volume</p>
            <p className="text-2xl font-black text-teal-400">4,200<span className="text-sm text-slate-500 font-normal ml-1">kg</span></p>
          </div>
          <div className="flex items-end gap-3 h-20">
            {weeklyData.map((d) => (
              <div key={d.week} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                <div
                  className={`w-full rounded-t-lg ${d.future ? 'opacity-20' : ''} ${d.week === 'W3' ? 'bg-gradient-to-t from-blue-500 to-violet-500' : 'bg-white/15'}`}
                  style={{ height: `${d.volume}%` }}
                />
                <p className="text-xs text-slate-600">{d.week}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white/4 border border-white/8 rounded-3xl p-4">
          <div className="flex justify-between items-center mb-4">
            <p className="text-xs tracking-[3px] text-slate-500 uppercase">Soreness Check-in</p>
            <p className="text-xs text-blue-400">Tap to update</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {bodyAreas.map((area) => {
              const style = getLevelStyle(sorenessLevels[area]);
              return (
                <button
                  key={area}
                  onClick={() => cycleLevel(area)}
                  className={`${style.bg} border ${style.border} rounded-2xl px-3 py-3 flex items-center gap-2`}
                >
                  <span className="text-base">{style.dot}</span>
                  <div className="text-left">
                    <p className={`text-sm font-bold ${style.color}`}>{area}</p>
                    <p className="text-xs text-slate-600 capitalize">{sorenessLevels[area]}</p>
                  </div>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-slate-600 text-center mt-3">Green None - Yellow Mild - Orange Moderate - Red Severe</p>
        </div>

        <p className="text-xs tracking-[3px] text-slate-500 uppercase">Personal Records</p>
        <div className="bg-white/4 border border-white/8 rounded-3xl overflow-hidden">
          {prs.map((pr, i) => (
            <div key={i} className={`flex items-center gap-3 px-4 py-3 ${i < prs.length - 1 ? 'border-b border-white/5' : ''}`}>
              <span className="text-xl">🏅</span>
              <div className="flex-1">
                <p className="text-sm font-semibold">{pr.exercise}</p>
                <p className="text-xs text-slate-500 mt-0.5">{pr.date}</p>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-black text-teal-400 font-mono">{pr.weight}</p>
                {pr.isNew && <span className="bg-yellow-500/15 border border-yellow-500/30 text-yellow-400 text-xs px-2 py-0.5 rounded-full font-bold">NEW</span>}
              </div>
            </div>
          ))}
        </div>

        <div className="bg-violet-500/8 border border-violet-500/15 rounded-3xl p-4 flex gap-3 items-start">
          <span className="text-2xl">🧠</span>
          <div>
            <p className="text-sm font-bold text-violet-300">AI Recovery Note</p>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">You have trained hard for 3 weeks. Consider a lighter deload week next week to maximise long term progress.</p>
          </div>
        </div>

      </div>

      <BottomNav />
    </div>
  );
}
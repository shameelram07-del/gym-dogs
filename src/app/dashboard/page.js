'use client';

import { useState } from 'react';

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState('home');

  return (
    <div className="min-h-screen bg-[#080C14] text-white relative overflow-hidden">
      
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-0 w-64 h-64 bg-violet-500/8 rounded-full blur-3xl" />
      </div>

      {/* HEADER */}
      <div className="relative z-10 px-5 pt-12 pb-4 bg-gradient-to-b from-blue-500/10 to-transparent">
        <p className="text-xs tracking-[3px] text-slate-500 uppercase">Good morning</p>
        <div className="flex items-center justify-between mt-1">
          <h1 className="text-3xl font-black tracking-wider">
            SHAMEEL <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">💪</span>
          </h1>
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-sm font-bold">
            ST
          </div>
        </div>

        {/* Readiness bar */}
        <div className="mt-4 flex items-center gap-3 bg-white/4 border border-white/8 rounded-2xl p-3">
          <div className="text-3xl font-black text-teal-400 font-mono leading-none">87</div>
          <div>
            <p className="text-sm font-semibold text-white">Ready to Train</p>
            <p className="text-xs tracking-widest text-slate-500 uppercase">Readiness Score</p>
          </div>
          <div className="ml-auto text-3xl">🏃</div>
        </div>
      </div>

      {/* SCROLLABLE CONTENT */}
      <div className="relative z-10 px-5 pb-24 flex flex-col gap-4 overflow-y-auto">

        {/* Today's session card */}
        <p className="text-xs tracking-[3px] text-slate-500 uppercase mt-2">Today's Session</p>
        <div className="relative bg-gradient-to-br from-blue-500 to-violet-600 rounded-3xl p-5 overflow-hidden">
          <div className="absolute right-4 bottom-0 text-7xl opacity-20">💪</div>
          <p className="text-xs tracking-widest opacity-80 uppercase">Monday · Week 3</p>
          <h2 className="text-3xl font-black tracking-wider mt-1 leading-tight">
            CHEST &<br />SHOULDERS
          </h2>
          <div className="flex gap-2 mt-3 flex-wrap">
            <span className="bg-white/20 rounded-full px-3 py-1 text-xs font-bold tracking-wider">STRENGTH</span>
            <span className="bg-white/20 rounded-full px-3 py-1 text-xs font-bold tracking-wider">6 EXERCISES</span>
            <span className="bg-white/20 rounded-full px-3 py-1 text-xs font-bold tracking-wider">60 MIN</span>
          </div>
          <button className="mt-4 bg-white text-blue-600 font-bold text-sm tracking-wider px-5 py-2 rounded-xl">
            ▶ START SESSION
          </button>
        </div>

        {/* Stats row */}
        <p className="text-xs tracking-[3px] text-slate-500 uppercase">This Week</p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { val: '3', label: 'Sessions', color: 'text-blue-400' },
            { val: '4.2k', label: 'KG Lifted', color: 'text-teal-400' },
            { val: '🔥5', label: 'Day Streak', color: 'text-orange-400' }
          ].map((stat) => (
            <div key={stat.label} className="bg-white/4 border border-white/8 rounded-2xl p-3 text-center">
              <p className={`text-2xl font-black ${stat.color} leading-none`}>{stat.val}</p>
              <p className="text-xs text-slate-500 tracking-wider mt-1 uppercase">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* AI Coach note */}
        <div className="bg-violet-500/10 border border-violet-500/20 rounded-2xl p-4 flex gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
            SC
          </div>
          <div>
            <p className="text-sm text-slate-300 italic leading-relaxed">
              "Week 3 looking strong — push the bench today, your form has been solid. Add 2.5kg."
            </p>
            <p className="text-xs text-violet-400 font-semibold mt-2 tracking-wider">— Coach Shameel · AI Note</p>
          </div>
        </div>

        {/* Streak card */}
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-4 flex items-center gap-4">
          <span className="text-4xl">🔥</span>
          <div>
            <p className="text-3xl font-black text-orange-400 leading-none">5</p>
            <p className="text-xs text-slate-500 tracking-widest uppercase">Day Streak · Keep it up!</p>
          </div>
        </div>

        {/* Leaderboard preview */}
        <p className="text-xs tracking-[3px] text-slate-500 uppercase">This Week's Leaders</p>
        <div className="bg-white/4 border border-white/8 rounded-2xl overflow-hidden">
          {[
            { rank: '🥇', name: 'Joel', sessions: '5 sessions', me: false },
            { rank: '🥈', name: 'Shameel', sessions: '4 sessions', me: true },
            { rank: '🥉', name: 'Hamish', sessions: '3 sessions', me: false },
            { rank: '4', name: 'Zafi', sessions: '2 sessions', me: false }
          ].map((user) => (
            <div key={user.name} className={`flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0 ${user.me ? 'bg-blue-500/8' : ''}`}>
              <span className="text-lg w-6 text-center">{user.rank}</span>
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                {user.name[0]}
              </div>
              <span className="flex-1 text-sm font-medium">
                {user.name} {user.me && <span className="text-xs text-blue-400">(you)</span>}
              </span>
              <span className="text-sm text-teal-400 font-mono">{user.sessions}</span>
            </div>
          ))}
        </div>

      </div>

      {/* BOTTOM NAV */}
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-[#0E1624]/95 backdrop-blur border-t border-white/7 flex items-center justify-around px-2 py-2">
        {[
          { icon: '🏠', label: 'Home', tab: 'home' },
          { icon: '📋', label: 'Log', tab: 'log' },
          { icon: '📈', label: 'Progress', tab: 'progress' },
          { icon: '🏆', label: 'Community', tab: 'community' },
          { icon: '⚙️', label: 'Profile', tab: 'profile' }
        ].map((item) => (
          <button
            key={item.tab}
            onClick={() => setActiveTab(item.tab)}
            className="flex flex-col items-center gap-1 flex-1 py-1"
          >
            <span className={`text-xl ${activeTab === item.tab ? 'opacity-100' : 'opacity-40'}`}>
              {item.icon}
            </span>
            {activeTab === item.tab && (
              <div className="w-1 h-1 rounded-full bg-blue-400 shadow-lg shadow-blue-400/50" />
            )}
            <span className={`text-xs tracking-wider ${activeTab === item.tab ? 'text-blue-400' : 'text-slate-600'}`}>
              {item.label}
            </span>
          </button>
        ))}
      </div>

    </div>
  );
}
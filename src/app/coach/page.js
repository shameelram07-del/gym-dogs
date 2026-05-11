'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMsal } from '@azure/msal-react';

const clients = [
  {
    id: 1,
    name: 'Joel',
    initials: 'JM',
    goal: 'Build Muscle',
    readiness: 91,
    streak: 7,
    trainedToday: true,
    alert: null,
    lastSession: 'Chest & Shoulders',
    sessionsThisWeek: 5,
    weight: 84,
  },
  {
    id: 2,
    name: 'Hamish',
    initials: 'HT',
    goal: 'Lose Body Fat',
    readiness: 74,
    streak: 3,
    trainedToday: true,
    alert: null,
    lastSession: 'Lower Body',
    sessionsThisWeek: 3,
    weight: 91,
  },
  {
    id: 3,
    name: 'Zafi',
    initials: 'ZK',
    goal: 'Get Stronger',
    readiness: 58,
    streak: 1,
    trainedToday: false,
    alert: 'Missed 2 sessions',
    lastSession: 'Pull Day',
    sessionsThisWeek: 2,
    weight: 78,
  },
  {
    id: 4,
    name: 'Priya',
    initials: 'PK',
    goal: 'General Health',
    readiness: 45,
    streak: 0,
    trainedToday: false,
    alert: 'Deload recommended',
    lastSession: 'Full Body',
    sessionsThisWeek: 1,
    weight: 62,
  },
  {
    id: 5,
    name: 'Marcus',
    initials: 'MR',
    goal: 'Athletic Performance',
    readiness: 83,
    streak: 5,
    trainedToday: true,
    alert: null,
    lastSession: 'Push Day',
    sessionsThisWeek: 4,
    weight: 88,
  },
];

const getReadinessColor = (score) => {
  if (score >= 80) return 'text-teal-400';
  if (score >= 60) return 'text-blue-400';
  if (score >= 40) return 'text-orange-400';
  return 'text-red-400';
};

const getReadinessBg = (score) => {
  if (score >= 80) return 'bg-teal-500/15 border-teal-500/25';
  if (score >= 60) return 'bg-blue-500/15 border-blue-500/25';
  if (score >= 40) return 'bg-orange-500/15 border-orange-500/25';
  return 'bg-red-500/15 border-red-500/25';
};

const getReadinessLabel = (score) => {
  if (score >= 80) return 'Ready';
  if (score >= 60) return 'Moderate';
  if (score >= 40) return 'Fatigued';
  return 'Rest Day';
};

export default function CoachDashboard() {
  const router = useRouter();
  const { accounts, inProgress } = useMsal();
  const [userId, setUserId] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (inProgress !== 'none') return;
    if (accounts.length === 0) {
      router.push('/login');
      return;
    }
    setUserId(accounts[0].localAccountId);
  }, [accounts, inProgress, router]);

  if (!userId) return null;

  const trainedToday = clients.filter((c) => c.trainedToday).length;
  const alerts = clients.filter((c) => c.alert).length;
  const avgReadiness = Math.round(clients.reduce((a, c) => a + c.readiness, 0) / clients.length);

  const filteredClients = clients.filter((c) => {
    if (filter === 'trained') return c.trainedToday;
    if (filter === 'alerts') return c.alert;
    if (filter === 'rest') return !c.trainedToday;
    return true;
  });

  return (
    <div className="min-h-screen bg-[#080C14] text-white relative overflow-hidden">

      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-0 w-64 h-64 bg-violet-500/8 rounded-full blur-3xl" />
      </div>

      {/* HEADER */}
      <div className="relative z-10 px-5 pt-12 pb-5 bg-gradient-to-b from-blue-500/10 to-transparent">
        <p className="text-xs tracking-[3px] text-slate-500 uppercase">Coach View</p>
        <div className="flex items-center justify-between mt-1">
          <h1 className="text-3xl font-black tracking-wider">
            COACH <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">HQ</span>
          </h1>
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-sm font-bold">
            SC
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3 mt-5">
          {[
            { val: `${trainedToday}/${clients.length}`, label: 'Trained Today', color: 'text-teal-400' },
            { val: avgReadiness, label: 'Avg Readiness', color: 'text-blue-400' },
            { val: alerts, label: 'Alerts', color: alerts > 0 ? 'text-orange-400' : 'text-slate-500' },
          ].map((stat) => (
            <div key={stat.label} className="bg-white/4 border border-white/8 rounded-2xl p-3 text-center">
              <p className={`text-2xl font-black ${stat.color} leading-none`}>{stat.val}</p>
              <p className="text-xs text-slate-500 tracking-wider mt-1 uppercase">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* SCROLLABLE CONTENT */}
      <div className="relative z-10 px-5 pb-24 flex flex-col gap-4 overflow-y-auto">

        {/* Alerts banner */}
        {alerts > 0 && (
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-4">
            <p className="text-xs tracking-[3px] text-orange-400 uppercase mb-2">⚠️ Attention Needed</p>
            <div className="flex flex-col gap-2">
              {clients.filter((c) => c.alert).map((c) => (
                <div key={c.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-xs font-bold">
                      {c.initials}
                    </div>
                    <span className="text-sm text-white font-medium">{c.name}</span>
                  </div>
                  <span className="text-xs text-orange-300 font-semibold tracking-wider">{c.alert}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filter tabs */}
        <p className="text-xs tracking-[3px] text-slate-500 uppercase mt-1">All Clients</p>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {[
            { key: 'all', label: 'All' },
            { key: 'trained', label: '✅ Trained' },
            { key: 'rest', label: '😴 Rest' },
            { key: 'alerts', label: '⚠️ Alerts' },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold tracking-wider uppercase transition-all ${
                filter === f.key
                  ? 'bg-gradient-to-r from-blue-500 to-violet-600 text-white'
                  : 'bg-white/4 border border-white/8 text-slate-400'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Client cards */}
        <div className="flex flex-col gap-3">
          {filteredClients.map((client) => (
            <button
              key={client.id}
              onClick={() => setSelectedClient(selectedClient?.id === client.id ? null : client)}
              className="w-full text-left"
            >
              <div className={`bg-white/4 border rounded-2xl p-4 transition-all duration-200 ${
                selectedClient?.id === client.id
                  ? 'border-blue-500/40 bg-blue-500/5'
                  : 'border-white/8'
              }`}>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {client.initials}
                    </div>
                    <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#080C14] ${client.trainedToday ? 'bg-teal-400' : 'bg-slate-600'}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-black tracking-wider">{client.name.toUpperCase()}</p>
                      {client.alert && <span className="text-orange-400 text-xs">⚠️</span>}
                    </div>
                    <p className="text-xs text-slate-500 tracking-wider">{client.goal}</p>
                  </div>

                  <div className={`rounded-xl px-3 py-1.5 border ${getReadinessBg(client.readiness)}`}>
                    <p className={`text-lg font-black leading-none ${getReadinessColor(client.readiness)}`}>
                      {client.readiness}
                    </p>
                    <p className={`text-xs tracking-wider ${getReadinessColor(client.readiness)}`}>
                      {getReadinessLabel(client.readiness)}
                    </p>
                  </div>
                </div>

                {selectedClient?.id === client.id && (
                  <div className="mt-4 pt-4 border-t border-white/6 flex flex-col gap-3">
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: 'Sessions', val: `${client.sessionsThisWeek}/wk` },
                        { label: 'Streak', val: `🔥${client.streak}` },
                        { label: 'Weight', val: `${client.weight}kg` },
                      ].map((s) => (
                        <div key={s.label} className="bg-white/4 rounded-xl p-2 text-center">
                          <p className="text-sm font-black text-white">{s.val}</p>
                          <p className="text-xs text-slate-500 tracking-wider uppercase mt-0.5">{s.label}</p>
                        </div>
                      ))}
                    </div>
                    <div className="bg-white/4 rounded-xl p-3">
                      <p className="text-xs text-slate-500 tracking-widest uppercase mb-1">Last Session</p>
                      <p className="text-sm font-semibold text-white">{client.lastSession}</p>
                    </div>
                    <div className="flex gap-2">
                      <button className="flex-1 bg-gradient-to-r from-blue-500 to-violet-600 rounded-xl py-2.5 text-xs font-black tracking-widest uppercase">
                        View Full Profile
                      </button>
                      <button className="flex-1 bg-white/4 border border-white/8 rounded-xl py-2.5 text-xs font-black tracking-widest uppercase text-slate-300">
                        Send Message
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
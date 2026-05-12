'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMsal } from '@azure/msal-react';
import BottomNav from '@/components/BottomNav';

const API_URL = 'https://gymdogs-api-g9d0gve4angygdcj.newzealandnorth-01.azurewebsites.net/api/gymLogs';
const API_KEY = process.env.NEXT_PUBLIC_API_KEY;
const PLANS_API_URL = 'https://gymdogs-api-g9d0gve4angygdcj.newzealandnorth-01.azurewebsites.net/api/workoutPlans';
const PLANS_API_KEY = process.env.NEXT_PUBLIC_PLANS_API_KEY;

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function calcStreak(logs) {
  if (!logs || logs.length === 0) return 0;
  const dates = [...new Set(logs.map(l => l.date).filter(Boolean))].sort().reverse();
  if (dates.length === 0) return 0;
  let streak = 0;
  let current = new Date();
  current.setHours(0, 0, 0, 0);
  for (const date of dates) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const diff = Math.round((current - d) / (1000 * 60 * 60 * 24));
    if (diff <= 1) {
      streak++;
      current = d;
    } else {
      break;
    }
  }
  return streak;
}

function calcKgLifted(logs) {
  let total = 0;
  logs.forEach(log => {
    try {
      const sets = JSON.parse(log.sets_data || '[]');
      sets.forEach(s => {
        if (s.kg && s.reps) total += parseFloat(s.kg) * parseFloat(s.reps);
      });
    } catch (e) {}
  });
  if (total >= 1000) return `${(total / 1000).toFixed(1)}k`;
  return `${Math.round(total)}`;
}

function calcSessionsThisWeek(logs) {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const dates = new Set(
    logs.filter(l => l.date && new Date(l.date) >= startOfWeek).map(l => l.date)
  );
  return dates.size;
}

export default function DashboardPage() {
  const router = useRouter();
  const { accounts, inProgress } = useMsal();
  const [userId, setUserId] = useState(null);
  const [userName, setUserName] = useState('');
  const [userInitials, setUserInitials] = useState('');
  const [logs, setLogs] = useState([]);
  const [activePlan, setActivePlan] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (inProgress !== 'none') return;
    if (accounts.length === 0) {
      router.push('/login');
      return;
    }
    const user = accounts[0];
    setUserId(user.localAccountId);

    // Get name from Entra account
   const name = user.name && user.name !== 'unknown' 
  ? user.name 
  : user.username?.split('@')[0] || 'Athlete';
    const firstName = name.split(' ')[0];
    setUserName(firstName.toUpperCase());
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    setUserInitials(initials);
  }, [accounts, inProgress, router]);

  useEffect(() => {
    if (!userId) return;
    const fetchData = async () => {
      try {
        // Fetch all workout logs
        const logsRes = await fetch(`${API_URL}?userId=${userId}`, {
          headers: { 'x-functions-key': API_KEY }
        });
        if (logsRes.ok) {
          const data = await logsRes.json();
          setLogs(data);
        }

        // Fetch active plan
        const planRes = await fetch(PLANS_API_URL, {
          headers: { 'x-functions-key': PLANS_API_KEY }
        });
        if (planRes.ok) {
          const plan = await planRes.json();
          setActivePlan(plan);
        }
      } catch (e) {
        console.log('Error fetching dashboard data:', e.message);
      } finally {
        setStatsLoading(false);
      }
    };
    fetchData();
  }, [userId]);

  if (!userId) return null;

  const sessionsThisWeek = calcSessionsThisWeek(logs);
  const kgLifted = calcKgLifted(logs);
  const streak = calcStreak(logs);

  return (
    <div className="min-h-screen bg-[#080C14] text-white relative overflow-hidden">

      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-0 w-64 h-64 bg-violet-500/8 rounded-full blur-3xl" />
      </div>

      {/* HEADER */}
      <div className="relative z-10 px-5 pt-12 pb-4 bg-gradient-to-b from-blue-500/10 to-transparent">
        <p className="text-xs tracking-[3px] text-slate-500 uppercase">{getGreeting()}</p>
        <div className="flex items-center justify-between mt-1">
          <h1 className="text-3xl font-black tracking-wider">
            {userName} <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">💪</span>
          </h1>
          <button
            onClick={() => router.push('/profile')}
            className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-sm font-bold"
          >
            {userInitials}
          </button>
        </div>

        {/* Readiness bar */}
        <div className="mt-4 flex items-center gap-3 bg-white/4 border border-white/8 rounded-2xl p-3">
          <div className="text-3xl font-black text-teal-400 font-mono leading-none">
            {streak > 0 ? Math.min(100, 70 + streak * 5) : 70}
          </div>
          <div>
            <p className="text-sm font-semibold text-white">
              {streak > 3 ? 'On Fire!' : streak > 0 ? 'Ready to Train' : 'Let\'s Get Started'}
            </p>
            <p className="text-xs tracking-widest text-slate-500 uppercase">Readiness Score</p>
          </div>
          <div className="ml-auto text-3xl">{streak > 3 ? '🔥' : '🏃'}</div>
        </div>
      </div>

      {/* SCROLLABLE CONTENT */}
      <div className="relative z-10 px-5 pb-24 flex flex-col gap-4 overflow-y-auto">

        {/* Today's session card */}
        <p className="text-xs tracking-[3px] text-slate-500 uppercase mt-2">Today's Session</p>
        {activePlan ? (
          <div className="relative bg-gradient-to-br from-blue-500 to-violet-600 rounded-3xl p-5 overflow-hidden">
            <div className="absolute right-4 bottom-0 text-7xl opacity-20">💪</div>
            <p className="text-xs tracking-widest opacity-80 uppercase">{activePlan.date || 'Active Session'}</p>
            <h2 className="text-3xl font-black tracking-wider mt-1 leading-tight uppercase">
              {activePlan.name}
            </h2>
            <div className="flex gap-2 mt-3 flex-wrap">
              <span className="bg-white/20 rounded-full px-3 py-1 text-xs font-bold tracking-wider">{activePlan.tag}</span>
              <span className="bg-white/20 rounded-full px-3 py-1 text-xs font-bold tracking-wider">{activePlan.exercises?.length} EXERCISES</span>
            </div>
            <button
              onClick={() => router.push('/workout')}
              className="mt-4 bg-white text-blue-600 font-bold text-sm tracking-wider px-5 py-2 rounded-xl"
            >
              ▶ START SESSION
            </button>
          </div>
        ) : (
          <div className="relative bg-white/4 border border-white/8 rounded-3xl p-5">
            <p className="text-slate-400 text-sm">No session scheduled yet.</p>
            <p className="text-slate-600 text-xs mt-1">Your coach will push a session soon!</p>
          </div>
        )}

        {/* Stats row */}
        <p className="text-xs tracking-[3px] text-slate-500 uppercase">This Week</p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { val: statsLoading ? '...' : String(sessionsThisWeek), label: 'Sessions', color: 'text-blue-400' },
            { val: statsLoading ? '...' : kgLifted, label: 'KG Lifted', color: 'text-teal-400' },
            { val: statsLoading ? '...' : `🔥${streak}`, label: 'Day Streak', color: 'text-orange-400' }
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
              {streak > 3
                ? `${streak} days straight — you're on a roll. Keep pushing!`
                : streak > 0
                ? `${sessionsThisWeek} session${sessionsThisWeek !== 1 ? 's' : ''} this week. Stay consistent and the results will come.`
                : "Ready to start your journey? Your coach has a session ready for you!"}
            </p>
            <p className="text-xs text-violet-400 font-semibold mt-2 tracking-wider">— Coach Shameel · AI Note</p>
          </div>
        </div>

        {/* Streak card */}
        {streak > 0 && (
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-4 flex items-center gap-4">
            <span className="text-4xl">🔥</span>
            <div>
              <p className="text-3xl font-black text-orange-400 leading-none">{streak}</p>
              <p className="text-xs text-slate-500 tracking-widest uppercase">Day Streak · Keep it up!</p>
            </div>
          </div>
        )}

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

      <BottomNav />

    </div>
  );
}
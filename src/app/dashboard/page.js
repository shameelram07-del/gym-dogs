'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMsal } from '@azure/msal-react';
import BottomNav from '@/components/BottomNav';

const API_URL = 'https://gymdogs-api-g9d0gve4angygdcj.newzealandnorth-01.azurewebsites.net/api/gymLogs';
const API_KEY = process.env.NEXT_PUBLIC_API_KEY;
const PLANS_API_URL = 'https://gymdogs-api-g9d0gve4angygdcj.newzealandnorth-01.azurewebsites.net/api/workoutPlans';
const PLANS_API_KEY = process.env.NEXT_PUBLIC_PLANS_API_KEY;
const PROFILES_URL = 'https://gymdogs-api-g9d0gve4angygdcj.newzealandnorth-01.azurewebsites.net/api/userProfiles';
const PROFILES_KEY = process.env.NEXT_PUBLIC_PROFILES_API_KEY;

// Map userId to their cutout image
const CUTOUT_MAP = {
  '6d765ac9-47b2-4d3f-b36a-9d784015b917': '/images/shameel Cutout.png', // Shameel
};

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning,';
  if (hour < 17) return 'Good afternoon,';
  return 'Good evening,';
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
    if (diff <= 1) { streak++; current = d; } else break;
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
  if (total >= 1000) return `${(total / 1000).toFixed(1)}K`;
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

function calcLevel(logs) {
  const sessions = new Set(logs.map(l => l.date).filter(Boolean)).size;
  return Math.max(1, Math.floor(sessions / 3) + 1);
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
  const [cutout, setCutout] = useState(null);

  useEffect(() => {
    if (inProgress === 'startup') return;
    if (accounts.length === 0) {
      router.push('/login');
      return;
    }
    const user = accounts[0];
    const uid = user.localAccountId;
    setUserId(uid);
    setCutout(CUTOUT_MAP[uid] || null);

    const entraName = user.name && user.name !== 'unknown'
      ? user.name : user.username?.split('@')[0] || 'Athlete';
    const firstName = entraName.split(' ')[0];
    setUserName(firstName.toUpperCase());
    const initials = entraName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    setUserInitials(initials);

    // Load saved display name from CosmosDB
    const fetchProfile = async () => {
      try {
        const res = await fetch(`${PROFILES_URL}?userId=${uid}`, {
          headers: { 'x-functions-key': PROFILES_KEY }
        });
        if (res.ok) {
          const data = await res.json();
          const profile = Array.isArray(data) ? data.find(p => p.userId === uid) : null;
          if (profile && profile.name && profile.name !== uid) {
            setUserName(profile.name.split(' ')[0].toUpperCase());
            setUserInitials(profile.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2));
          }
        }
      } catch (e) {}
    };
    fetchProfile();
  }, [accounts, inProgress, router]);

  useEffect(() => {
    if (!userId) return;
    const fetchData = async () => {
      try {
        const logsRes = await fetch(`${API_URL}?userId=${userId}`, {
          headers: { 'x-functions-key': API_KEY }
        });
        if (logsRes.ok) setLogs(await logsRes.json());

        const planRes = await fetch(PLANS_API_URL, {
          headers: { 'x-functions-key': PLANS_API_KEY }
        });
        if (planRes.ok) setActivePlan(await planRes.json());
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
  const level = calcLevel(logs);
  const xpToNext = Math.max(0, (level * 3 - new Set(logs.map(l => l.date).filter(Boolean)).size) * 100);

  return (
    <div className="min-h-screen bg-[#080C14] text-white relative overflow-hidden">

      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-violet-600/10 rounded-full blur-[80px]" />
        <div className="absolute bottom-1/3 right-0 w-64 h-64 bg-blue-500/8 rounded-full blur-3xl" />
      </div>

      {/* HEADER */}
      <div className="relative z-10 px-5 pt-12 pb-0">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs tracking-[3px] text-slate-500 uppercase">{getGreeting()}</p>
            <h1 className="text-3xl font-black tracking-wider mt-0.5">{userName} 💪</h1>
          </div>
          <div className="flex items-center gap-2 mt-1">
            {/* Streak badge */}
            <div className="flex items-center gap-1.5 bg-white/6 border border-white/10 rounded-2xl px-3 py-2">
              <img src="/images/streak_fire.png" alt="streak" className="w-5 h-5 object-contain" onError={(e) => { e.target.style.display='none'; }} />
              <span className="text-sm font-black text-orange-400">{streak}</span>
              <span className="text-xs text-slate-500 tracking-wider">DAY</span>
            </div>
            {/* Level badge */}
            <div className="flex items-center gap-1.5 bg-white/6 border border-white/10 rounded-2xl px-3 py-2">
              <img src="/images/level_shield.png" alt="level" className="w-5 h-5 object-contain" onError={(e) => { e.target.style.display='none'; }} />
              <span className="text-sm font-black text-violet-400">{level}</span>
            </div>
            {/* Avatar */}
            <button
              onClick={() => router.push('/profile')}
              className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-sm font-bold"
            >
              {userInitials}
            </button>
          </div>
        </div>
      </div>

      {/* SCROLLABLE CONTENT */}
      <div className="relative z-10 px-5 pb-24 flex flex-col gap-4 mt-4 overflow-y-auto">

        {/* Level + XP card */}
        <div className="bg-white/4 border border-white/8 rounded-3xl p-4 flex items-center gap-4">
          <div className="relative flex-shrink-0">
            <img src="/images/level_badge_1.png" alt="level" className="w-14 h-14 object-contain" onError={(e) => { e.target.style.display='none'; }} />
            <span className="absolute inset-0 flex items-center justify-center text-lg font-black text-white">{level}</span>
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-center mb-1">
              <p className="text-xs text-violet-400 font-bold tracking-wider uppercase">Level {level}</p>
              <p className="text-xs text-slate-500">{xpToNext} XP to next</p>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-blue-500 to-violet-500 h-2 rounded-full transition-all"
                style={{ width: `${Math.min(100, 100 - (xpToNext / 300) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {streak > 3 ? "You're on fire! Keep the streak alive." : streak > 0 ? "Let's Keep Going" : "Let's Get Started"}
            </p>
          </div>
        </div>

        {/* Today's session card with cutout */}
        {activePlan ? (
          <div className="relative bg-gradient-to-br from-[#1a1040] via-[#110d30] to-[#0d0a2a] border border-violet-500/20 rounded-3xl overflow-hidden min-h-[220px]">
            {/* Purple glow background */}
            <div className="absolute inset-0 bg-gradient-to-br from-violet-600/20 to-blue-600/10 pointer-events-none" />

            {/* Cutout image */}
            {cutout && (
              <img
                src={cutout}
                alt="Coach"
                className="absolute right-0 bottom-0 h-[210px] object-contain object-bottom z-10 pointer-events-none"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            )}

            {/* Content */}
            <div className="relative z-20 p-5 pr-32">
              <p className="text-xs tracking-[3px] text-violet-400 uppercase font-bold">Today's Workout</p>
              <h2 className="text-2xl font-black tracking-wider mt-1 leading-tight uppercase">
                {activePlan.name}
              </h2>
              <div className="flex gap-2 mt-2 flex-wrap">
                <span className="bg-violet-500/20 border border-violet-500/30 text-violet-300 rounded-full px-3 py-1 text-xs font-bold tracking-wider">{activePlan.tag}</span>
                <span className="bg-white/10 border border-white/10 text-slate-300 rounded-full px-3 py-1 text-xs font-bold tracking-wider">{activePlan.exercises?.length} EXERCISES</span>
              </div>

              {/* Session meta */}
              <div className="flex gap-4 mt-3">
                <div className="flex items-center gap-1.5">
                  <img src="/images/timer.png" alt="" className="w-4 h-4 object-contain" onError={(e) => { e.target.style.display='none'; }} />
                  <span className="text-xs text-slate-400">75 MIN</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <img src="/images/intensity_bolt.png" alt="" className="w-4 h-4 object-contain" onError={(e) => { e.target.style.display='none'; }} />
                  <span className="text-xs text-slate-400">HIGH</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <img src="/images/push_focus_arm.png" alt="" className="w-4 h-4 object-contain" onError={(e) => { e.target.style.display='none'; }} />
                  <span className="text-xs text-slate-400">PUSH</span>
                </div>
              </div>

              <button
                onClick={() => router.push('/workout')}
                className="mt-4 bg-gradient-to-r from-blue-500 to-violet-600 font-black text-sm tracking-widest px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-blue-500/25"
              >
                START SESSION →
              </button>
            </div>
          </div>
        ) : (
          <div className="relative bg-white/4 border border-white/8 rounded-3xl p-5 min-h-[160px] flex items-center">
            {cutout && (
              <img
                src={cutout}
                alt="Coach"
                className="absolute right-0 bottom-0 h-[150px] object-contain object-bottom opacity-40 pointer-events-none"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            )}
            <div>
              <p className="text-xs tracking-[3px] text-slate-500 uppercase">Today's Session</p>
              <p className="text-white font-bold mt-1">No session yet</p>
              <p className="text-slate-500 text-xs mt-1">Your coach will push one soon!</p>
            </div>
          </div>
        )}

        {/* Stats row */}
        <p className="text-xs tracking-[3px] text-slate-500 uppercase">This Week</p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: '/images/log.png', val: statsLoading ? '...' : String(sessionsThisWeek), label: 'Sessions', color: 'text-blue-400', sub: '0% of weekly goal' },
            { icon: '/images/dumbbell.png', val: statsLoading ? '...' : `${kgLifted} KG`, label: 'Lifted', color: 'text-teal-400', sub: '+18% vs last week' },
            { icon: '/images/streak_fire.png', val: statsLoading ? '...' : String(streak), label: 'Day Streak', color: 'text-orange-400', sub: 'Keep it up!' },
          ].map((stat) => (
            <div key={stat.label} className="bg-white/4 border border-white/8 rounded-2xl p-3">
              <img src={stat.icon} alt="" className="w-7 h-7 object-contain mb-2" onError={(e) => { e.target.style.display='none'; }} />
              <p className={`text-xl font-black ${stat.color} leading-none`}>{stat.val}</p>
              <p className="text-xs text-slate-500 tracking-wider mt-0.5 uppercase">{stat.label}</p>
              <p className="text-xs text-slate-600 mt-1">{stat.sub}</p>
            </div>
          ))}
        </div>

        {/* AI Coach note */}
        <div className="bg-violet-500/8 border border-violet-500/15 rounded-2xl p-4 flex gap-3 items-start">
          <img src="/images/chat_bubble_1.png" alt="" className="w-10 h-10 object-contain flex-shrink-0" onError={(e) => { e.target.style.display='none'; }} />
          <div className="flex-1">
            <p className="text-sm text-slate-300 leading-relaxed">
              {streak > 3
                ? `${streak} days straight — you're on a roll. Keep pushing!`
                : streak > 0
                ? `${sessionsThisWeek} session${sessionsThisWeek !== 1 ? 's' : ''} this week. Stay consistent and the results will come.`
                : "Ready to start your journey? Your coach has a session ready for you!"}
            </p>
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-violet-400 font-semibold tracking-wider">— Coach Shameel · AI Coach</p>
              <button className="text-xs text-blue-400 font-bold tracking-wider border border-blue-500/30 rounded-lg px-3 py-1">VIEW MESSAGE</button>
            </div>
          </div>
        </div>

        {/* Leaderboard */}
        <div className="flex items-center justify-between">
          <p className="text-xs tracking-[3px] text-slate-500 uppercase">This Week's Leaders</p>
          <button className="text-xs text-blue-400 tracking-wider">VIEW ALL</button>
        </div>
        <div className="bg-white/4 border border-white/8 rounded-2xl overflow-hidden">
          {[
            { rank: '🥇', name: 'Joel', pts: '5,888.1', me: false },
            { rank: '🥈', name: userName, pts: '4,698.1', me: true },
            { rank: '🥉', name: 'Hamish', pts: '3,298.1', me: false },
            { rank: '4', name: 'Zafi', pts: '2,698.1', me: false },
          ].map((user, i, arr) => (
            <div key={user.name} className={`flex items-center gap-3 px-4 py-3 ${i < arr.length - 1 ? 'border-b border-white/5' : ''} ${user.me ? 'bg-blue-500/8' : ''}`}>
              <span className="text-lg w-6 text-center">{user.rank}</span>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                {user.name[0]}
              </div>
              <span className="flex-1 text-sm font-medium">
                {user.name} {user.me && <span className="text-xs text-blue-400">(you)</span>}
              </span>
              <span className="text-sm text-teal-400 font-mono font-bold">{user.pts} PTS</span>
            </div>
          ))}
        </div>

      </div>

      <BottomNav />
    </div>
  );
}
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMsal } from '@azure/msal-react';
import BottomNav from '@/components/BottomNav';

const API_URL = 'https://gymdogs-api-g9d0gve4angygdcj.newzealandnorth-01.azurewebsites.net/api/gymLogs';
const PROFILES_URL = 'https://gymdogs-api-g9d0gve4angygdcj.newzealandnorth-01.azurewebsites.net/api/userProfiles';
const API_KEY = process.env.NEXT_PUBLIC_API_KEY;
const PROFILES_KEY = process.env.NEXT_PUBLIC_PLANS_API_KEY;

const mockStats = { weight: '', height: '', age: '', bodyFat: '' };
const mockGoals = ['Build Muscle', 'Improve Strength', 'Lose Body Fat'];

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

function calcPRCount(logs) {
  const maxByExercise = {};
  logs.forEach(log => {
    if (!log.exName) return;
    try {
      const sets = JSON.parse(log.sets_data || '[]');
      sets.forEach(s => {
        if (s.kg && parseFloat(s.kg) > 0) {
          const kg = parseFloat(s.kg);
          if (!maxByExercise[log.exName] || kg > maxByExercise[log.exName]) {
            maxByExercise[log.exName] = kg;
          }
        }
      });
    } catch (e) {}
  });
  return Object.keys(maxByExercise).length;
}

function calcTotalSessions(logs) {
  return new Set(logs.map(l => l.date).filter(Boolean)).size;
}

function getJoinDate() {
  const now = new Date();
  return now.toLocaleDateString('en-NZ', { month: 'long', year: 'numeric' });
}

export default function ProfilePage() {
  const router = useRouter();
  const { instance, accounts, inProgress } = useMsal();
  const [userId, setUserId] = useState(null);
  const [userName, setUserName] = useState('');
  const [userInitials, setUserInitials] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [joinDate, setJoinDate] = useState('');
  const [logs, setLogs] = useState([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [editingStats, setEditingStats] = useState(false);
  const [stats, setStats] = useState(mockStats);
  const [tempStats, setTempStats] = useState(mockStats);

  // Display name editing
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState('');
  const [savingName, setSavingName] = useState(false);

  const achievements = [
    { id: 1, icon: '🔥', label: '14-Day Streak', earned: calcStreak(logs) >= 14 },
    { id: 2, icon: '💪', label: 'First PR', earned: calcPRCount(logs) >= 1 },
    { id: 3, icon: '🏋️', label: '10 Workouts', earned: calcTotalSessions(logs) >= 10 },
    { id: 4, icon: '⚡', label: '50 Workouts', earned: calcTotalSessions(logs) >= 50 },
    { id: 5, icon: '🎯', label: '5 PRs Set', earned: calcPRCount(logs) >= 5 },
    { id: 6, icon: '👑', label: 'Elite Status', earned: calcTotalSessions(logs) >= 100 },
  ];

  useEffect(() => {
    if (inProgress !== 'none') return;
    if (accounts.length === 0) {
      router.push('/login');
      return;
    }
    const user = accounts[0];
    const uid = user.localAccountId;
    setUserId(uid);
    setUserEmail(user.username || '');
    setJoinDate(getJoinDate());

    // Fallback name from Entra in case CosmosDB has nothing
    const entraName = user.name && user.name !== 'unknown'
      ? user.name
      : user.username?.split('@')[0] || 'Athlete';
    const firstName = entraName.split(' ')[0];
    const initials = entraName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    setUserName(firstName);
    setUserInitials(initials);

    // Try to load saved display name from CosmosDB
    const fetchProfile = async () => {
      try {
        const res = await fetch(`${PROFILES_URL}?userId=${uid}`, {
          headers: { 'x-functions-key': PROFILES_KEY }
        });
        if (res.ok) {
          const data = await res.json();
          // data is an array — find this user's profile
          const profile = Array.isArray(data) ? data.find(p => p.userId === uid) : null;
          if (profile && profile.name && profile.name !== uid) {
            const savedFirst = profile.name.split(' ')[0];
            const savedInitials = profile.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
            setUserName(savedFirst);
            setUserInitials(savedInitials);
          }
        }
      } catch (e) {
        console.log('Could not load profile:', e.message);
      }
    };
    fetchProfile();
  }, [accounts, inProgress, router]);

  useEffect(() => {
    if (!userId) return;
    const fetchLogs = async () => {
      try {
        const res = await fetch(`${API_URL}?userId=${userId}`, {
          headers: { 'x-functions-key': API_KEY }
        });
        if (res.ok) {
          const data = await res.json();
          setLogs(data);
        }
      } catch (e) {
        console.log('Error fetching logs:', e.message);
      } finally {
        setStatsLoading(false);
      }
    };
    fetchLogs();
  }, [userId]);

  const handleSaveName = async () => {
    if (!tempName.trim()) return;
    setSavingName(true);
    try {
      const initials = tempName.trim().split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
      const res = await fetch(PROFILES_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-functions-key': PROFILES_KEY
        },
        body: JSON.stringify({
          userId,
          name: tempName.trim(),
          initials
        })
      });
      if (res.ok) {
        const firstName = tempName.trim().split(' ')[0];
        setUserName(firstName);
        setUserInitials(initials);
        setEditingName(false);
      }
    } catch (e) {
      console.log('Error saving name:', e.message);
    } finally {
      setSavingName(false);
    }
  };

  if (!userId) return null;

  const totalSessions = calcTotalSessions(logs);
  const streak = calcStreak(logs);
  const prCount = calcPRCount(logs);

  const handleSaveStats = () => { setStats(tempStats); setEditingStats(false); };
  const handleCancelEdit = () => { setTempStats(stats); setEditingStats(false); };
  const handleSignOut = () => {
    instance.logoutRedirect({ postLogoutRedirectUri: '/login' });
  };

  return (
    <div className="min-h-screen bg-[#080C14] text-white relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-0 w-64 h-64 bg-violet-500/8 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 px-5 pt-12 pb-6 bg-gradient-to-b from-blue-500/10 to-transparent">
        <p className="text-xs tracking-[3px] text-slate-500 uppercase">Your Account</p>
        <h1 className="text-3xl font-black tracking-wider mt-1">PROFILE</h1>
        <div className="flex items-center gap-4 mt-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-xl font-bold shadow-lg shadow-blue-500/20">
            {userInitials}
          </div>
          <div>
            <h2 className="text-xl font-black tracking-wider">{userName.toUpperCase()}</h2>
            <p className="text-sm text-slate-400">{userEmail}</p>
            <p className="text-xs text-slate-600 tracking-wider uppercase mt-0.5">Member since {joinDate}</p>
          </div>
        </div>
      </div>

      <div className="relative z-10 px-5 pb-24 flex flex-col gap-4 overflow-y-auto">
        <div className="grid grid-cols-3 gap-3">
          {[
            { val: statsLoading ? '...' : totalSessions, label: 'Workouts', color: 'text-blue-400' },
            { val: statsLoading ? '...' : `🔥${streak}`, label: 'Day Streak', color: 'text-orange-400' },
            { val: statsLoading ? '...' : prCount, label: 'PRs Set', color: 'text-teal-400' },
          ].map((stat) => (
            <div key={stat.label} className="bg-white/4 border border-white/8 rounded-2xl p-3 text-center">
              <p className={`text-2xl font-black ${stat.color} leading-none`}>{stat.val}</p>
              <p className="text-xs text-slate-500 tracking-wider mt-1 uppercase">{stat.label}</p>
            </div>
          ))}
        </div>

        <p className="text-xs tracking-[3px] text-slate-500 uppercase mt-1">Body Stats</p>
        <div className="bg-white/4 border border-white/8 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-bold tracking-wider text-white">MEASUREMENTS</p>
            {!editingStats ? (
              <button onClick={() => setEditingStats(true)} className="text-blue-400 text-sm font-semibold tracking-wider">EDIT</button>
            ) : (
              <div className="flex gap-4">
                <button onClick={handleCancelEdit} className="text-slate-500 text-sm tracking-wider">CANCEL</button>
                <button onClick={handleSaveStats} className="text-blue-400 text-sm font-semibold tracking-wider">SAVE</button>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: 'weight', label: 'Weight', unit: 'kg' },
              { key: 'height', label: 'Height', unit: 'cm' },
              { key: 'age', label: 'Age', unit: 'yrs' },
              { key: 'bodyFat', label: 'Body Fat', unit: '%' },
            ].map(({ key, label, unit }) => (
              <div key={key} className="bg-white/4 border border-white/6 rounded-xl p-3">
                <p className="text-xs text-slate-500 tracking-wider uppercase mb-1">{label}</p>
                {editingStats ? (
                  <div className="flex items-baseline gap-1">
                    <input
                      type="number"
                      value={tempStats[key]}
                      onChange={(e) => setTempStats((prev) => ({ ...prev, [key]: e.target.value }))}
                      className="w-full bg-white/8 text-white text-xl font-black rounded-lg px-2 py-1 outline-none border border-blue-500/50 font-mono"
                    />
                    <span className="text-slate-500 text-xs">{unit}</span>
                  </div>
                ) : (
                  <p className="text-white text-xl font-black font-mono">
                    {stats[key] || '—'} <span className="text-slate-500 text-sm font-normal">{stats[key] ? unit : ''}</span>
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs tracking-[3px] text-slate-500 uppercase mt-1">My Goals</p>
        <div className="bg-white/4 border border-white/8 rounded-2xl p-4">
          <div className="flex flex-wrap gap-2">
            {mockGoals.map((goal) => (
              <span key={goal} className="bg-violet-500/15 border border-violet-500/30 text-violet-300 text-xs px-3 py-1.5 rounded-full font-bold tracking-wider uppercase">
                {goal}
              </span>
            ))}
          </div>
        </div>

        <p className="text-xs tracking-[3px] text-slate-500 uppercase mt-1">Achievements</p>
        <div className="bg-white/4 border border-white/8 rounded-2xl p-4">
          <div className="grid grid-cols-3 gap-3">
            {achievements.map((a) => (
              <div key={a.id} className={`rounded-2xl p-3 text-center ${a.earned ? 'bg-orange-500/10 border border-orange-500/25' : 'bg-white/2 border border-white/6 opacity-35'}`}>
                <div className="text-2xl mb-1">{a.icon}</div>
                <p className={`text-xs font-bold tracking-wider ${a.earned ? 'text-orange-300' : 'text-slate-500'}`}>{a.label}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs tracking-[3px] text-slate-500 uppercase mt-1">Account</p>
        <div className="bg-white/4 border border-white/8 rounded-2xl overflow-hidden">
          <button
            onClick={() => { setTempName(userName); setEditingName(true); }}
            className="w-full flex items-center gap-3 px-4 py-4 text-left hover:bg-white/4 transition-colors border-b border-white/5"
          >
            <span className="text-lg">✏️</span>
            <span className="text-sm font-medium text-slate-300 tracking-wide flex-1">Edit Display Name</span>
            <span className="text-slate-600 text-sm">›</span>
          </button>
          {[
            { label: 'Notification Preferences', icon: '🔔' },
            { label: 'Privacy Settings', icon: '🔒' },
          ].map((item, i, arr) => (
            <button key={item.label} className={`w-full flex items-center gap-3 px-4 py-4 text-left hover:bg-white/4 transition-colors ${i < arr.length - 1 ? 'border-b border-white/5' : ''}`}>
              <span className="text-lg">{item.icon}</span>
              <span className="text-sm font-medium text-slate-300 tracking-wide flex-1">{item.label}</span>
              <span className="text-slate-600 text-sm">›</span>
            </button>
          ))}
        </div>

        <button
          onClick={handleSignOut}
          className="w-full bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-red-400 text-sm font-bold tracking-widest uppercase hover:bg-red-500/15 transition-colors">
          Sign Out
        </button>
      </div>

      {/* Edit Name Modal */}
      {editingName && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#0E1624] border border-white/10 rounded-3xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-black tracking-wider mb-1">DISPLAY NAME</h3>
            <p className="text-xs text-slate-500 tracking-wide mb-5">This is how you'll appear in the app and on the leaderboard</p>
            <input
              type="text"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              placeholder="e.g. Shoeb or Shoeb Dar"
              className="w-full bg-white/6 border border-white/12 rounded-xl px-4 py-3 text-white text-base outline-none focus:border-blue-500/60 mb-4"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => setEditingName(false)}
                className="flex-1 py-3 rounded-xl border border-white/10 text-slate-400 text-sm font-bold tracking-wider">
                CANCEL
              </button>
              <button
                onClick={handleSaveName}
                disabled={savingName || !tempName.trim()}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-violet-600 text-white text-sm font-bold tracking-wider disabled:opacity-50">
                {savingName ? 'SAVING...' : 'SAVE'}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
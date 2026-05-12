'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMsal } from '@azure/msal-react';
import BottomNav from '@/components/BottomNav';

const API_URL = 'https://gymdogs-api-g9d0gve4angygdcj.newzealandnorth-01.azurewebsites.net/api/gymLogs';
const API_KEY = process.env.NEXT_PUBLIC_API_KEY;

const bodyAreas = ['Chest', 'Shoulders', 'Back', 'Legs', 'Core', 'Arms'];
const levels = ['none', 'mild', 'moderate', 'severe'];

const getLevelStyle = (level) => {
  if (level === 'mild') return { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', dot: '🟡' };
  if (level === 'moderate') return { color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20', dot: '🟠' };
  if (level === 'severe') return { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', dot: '🔴' };
  return { color: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/20', dot: '🟢' };
};

function getWeekLabel(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return '1 week ago';
  return `${Math.floor(diffDays / 7)} weeks ago`;
}

function calcWeeklyVolume(logs) {
  const weeks = {};
  logs.forEach(log => {
    if (!log.date) return;
    const date = new Date(log.date);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const weekKey = weekStart.toISOString().split('T')[0];
    if (!weeks[weekKey]) weeks[weekKey] = 0;
    try {
      const sets = JSON.parse(log.sets_data || '[]');
      sets.forEach(s => {
        if (s.kg && s.reps) weeks[weekKey] += parseFloat(s.kg) * parseFloat(s.reps);
      });
    } catch (e) {}
  });
  const sorted = Object.entries(weeks).sort(([a], [b]) => a.localeCompare(b)).slice(-4);
  const max = Math.max(...sorted.map(([, v]) => v), 1);
  return sorted.map(([key, vol], i) => ({
    week: `W${i + 1}`,
    volume: Math.round((vol / max) * 90),
    rawVolume: vol,
    isCurrent: i === sorted.length - 1
  }));
}

function calcPRs(logs) {
  const maxByExercise = {};
  logs.forEach(log => {
    if (!log.exName) return;
    try {
      const sets = JSON.parse(log.sets_data || '[]');
      sets.forEach(s => {
        if (s.kg && parseFloat(s.kg) > 0) {
          const kg = parseFloat(s.kg);
          if (!maxByExercise[log.exName] || kg > maxByExercise[log.exName].kg) {
            maxByExercise[log.exName] = { kg, date: log.date };
          }
        }
      });
    } catch (e) {}
  });
  return Object.entries(maxByExercise)
    .map(([exercise, { kg, date }]) => ({ exercise, weight: `${kg}kg`, date: getWeekLabel(date) }))
    .sort((a, b) => b.weight.localeCompare(a.weight))
    .slice(0, 5);
}

function calcTotalVolume(logs) {
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

export default function ProgressPage() {
  const router = useRouter();
  const { accounts, inProgress } = useMsal();
  const [userId, setUserId] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sorenessLevels, setSorenessLevels] = useState(
    bodyAreas.reduce((acc, area) => ({ ...acc, [area]: 'none' }), {})
  );

  useEffect(() => {
    if (inProgress !== 'none') return;
    if (accounts.length === 0) {
      router.push('/login');
      return;
    }
    setUserId(accounts[0].localAccountId);
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
        setLoading(false);
      }
    };
    fetchLogs();
  }, [userId]);

  if (!userId) return null;

  const weeklyData = calcWeeklyVolume(logs);
  const prs = calcPRs(logs);
  const totalVolume = calcTotalVolume(logs);
  const totalSessions = new Set(logs.map(l => l.date).filter(Boolean)).size;

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
        <p className="text-xs tracking-[3px] text-slate-500 uppercase">All Time</p>
        <h1 className="text-3xl font-black tracking-wider mt-1">
          MY <span className="bg-gradient-to-r from-teal-400 to-blue-400 bg-clip-text text-transparent">PROGRESS</span>
        </h1>
        <div className="flex gap-3 mt-4">
          <div className="bg-white/4 border border-white/8 rounded-2xl px-4 py-2 text-center">
            <p className="text-xl font-black text-blue-400">{loading ? '...' : totalSessions}</p>
            <p className="text-xs text-slate-500 tracking-wider uppercase">Sessions</p>
          </div>
          <div className="bg-white/4 border border-white/8 rounded-2xl px-4 py-2 text-center">
            <p className="text-xl font-black text-teal-400">{loading ? '...' : totalVolume}</p>
            <p className="text-xs text-slate-500 tracking-wider uppercase">KG Lifted</p>
          </div>
          <div className="bg-white/4 border border-white/8 rounded-2xl px-4 py-2 text-center">
            <p className="text-xl font-black text-violet-400">{loading ? '...' : prs.length}</p>
            <p className="text-xs text-slate-500 tracking-wider uppercase">PRs Set</p>
          </div>
        </div>
      </div>

      <div className="px-5 flex flex-col gap-4">

        {/* Latest PR banner */}
        {prs.length > 0 && (
          <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/5 border border-yellow-500/20 rounded-3xl p-4 flex items-center gap-4">
            <span className="text-4xl">🏆</span>
            <div className="flex-1">
              <p className="font-bold text-base">Personal Record!</p>
              <p className="text-xs text-slate-400 mt-1">{prs[0].exercise} · {prs[0].date}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-yellow-400 leading-none">{prs[0].weight.replace('kg', '')}</p>
              <p className="text-xs text-slate-500">kg</p>
            </div>
          </div>
        )}

        {/* Weekly volume chart */}
        <div className="bg-white/4 border border-white/8 rounded-3xl p-4">
          <div className="flex justify-between items-center mb-4">
            <p className="text-xs tracking-[3px] text-slate-500 uppercase">Weekly Volume</p>
            <p className="text-2xl font-black text-teal-400">
              {loading ? '...' : totalVolume}
              <span className="text-sm text-slate-500 font-normal ml-1">kg</span>
            </p>
          </div>
          {loading ? (
            <p className="text-xs text-slate-600 text-center py-4">Loading...</p>
          ) : weeklyData.length === 0 ? (
            <p className="text-xs text-slate-600 text-center py-4">No workout data yet — log your first session!</p>
          ) : (
            <div className="flex items-end gap-3 h-20">
              {weeklyData.map((d) => (
                <div key={d.week} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                  <div
                    className={`w-full rounded-t-lg ${d.isCurrent ? 'bg-gradient-to-t from-blue-500 to-violet-500' : 'bg-white/15'}`}
                    style={{ height: `${d.volume}%` }}
                  />
                  <p className="text-xs text-slate-600">{d.week}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Soreness check-in */}
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
          <p className="text-xs text-slate-600 text-center mt-3">Green None · Yellow Mild · Orange Moderate · Red Severe</p>
        </div>

        {/* Personal Records */}
        <p className="text-xs tracking-[3px] text-slate-500 uppercase">Personal Records</p>
        <div className="bg-white/4 border border-white/8 rounded-3xl overflow-hidden">
          {loading ? (
            <div className="px-4 py-6 text-center">
              <p className="text-xs text-slate-600">Loading your records...</p>
            </div>
          ) : prs.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-xs text-slate-600">No records yet — log your first session to start tracking PRs!</p>
            </div>
          ) : (
            prs.map((pr, i) => (
              <div key={i} className={`flex items-center gap-3 px-4 py-3 ${i < prs.length - 1 ? 'border-b border-white/5' : ''}`}>
                <span className="text-xl">🏅</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{pr.exercise}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{pr.date}</p>
                </div>
                <p className="text-sm font-black text-teal-400 font-mono">{pr.weight}</p>
              </div>
            ))
          )}
        </div>

        {/* AI Recovery Note */}
        <div className="bg-violet-500/8 border border-violet-500/15 rounded-3xl p-4 flex gap-3 items-start">
          <span className="text-2xl">🧠</span>
          <div>
            <p className="text-sm font-bold text-violet-300">AI Recovery Note</p>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              {totalSessions >= 10
                ? "You've been putting in serious work. Monitor your soreness levels and consider a deload if multiple areas are showing moderate or severe."
                : totalSessions >= 3
                ? "Good consistency building up. Keep logging your sessions and your progress chart will start showing real trends."
                : "Every session counts. Log your workouts consistently and you'll start seeing your personal records climb week by week."}
            </p>
          </div>
        </div>

      </div>

      <BottomNav />
    </div>
  );
}
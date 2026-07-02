'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMsal } from '@azure/msal-react';
import BottomNav from '@/components/BottomNav';
import QuoteCard from '@/components/QuoteCard';

const API_URL = 'https://gymdogs-api-g9d0gve4angygdcj.newzealandnorth-01.azurewebsites.net/api/gymLogs';
const API_KEY = process.env.NEXT_PUBLIC_API_KEY;
const PROFILES_URL = 'https://gymdogs-api-g9d0gve4angygdcj.newzealandnorth-01.azurewebsites.net/api/userProfiles';
const PROFILES_KEY = process.env.NEXT_PUBLIC_PROFILES_API_KEY;

const SORENESS_AREAS = [
  { id: 'chest',     label: 'Chest' },
  { id: 'shoulders', label: 'Shoulders' },
  { id: 'back',      label: 'Back' },
  { id: 'legs',      label: 'Legs' },
  { id: 'core',      label: 'Core' },
  { id: 'arms',      label: 'Arms' },
];

const LEVELS = ['none', 'mild', 'sore'];

function levelStyle(level) {
  if (level === 'sore') return { bg: 'var(--red-tint)', ink: 'var(--red-ink)' };
  if (level === 'mild') return { bg: 'var(--orange-tint)', ink: 'var(--orange-ink)' };
  return { bg: 'var(--soft)', ink: 'var(--ink-3)' };
}
function sorenessLabel(level) {
  if (level === 'sore') return 'Sore';
  if (level === 'mild') return 'Mild';
  return 'None';
}

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
      sets.forEach(s => { if (s.kg && s.reps) weeks[weekKey] += parseFloat(s.kg) * parseFloat(s.reps); });
    } catch (e) {}
  });
  const sorted = Object.entries(weeks).sort(([a], [b]) => a.localeCompare(b)).slice(-4);
  const max = Math.max(...sorted.map(([, v]) => v), 1);
  return sorted.map(([key, vol], i) => ({
    week: `W${i + 1}`,
    volume: Math.round((vol / max) * 90),
    rawVolume: vol,
    isCurrent: i === sorted.length - 1,
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
    .map(([exercise, { kg, date }]) => ({ exercise, weight: kg, date: getWeekLabel(date) }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5);
}

function calcTotalVolume(logs) {
  let total = 0;
  logs.forEach(log => {
    try {
      const sets = JSON.parse(log.sets_data || '[]');
      sets.forEach(s => { if (s.kg && s.reps) total += parseFloat(s.kg) * parseFloat(s.reps); });
    } catch (e) {}
  });
  if (total >= 1000) return `${(total / 1000).toFixed(1)}k`;
  return `${Math.round(total)}`;
}

function calcRecoveryScore(sorenessLevels) {
  let score = 100;
  Object.values(sorenessLevels).forEach(level => {
    if (level === 'mild') score -= 8;
    if (level === 'sore') score -= 18;
  });
  return Math.max(score, 10);
}
function recoveryStatus(score) {
  if (score >= 80) return { label: 'Good', color: 'var(--accent-strong)', sub: 'Keep it up' };
  if (score >= 60) return { label: 'Moderate', color: 'var(--orange-ink)', sub: 'Take it steady' };
  return { label: 'Rest up', color: 'var(--red-ink)', sub: 'Recovery day advised' };
}

const eyebrow = { fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', color: 'var(--ink-3)', textTransform: 'uppercase', margin: 0 };
const cardStyle = { background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 22, padding: 18 };

export default function ProgressPage() {
  const router = useRouter();
  const { accounts, inProgress } = useMsal();
  const [userId, setUserId] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [profileRef, setProfileRef] = useState(null);
  const [sorenessLevels, setSorenessLevels] = useState(
    SORENESS_AREAS.reduce((acc, a) => ({ ...acc, [a.id]: 'none' }), {})
  );
  const [savingSoreness, setSavingSoreness] = useState(false);
  const [sorenessSaved, setSorenessSaved] = useState(false);
  const [chartOn, setChartOn] = useState(false); // bars grow in after load

  useEffect(() => {
    if (!loading) {
      const t = setTimeout(() => setChartOn(true), 120);
      return () => clearTimeout(t);
    }
  }, [loading]);

  useEffect(() => {
    if (inProgress === 'startup') return;
    if (accounts.length === 0) { router.push('/login'); return; }
    const uid = accounts[0].localAccountId;
    setUserId(uid);
    const fetchProfile = async () => {
      try {
        const res = await fetch(`${PROFILES_URL}?userId=${uid}`, { headers: { 'x-functions-key': PROFILES_KEY } });
        if (res.ok) {
          const data = await res.json();
          const profile = Array.isArray(data) ? data.find(p => p.userId === uid) : null;
          if (profile) {
            setProfileRef(profile);
            if (profile.soreness) setSorenessLevels(profile.soreness);
          }
        }
      } catch (e) {}
    };
    fetchProfile();
  }, [accounts, inProgress, router]);

  useEffect(() => {
    if (!userId) return;
    const fetchLogs = async () => {
      try {
        const res = await fetch(`${API_URL}?userId=${userId}`, { headers: { 'x-functions-key': API_KEY } });
        if (res.ok) setLogs(await res.json());
      } catch (e) {}
      finally { setLoading(false); }
    };
    fetchLogs();
  }, [userId]);

  const cycleLevel = async (areaId) => {
    const next = LEVELS[(LEVELS.indexOf(sorenessLevels[areaId]) + 1) % LEVELS.length];
    const updated = { ...sorenessLevels, [areaId]: next };
    setSorenessLevels(updated);
    setSavingSoreness(true);
    try {
      await fetch(PROFILES_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-functions-key': PROFILES_KEY },
        body: JSON.stringify({ ...(profileRef || {}), userId, soreness: updated, readiness: calcRecoveryScore(updated) }),
      });
      setSorenessSaved(true);
      setTimeout(() => setSorenessSaved(false), 1500);
    } catch (e) {}
    finally { setSavingSoreness(false); }
  };

  if (!userId) return null;

  const weeklyData = calcWeeklyVolume(logs);
  const prs = calcPRs(logs);
  const totalVolume = calcTotalVolume(logs);
  const totalSessions = new Set(logs.map(l => l.date).filter(Boolean)).size;
  const recoveryScore = calcRecoveryScore(sorenessLevels);
  const status = recoveryStatus(recoveryScore);

  const aiNote = totalSessions >= 10
    ? 'You have been putting in serious work. Monitor your soreness and consider a deload if several areas read moderate or severe.'
    : totalSessions >= 3
    ? 'Good consistency building up. Keep logging sessions and your chart will start showing real trends.'
    : 'Every session counts. Log workouts consistently and your records will climb week by week.';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)', paddingBottom: 100 }}>

      {/* ── HEADER ── */}
      <div style={{ padding: '52px 20px 14px' }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>Progress</h1>
        <p style={{ margin: '2px 0 0', fontSize: 14, color: 'var(--ink-2)' }}>All time</p>
      </div>

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* ── STATS ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {[
            { value: loading ? '—' : totalSessions, label: 'sessions', color: 'var(--ink)' },
            { value: loading ? '—' : `${totalVolume}`, label: 'kg lifted', color: 'var(--accent-strong)' },
            { value: loading ? '—' : prs.length, label: 'PRs set', color: 'var(--orange)' },
          ].map((s, i) => (
            <div key={i} style={{ background: 'var(--soft)', borderRadius: 16, padding: '14px 8px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: s.color }}>{s.value}</p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--ink-3)', fontWeight: 600 }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* ── WEEKLY VOLUME ── */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <p style={eyebrow}>Weekly volume</p>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--accent-strong)' }}>{loading ? '—' : `${totalVolume} kg`}</p>
          </div>
          {loading ? (
            <p style={{ textAlign: 'center', color: 'var(--ink-3)', fontSize: 12, padding: '20px 0' }}>Loading…</p>
          ) : weeklyData.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--ink-3)', fontSize: 12, padding: '20px 0' }}>No data yet — log your first session.</p>
          ) : (
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', height: 120 }}>
              {weeklyData.map((d) => (
                <div key={d.week} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, height: '100%', justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: 10, color: 'var(--ink-3)', fontWeight: 600 }}>
                    {d.rawVolume >= 1000 ? `${(d.rawVolume/1000).toFixed(1)}k` : Math.round(d.rawVolume)}
                  </span>
                  <div style={{ width: '100%', height: chartOn ? `${Math.max(d.volume, 5)}%` : '0%', background: d.isCurrent ? 'var(--accent)' : 'var(--soft)', borderRadius: '8px 8px 4px 4px', transition: 'height 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }} />
                  <span style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600 }}>{d.week}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── SORENESS ── */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <p style={eyebrow}>Soreness check-in</p>
              <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--ink-3)' }}>Tap a muscle to update</p>
            </div>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: sorenessSaved ? 'var(--accent-strong)' : 'var(--ink-3)' }}>
              {savingSoreness ? 'Saving…' : sorenessSaved ? '✓ Saved' : ''}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {SORENESS_AREAS.map(area => {
              const level = sorenessLevels[area.id] || 'none';
              const st = levelStyle(level);
              return (
                <button key={area.id} onClick={() => cycleLevel(area.id)} style={{
                  background: st.bg, border: 'none', borderRadius: 14, padding: '14px 8px',
                  textAlign: 'center', cursor: 'pointer', color: st.ink,
                }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{area.label}</p>
                  <p style={{ margin: '3px 0 0', fontSize: 11, fontWeight: 600 }}>{sorenessLabel(level)}</p>
                </button>
              );
            })}
          </div>

          {/* Recovery score */}
          <div style={{ marginTop: 14, background: 'var(--soft)', borderRadius: 16, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--ink-3)', fontWeight: 600, letterSpacing: '0.05em' }}>Recovery score</p>
              <p style={{ margin: '2px 0 0', fontSize: 28, fontWeight: 800, color: status.color, lineHeight: 1 }}>{recoveryScore}%</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: status.color }}>{status.label}</p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--ink-3)' }}>{status.sub}</p>
            </div>
          </div>
        </div>

        {/* ── PERSONAL RECORDS ── */}
        <div style={cardStyle}>
          <p style={{ ...eyebrow, marginBottom: 6 }}>Personal records</p>
          {loading ? (
            <p style={{ fontSize: 12, color: 'var(--ink-3)', textAlign: 'center', padding: '16px 0' }}>Loading…</p>
          ) : prs.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--ink-3)', textAlign: 'center', padding: '16px 0' }}>Log a session to start tracking PRs.</p>
          ) : (
            prs.map((pr, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: i === 0 ? 'none' : '1px solid var(--line-2)' }}>
                <div style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--orange-tint)', color: 'var(--orange-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🏆</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pr.exercise}</p>
                  <p style={{ margin: '1px 0 0', fontSize: 12, color: 'var(--ink-3)' }}>{pr.date}</p>
                </div>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--accent-strong)', flexShrink: 0 }}>{pr.weight}kg</p>
              </div>
            ))
          )}
        </div>

        {/* ── AI RECOVERY NOTE ── */}
        <div style={{ background: `linear-gradient(135deg, var(--ai-card-1), var(--ai-card-2))`, borderRadius: 22, padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 18 }}>✨</span>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>AI Recovery Note</span>
          </div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: '#D9D9E3' }}>{aiNote}</p>
        </div>

        {/* ── GYM DADDY ── */}
        <QuoteCard mode="random" plain />

      </div>

      <BottomNav />
    </div>
  );
}

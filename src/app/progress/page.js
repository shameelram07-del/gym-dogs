'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMsal } from '@azure/msal-react';
import Image from 'next/image';
import BottomNav from '@/components/BottomNav';

const API_URL = 'https://gymdogs-api-g9d0gve4angygdcj.newzealandnorth-01.azurewebsites.net/api/gymLogs';
const API_KEY = process.env.NEXT_PUBLIC_API_KEY;
const PROFILES_URL = 'https://gymdogs-api-g9d0gve4angygdcj.newzealandnorth-01.azurewebsites.net/api/userProfiles';
const PROFILES_KEY = process.env.NEXT_PUBLIC_PROFILES_API_KEY;

// ─── SORENESS CONFIG ──────────────────────────────────────────────────────────
const SORENESS_AREAS = [
  { id: 'chest',     label: 'CHEST',     icon: '/images/icon_chest.png',     side: 'left' },
  { id: 'back',      label: 'BACK',      icon: '/images/icon_back.png',      side: 'left' },
  { id: 'legs',      label: 'LEGS',      icon: '/images/icon_legs.png',      side: 'left' },
  { id: 'shoulders', label: 'SHOULDERS', icon: '/images/icon_shoulders.png', side: 'right' },
  { id: 'arms',      label: 'ARMS',      icon: '/images/icon_arms.png',      side: 'right' },
  { id: 'core',      label: 'CORE',      icon: '/images/icon_core.png',      side: 'right' },
];

const LEVELS = ['none', 'mild', 'sore'];

function sorenessColor(level) {
  if (level === 'mild') return '#facc15'; // yellow
  if (level === 'sore') return '#f87171'; // red
  return '#34d399'; // green
}

function sorenessLabel(level) {
  if (level === 'mild') return 'Mild';
  if (level === 'sore') return 'Sore';
  return 'None';
}

// ─── DATA HELPERS (preserved from original) ───────────────────────────────────
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
      sets.forEach(s => {
        if (s.kg && s.reps) total += parseFloat(s.kg) * parseFloat(s.reps);
      });
    } catch (e) {}
  });
  if (total >= 1000) return `${(total / 1000).toFixed(1)}K`;
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
  if (score >= 80) return { label: 'GOOD', color: '#34d399', sub: 'Keep it up!' };
  if (score >= 60) return { label: 'MODERATE', color: '#facc15', sub: 'Take it steady.' };
  return { label: 'REST UP', color: '#f87171', sub: 'Recovery day recommended.' };
}

const MEDAL_ICONS = [
  '/images/icon_medal_gold.png',
  '/images/icon_medal_silver.png',
  '/images/icon_medal_bronze.png',
];

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
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

  // ── Auth guard ──
  useEffect(() => {
    if (inProgress === 'startup') return;
    if (accounts.length === 0) { router.push('/login'); return; }
    const uid = accounts[0].localAccountId;
    setUserId(uid);

    const fetchProfile = async () => {
      try {
        const res = await fetch(`${PROFILES_URL}?userId=${uid}`, {
          headers: { 'x-functions-key': PROFILES_KEY },
        });
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

  // ── Fetch logs ──
  useEffect(() => {
    if (!userId) return;
    const fetchLogs = async () => {
      try {
        const res = await fetch(`${API_URL}?userId=${userId}`, {
          headers: { 'x-functions-key': API_KEY },
        });
        if (res.ok) setLogs(await res.json());
      } catch (e) {}
      finally { setLoading(false); }
    };
    fetchLogs();
  }, [userId]);

  // ── Cycle soreness ──
  const cycleLevel = async (areaId) => {
    const next = LEVELS[(LEVELS.indexOf(sorenessLevels[areaId]) + 1) % LEVELS.length];
    const updated = { ...sorenessLevels, [areaId]: next };
    setSorenessLevels(updated);
    setSavingSoreness(true);
    try {
      await fetch(PROFILES_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-functions-key': PROFILES_KEY },
        body: JSON.stringify({ ...(profileRef || {}), userId, soreness: updated }),
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

  const leftAreas  = SORENESS_AREAS.filter(a => a.side === 'left');
  const rightAreas = SORENESS_AREAS.filter(a => a.side === 'right');

  // ── AI note ──
  const aiNote = totalSessions >= 10
    ? "You've been putting in serious work. Monitor your soreness levels and consider a deload if multiple areas are showing moderate or severe."
    : totalSessions >= 3
    ? "Good consistency building up. Keep logging your sessions and your progress chart will start showing real trends."
    : "Every session counts. Log your workouts consistently and you'll start seeing your personal records climb week by week.";

  return (
    <div style={{
      minHeight: '100vh',
      background: '#09090F',
      color: '#ffffff',
      paddingBottom: '100px',
      fontFamily: 'system-ui, sans-serif',
    }}>

      {/* ── HEADER ── */}
      <div style={{
        padding: '52px 20px 20px',
        background: 'linear-gradient(180deg, rgba(124,58,237,0.12) 0%, transparent 100%)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
      }}>
        <div>
          <p style={{ fontSize: '11px', color: '#6b7280', letterSpacing: '2px', marginBottom: '4px' }}>ALL TIME</p>
          <h1 style={{ fontSize: '32px', fontWeight: 900, margin: 0, lineHeight: 1.1 }}>
            MY <span style={{ color: '#7c3aed' }}>PROGRESS</span>
          </h1>
        </div>
        <button style={{
          width: '44px', height: '44px',
          borderRadius: '50%',
          background: 'rgba(124,58,237,0.15)',
          border: '1px solid rgba(124,58,237,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
        }}>
          <Image src="/images/icon_calender.png" alt="calendar" width={22} height={22} />
        </button>
      </div>

      {/* ── 3 STAT CARDS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', padding: '0 20px 16px' }}>
        {[
          { icon: '/images/icon_workout.png', value: loading ? '...' : totalSessions, label: 'SESSIONS', color: '#a78bfa' },
          { icon: '/images/icon_stats.png',   value: loading ? '...' : totalVolume,   label: 'KG LIFTED', color: '#34d399' },
          { icon: '/images/icon_trophy.png',  value: loading ? '...' : prs.length,    label: 'PRS SET',   color: '#facc15' },
        ].map((stat, i) => (
          <div key={i} style={{
            background: '#13131A',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '16px',
            padding: '12px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}>
            <Image src={stat.icon} alt={stat.label} width={24} height={24} style={{ objectFit: 'contain' }} />
            <p style={{ fontSize: '22px', fontWeight: 900, color: stat.color, margin: 0, lineHeight: 1 }}>{stat.value}</p>
            <p style={{ fontSize: '9px', color: '#6b7280', letterSpacing: '1px', margin: 0 }}>{stat.label}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '0 20px' }}>

        {/* ── PR BANNER ── */}
        {prs.length > 0 && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(250,204,21,0.12), rgba(251,146,60,0.06))',
            border: '1px solid rgba(250,204,21,0.25)',
            borderRadius: '20px',
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
          }}>
            <Image src="/images/icon_trophy.png" alt="trophy" width={52} height={52} style={{ objectFit: 'contain', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '15px', fontWeight: 800, margin: '0 0 4px' }}>Personal Record!</p>
              <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>{prs[0].exercise} · {prs[0].date}</p>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <p style={{ fontSize: '28px', fontWeight: 900, color: '#facc15', margin: 0, lineHeight: 1 }}>{prs[0].weight}</p>
              <p style={{ fontSize: '11px', color: '#6b7280', margin: 0 }}>KG</p>
            </div>
            <span style={{ color: '#6b7280', fontSize: '18px' }}>›</span>
          </div>
        )}

        {/* ── WEEKLY VOLUME CHART ── */}
        <div style={{
          background: '#13131A',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '20px',
          padding: '16px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <p style={{ fontSize: '11px', color: '#6b7280', letterSpacing: '2px', margin: 0 }}>WEEKLY VOLUME ⓘ</p>
            <p style={{ fontSize: '22px', fontWeight: 900, color: '#7c3aed', margin: 0 }}>
              {loading ? '...' : totalVolume}
              <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: 400, marginLeft: '4px' }}>KG</span>
            </p>
          </div>

          {loading ? (
            <p style={{ textAlign: 'center', color: '#6b7280', fontSize: '12px', padding: '20px 0' }}>Loading...</p>
          ) : weeklyData.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#6b7280', fontSize: '12px', padding: '20px 0' }}>No data yet — log your first session!</p>
          ) : (
            <div style={{ position: 'relative' }}>
              {/* Y axis labels */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', height: '120px' }}>
                {/* Y axis */}
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', paddingBottom: '20px' }}>
                  {['6K','4K','2K','0'].map(l => (
                    <span key={l} style={{ fontSize: '10px', color: '#4b5563', textAlign: 'right' }}>{l}</span>
                  ))}
                </div>
                {/* Bars */}
                <div style={{ flex: 1, display: 'flex', gap: '8px', alignItems: 'flex-end', height: '100%' }}>
                  {weeklyData.map((d) => (
                    <div key={d.week} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', height: '100%', justifyContent: 'flex-end' }}>
                      {/* Value label above bar */}
                      <span style={{ fontSize: '10px', color: d.isCurrent ? '#a78bfa' : '#6b7280' }}>
                        {d.rawVolume >= 1000 ? `${(d.rawVolume/1000).toFixed(1)}K` : Math.round(d.rawVolume)} KG
                      </span>
                      {/* Bar */}
                      <div style={{
                        width: '100%',
                        height: `${Math.max(d.volume, 4)}%`,
                        background: d.isCurrent
                          ? 'linear-gradient(180deg, #a78bfa, #7c3aed)'
                          : 'rgba(124,58,237,0.3)',
                        borderRadius: '6px 6px 0 0',
                        transition: 'height 0.5s ease',
                      }} />
                      {/* Week label */}
                      <span style={{ fontSize: '11px', color: '#6b7280' }}>{d.week}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* X axis line */}
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', marginTop: '4px', marginLeft: '32px' }} />
            </div>
          )}
        </div>

        {/* ── SORENESS CHECK-IN ── */}
        <div style={{
          background: '#13131A',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '20px',
          padding: '16px',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <p style={{ fontSize: '11px', color: '#6b7280', letterSpacing: '2px', margin: '0 0 2px' }}>SORENESS CHECK-IN</p>
              <p style={{ fontSize: '11px', color: '#4b5563', margin: 0 }}>Tap a muscle to update</p>
            </div>
            <p style={{ fontSize: '11px', color: savingSoreness ? '#facc15' : sorenessSaved ? '#34d399' : '#4b5563', margin: 0 }}>
              {savingSoreness ? 'Saving...' : sorenessSaved ? '✓ Saved' : ''}
            </p>
          </div>

          {/* 3-column layout: left bubbles | mascot | right bubbles */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '8px', alignItems: 'center' }}>

            {/* LEFT — Chest, Back, Legs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {leftAreas.map(area => {
                const level = sorenessLevels[area.id] || 'none';
                const color = sorenessColor(level);
                return (
                  <button
                    key={area.id}
                    onClick={() => cycleLevel(area.id)}
                    style={{
                      background: '#09090F',
                      border: `1.5px solid ${color}40`,
                      borderRadius: '14px',
                      padding: '10px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <Image src={area.icon} alt={area.label} width={28} height={28} style={{ objectFit: 'contain', flexShrink: 0 }} />
                    <div>
                      <p style={{ fontSize: '11px', fontWeight: 700, color: '#ffffff', margin: 0, letterSpacing: '0.5px' }}>{area.label}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                        <p style={{ fontSize: '10px', color, margin: 0 }}>{sorenessLabel(level)}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* CENTRE — Mascot */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
              <Image
                src="/images/gymdogs_logo.png"
                alt="GymDogs mascot"
                width={100}
                height={130}
                style={{ objectFit: 'contain' }}
              />
            </div>

            {/* RIGHT — Shoulders, Arms, Core */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {rightAreas.map(area => {
                const level = sorenessLevels[area.id] || 'none';
                const color = sorenessColor(level);
                return (
                  <button
                    key={area.id}
                    onClick={() => cycleLevel(area.id)}
                    style={{
                      background: '#09090F',
                      border: `1.5px solid ${color}40`,
                      borderRadius: '14px',
                      padding: '10px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <Image src={area.icon} alt={area.label} width={28} height={28} style={{ objectFit: 'contain', flexShrink: 0 }} />
                    <div>
                      <p style={{ fontSize: '11px', fontWeight: 700, color: '#ffffff', margin: 0, letterSpacing: '0.5px' }}>{area.label}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                        <p style={{ fontSize: '10px', color, margin: 0 }}>{sorenessLabel(level)}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Recovery score row */}
          <div style={{
            marginTop: '16px',
            background: '#09090F',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '14px',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
          }}>
            <Image src="/images/icon_shield.png" alt="shield" width={40} height={40} style={{ objectFit: 'contain', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '10px', color: '#6b7280', letterSpacing: '1.5px', margin: '0 0 2px' }}>TODAY'S RECOVERY SCORE</p>
              <p style={{ fontSize: '28px', fontWeight: 900, color: status.color, margin: 0, lineHeight: 1 }}>{recoveryScore}%</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '10px', color: '#6b7280', margin: '0 0 2px', letterSpacing: '1px' }}>STATUS</p>
              <p style={{ fontSize: '14px', fontWeight: 800, color: status.color, margin: '0 0 2px' }}>{status.label}</p>
              <p style={{ fontSize: '11px', color: '#6b7280', margin: 0 }}>{status.sub}</p>
            </div>
          </div>
        </div>

        {/* ── PERSONAL RECORDS ── */}
        <div style={{
          background: '#13131A',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '20px',
          padding: '16px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <p style={{ fontSize: '11px', color: '#6b7280', letterSpacing: '1.5px', margin: 0 }}>PERSONAL RECORDS</p>
            <button style={{ fontSize: '11px', color: '#7c3aed', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              VIEW ALL ›
            </button>
          </div>

          {loading ? (
            <p style={{ fontSize: '12px', color: '#4b5563', textAlign: 'center', padding: '16px 0' }}>Loading...</p>
          ) : prs.length === 0 ? (
            <p style={{ fontSize: '12px', color: '#4b5563', textAlign: 'center', padding: '16px 0' }}>Log a session to start tracking PRs!</p>
          ) : (
            prs.map((pr, i) => (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 0',
                borderBottom: i < prs.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
              }}>
                <Image
                  src={MEDAL_ICONS[i] || MEDAL_ICONS[2]}
                  alt="medal"
                  width={32}
                  height={32}
                  style={{ objectFit: 'contain', flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pr.exercise}</p>
                  <p style={{ fontSize: '11px', color: '#6b7280', margin: 0 }}>{pr.date}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                  <p style={{ fontSize: '16px', fontWeight: 800, color: '#34d399', margin: 0 }}>{pr.weight}kg</p>
                  <span style={{ fontSize: '14px', color: '#4b5563' }}>›</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* ── AI COACH CARD ── */}
        <div style={{
          background: 'linear-gradient(160deg, rgba(124,58,237,0.2), rgba(109,40,217,0.08))',
          border: '1px solid rgba(124,58,237,0.3)',
          borderRadius: '20px',
          padding: '16px',
          display: 'flex',
          gap: '16px',
          alignItems: 'flex-start',
        }}>
          {/* Left — brain icon */}
          <div style={{ flexShrink: 0 }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: 'rgba(124,58,237,0.25)',
              borderRadius: '99px',
              padding: '4px 10px',
              marginBottom: '10px',
            }}>
              <p style={{ fontSize: '10px', fontWeight: 700, color: '#a78bfa', margin: 0, letterSpacing: '1px' }}>AI COACH</p>
            </div>
            <Image
              src="/images/icon_ai_brain.png"
              alt="AI brain"
              width={70}
              height={70}
              style={{ objectFit: 'contain', display: 'block' }}
            />
          </div>

          {/* Right — text + mini chart */}
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff', margin: '0 0 8px' }}>AI Recovery Note</p>
            <p style={{ fontSize: '13px', color: '#9ca3af', margin: '0 0 14px', lineHeight: 1.6 }}>{aiNote}</p>
            {/* Mini bar chart */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '28px' }}>
              {[40, 55, 35, 70, 50, 85, 65].map((h, i) => (
                <div key={i} style={{
                  flex: 1,
                  height: `${h}%`,
                  background: i === 5 ? '#7c3aed' : 'rgba(124,58,237,0.3)',
                  borderRadius: '2px',
                }} />
              ))}
            </div>
          </div>
        </div>

      </div>

      <BottomNav />
    </div>
  );
}
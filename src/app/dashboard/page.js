'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMsal } from '@azure/msal-react';

const API = 'https://gymdogs-api-g9d0gve4angygdcj.newzealandnorth-01.azurewebsites.net/api';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'GOOD MORNING,';
  if (h < 17) return 'GOOD AFTERNOON,';
  return 'GOOD EVENING,';
}

function Avatar({ name, size = 40, fontSize = 16 }) {
  const initial = name?.charAt(0) || 'S';
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize, fontWeight: 800, color: '#fff', flexShrink: 0,
      border: '2px solid rgba(167,139,250,0.4)',
    }}>
      {initial}
    </div>
  );
}

export default function DashboardPage() {
  const { accounts } = useMsal();
  const router = useRouter();

  const [userName, setUserName]   = useState('');
  const [userId, setUserId]       = useState('');
  const [weekStats, setWeekStats] = useState({ sessions: null, kgLifted: null, streak: null });
  const [todayPlan, setTodayPlan] = useState(null);
  const [coachNote, setCoachNote] = useState(null);
  const [level, setLevel]         = useState(null);
  const [xp, setXp]               = useState(null);
  const [xpToNext, setXpToNext]   = useState(null);
  const [readiness, setReadiness] = useState(null);
  const [weeklyGoal, setWeeklyGoal] = useState(null);
  const [loading, setLoading]     = useState(true);

  const xpPct = xp && xpToNext ? Math.round((xp / xpToNext) * 100) : null;

  useEffect(() => {
    if (!accounts || accounts.length === 0) return;
    const account = accounts[0];
    const uid = account.localAccountId;
    setUserId(uid);
    const displayName =
      account.idTokenClaims?.given_name ||
      account.idTokenClaims?.name ||
      account.idTokenClaims?.preferred_username ||
      account.name ||
      account.username?.split('@')[0] ||
      'Athlete';
    setUserName(displayName.toUpperCase());
    loadDashboardData(uid);
  }, [accounts]);

  async function loadDashboardData(uid) {
    try {
      const key = process.env.NEXT_PUBLIC_API_KEY || '';

      // Logs
      const logsRes = await fetch(`${API}/gymLogs?userId=${uid}`, {
        headers: { 'x-functions-key': key }
      });
      const logs = await logsRes.json();
      const allLogs = Array.isArray(logs) ? logs : [];

      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      weekStart.setHours(0, 0, 0, 0);

      const thisWeekLogs = allLogs.filter(l => new Date(l.date) >= weekStart);
      const totalKg = thisWeekLogs.reduce((sum, log) => {
        const sets = log.exercises?.flatMap(e => e.sets || []) || [];
        return sum + sets.reduce((s, set) => s + (parseFloat(set.kg) || 0) * (parseInt(set.reps) || 0), 0);
      }, 0);

      let streak = 0;
      const sortedDates = [...new Set(allLogs.map(l => l.date?.split('T')[0]))].sort().reverse();
      let checkDate = new Date();
      checkDate.setHours(0, 0, 0, 0);
      for (const d of sortedDates) {
        const logDate = new Date(d);
        logDate.setHours(0, 0, 0, 0);
        const diff = Math.round((checkDate - logDate) / 86400000);
        if (diff <= 1) { streak++; checkDate = logDate; }
        else break;
      }

      setWeekStats({
        sessions: thisWeekLogs.length,
        kgLifted: totalKg > 0 ? (totalKg >= 1000 ? (totalKg/1000).toFixed(1)+'K' : Math.round(totalKg).toString()) : '0',
        streak,
      });

      // Plans
      const plansRes = await fetch(`${API}/workoutPlans?userId=${uid}`, {
        headers: { 'x-functions-key': process.env.NEXT_PUBLIC_PLANS_API_KEY || '' }
      });
      const plans = await plansRes.json();
      if (Array.isArray(plans) && plans.length > 0) {
        const plan = plans[0];
        const dayNames = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
        setTodayPlan(plan.schedule?.[dayNames[now.getDay()]] || plan.sessions?.[0] || plan);
      }

      // Profile
      const profileRes = await fetch(`${API}/userProfiles?userId=${uid}`, {
        headers: { 'x-functions-key': process.env.NEXT_PUBLIC_PROFILES_API_KEY || '' }
      });
      const profileData = await profileRes.json();
      const profile = Array.isArray(profileData)
        ? profileData.find(p => p.userId === uid || p.id === uid)
        : profileData;

      if (profile && !profile.error) {
        if (profile.level)       setLevel(profile.level);
        if (profile.xp)          setXp(profile.xp);
        if (profile.xpToNext)    setXpToNext(profile.xpToNext);
        if (profile.name)        setUserName(profile.name.toUpperCase());
        if (profile.readiness)   setReadiness(profile.readiness);
        if (profile.weeklyGoal)  setWeeklyGoal(profile.weeklyGoal);
      }

      // AI coach note
      const noteRes = await fetch(`${API}/aiCoach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-functions-key': process.env.NEXT_PUBLIC_AI_COACH_KEY || '' },
        body: JSON.stringify({
          prompt: `Give a short motivational coach note (1 sentence, max 12 words) for someone with a ${streak}-day streak who has done ${thisWeekLogs.length} sessions this week.`,
        }),
      });
      const noteData = await noteRes.json();
      if (noteData.message) setCoachNote(noteData.message);

    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  }

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase();
  const sessionName   = todayPlan?.name      || 'No session today';
  const sessionMins   = todayPlan?.duration  || null;
  const sessionFocus  = todayPlan?.focus     || null;
  const sessionXP     = todayPlan?.xp        || null;
  const sessionIntens = todayPlan?.intensity || null;

  // Readiness label — only if real data
  const readinessLabel = readiness
    ? readiness >= 80 ? "Let's Get After It" : readiness >= 60 ? "Good to Go" : "Take It Easy"
    : null;

  // Sessions goal progress
  const sessionGoalPct = weeklyGoal && weekStats.sessions !== null
    ? Math.min(Math.round((weekStats.sessions / weeklyGoal) * 100), 100)
    : null;

  // Streak bar — out of 30 days as reference
  const streakPct = weekStats.streak !== null
    ? Math.min(Math.round((weekStats.streak / 30) * 100), 100)
    : null;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#09090F', color: '#fff', fontFamily: "'Inter', sans-serif", paddingBottom: '90px', overflowX: 'hidden' }}>

      {/* ── HEADER ── */}
      <div style={{ padding: '52px 20px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, color: '#a78bfa', fontWeight: 700, letterSpacing: '0.1em' }}>{getGreeting()}</p>
          <h1 style={{ margin: '2px 0 0', fontSize: 26, fontWeight: 900, letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: 8 }}>
            {loading ? '...' : userName} <span style={{ fontSize: 22 }}>💪</span>
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ position: 'relative' }}>
            <img src="/images/icon_bell.png" alt="notifications" style={{ width: 24, height: 24, opacity: 0.7 }}
              onError={(e) => { e.target.style.fontSize='22px'; e.target.outerHTML='<span style="font-size:22px">🔔</span>'; }} />
            <div style={{ position: 'absolute', top: -2, right: -2, width: 8, height: 8, borderRadius: '50%', background: '#a78bfa', border: '2px solid #09090F' }} />
          </div>
          <Avatar name={userName} size={40} fontSize={15} />
        </div>
      </div>

      {/* ── STREAK PILL ── */}
      <div style={{ padding: '0 20px 14px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(251,146,60,0.12)', border: '1px solid rgba(251,146,60,0.25)', borderRadius: 20, padding: '6px 14px' }}>
          <span style={{ fontSize: 16 }}>🔥</span>
          <span style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>
            {weekStats.streak !== null ? weekStats.streak : '—'}
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', letterSpacing: '0.06em' }}>DAY STREAK</span>
        </div>
      </div>

      {/* ── READINESS CARD ── */}
      <div style={{ margin: '0 20px 14px' }}>
        <div style={{ background: '#13131A', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 18 }}>
          {/* Ring */}
          <div style={{ position: 'relative', width: 80, height: 80, flexShrink: 0 }}>
            <svg width="80" height="80" viewBox="0 0 80 80">
              <defs>
                <linearGradient id="readGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#a78bfa" />
                  <stop offset="100%" stopColor="#6d28d9" />
                </linearGradient>
              </defs>
              <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(139,92,246,0.15)" strokeWidth="6" />
              {readiness && (
                <circle cx="40" cy="40" r="34" fill="none" stroke="url(#readGrad)" strokeWidth="6"
                  strokeDasharray={`${2 * Math.PI * 34 * readiness / 100} ${2 * Math.PI * 34}`}
                  strokeLinecap="round" transform="rotate(-90 40 40)" />
              )}
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              {readiness ? (
                <>
                  <span style={{ fontSize: 20, fontWeight: 900, lineHeight: 1 }}>{readiness}</span>
                  <span style={{ fontSize: 8, color: '#6b7280', fontWeight: 700, letterSpacing: '0.05em', marginTop: 1 }}>READINESS</span>
                </>
              ) : (
                <span style={{ fontSize: 11, color: '#4b5563', fontWeight: 600 }}>—</span>
              )}
            </div>
          </div>

          {/* Text */}
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#fff' }}>
              {readinessLabel || 'Readiness Pending'}
            </p>
            <p style={{ margin: '3px 0 10px', fontSize: 12, color: '#9ca3af' }}>
              {readiness ? 'Based on your training load.' : 'Complete a check-in to see your score.'}
            </p>

            {/* XP Bar */}
            <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 6, height: 5 }}>
              {xpPct !== null && (
                <div style={{ width: `${xpPct}%`, height: '100%', borderRadius: 6, background: 'linear-gradient(90deg, #7c3aed, #a78bfa)' }} />
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
              <span style={{ fontSize: 10, color: '#6b7280' }}>
                {xp && xpToNext ? `${xpToNext - xp} XP to next level` : 'XP not set yet'}
              </span>
              <span style={{ fontSize: 10, fontWeight: 800, color: '#a78bfa' }}>
                {level ? `LVL ${level}` : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── SESSION CARD ── */}
      <div style={{ margin: '0 20px 14px' }}>
        <div style={{
          background: 'linear-gradient(135deg, #110820 0%, #0c1535 60%, #0a0d28 100%)',
          border: '1px solid rgba(139,92,246,0.3)',
          borderRadius: 20, padding: '18px 18px 16px',
          position: 'relative', overflow: 'hidden', minHeight: 220,
        }}>
          <div style={{ position: 'absolute', top: '20%', right: '-10%', width: 220, height: 220, background: 'radial-gradient(circle, rgba(109,40,217,0.5) 0%, transparent 70%)', pointerEvents: 'none' }} />

          {/* Avatar top right */}
          <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 5 }}>
            <Avatar name={userName} size={52} fontSize={18} />
          </div>

          {/* Date */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 12 }}>📅</span>
            <span style={{ fontSize: 11, color: '#818cf8', fontWeight: 600, letterSpacing: '0.06em' }}>{dateStr}</span>
          </div>

          {/* Session name */}
          <h2 style={{ margin: '0 0 10px', fontSize: 30, fontWeight: 900, lineHeight: 1.0, letterSpacing: '-0.02em', maxWidth: '65%' }}>
            {sessionName}
          </h2>

          {/* Intensity tag — only if real */}
          {sessionIntens && (
            <div style={{ marginBottom: 14 }}>
              <span style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', padding: '4px 12px', borderRadius: 20, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                🔥 {sessionIntens}
              </span>
            </div>
          )}

          {/* Meta row — only show items with real data */}
          <div style={{ display: 'flex', gap: 20, marginBottom: 16, flexWrap: 'wrap' }}>
            {sessionMins && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 12 }}>⏱</span>
                  <span style={{ fontSize: 13, fontWeight: 800 }}>{sessionMins} MIN</span>
                </div>
                <p style={{ margin: '2px 0 0 20px', fontSize: 9, color: '#6b7280', letterSpacing: '0.05em' }}>DURATION</p>
              </div>
            )}
            {sessionFocus && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 12 }}>🎯</span>
                  <span style={{ fontSize: 13, fontWeight: 800 }}>FOCUS</span>
                </div>
                <p style={{ margin: '2px 0 0 20px', fontSize: 9, color: '#6b7280', letterSpacing: '0.05em' }}>{sessionFocus}</p>
              </div>
            )}
            {sessionXP && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 12 }}>⭐</span>
                  <span style={{ fontSize: 13, fontWeight: 800 }}>+{sessionXP} XP</span>
                </div>
                <p style={{ margin: '2px 0 0 20px', fontSize: 9, color: '#6b7280', letterSpacing: '0.05em' }}>REWARD</p>
              </div>
            )}
          </div>

          {/* Start button — only if there's a real plan */}
          {todayPlan ? (
            <button onClick={() => router.push('/workout')} style={{
              background: 'linear-gradient(135deg, #6d28d9, #4f46e5)',
              border: 'none', borderRadius: 14, padding: '14px 0',
              width: '100%', color: '#fff', fontSize: 15, fontWeight: 800,
              letterSpacing: '0.08em', cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(109,40,217,0.4)',
            }}>
              START SESSION →
            </button>
          ) : (
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.12)', borderRadius: 14, padding: '14px 0', textAlign: 'center', color: '#6b7280', fontSize: 13, fontWeight: 600 }}>
              No session assigned yet
            </div>
          )}
        </div>
      </div>

      {/* ── THIS WEEK ── */}
      <div style={{ padding: '0 20px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.1em' }}>THIS WEEK</p>
          <button onClick={() => router.push('/progress')} style={{ background: 'none', border: 'none', color: '#a78bfa', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            VIEW ALL &gt;
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>

          {/* Sessions */}
          <div style={{ background: '#0e0e1a', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(109,40,217,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src="/images/icon_stats.png" alt="sessions" style={{ width: 26, height: 26 }} onError={(e) => { e.target.style.display='none'; }} />
            </div>
            <p style={{ margin: 0, fontSize: 26, fontWeight: 900, lineHeight: 1 }}>
              {weekStats.sessions !== null ? weekStats.sessions : '—'}
            </p>
            <p style={{ margin: 0, fontSize: 9, color: '#6b7280', fontWeight: 700, letterSpacing: '0.05em' }}>SESSIONS</p>
            <p style={{ margin: 0, fontSize: 9, color: '#a78bfa', fontWeight: 600 }}>
              {weeklyGoal ? `${sessionGoalPct}% of goal` : 'Set a weekly goal'}
            </p>
            <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 4, height: 3, marginTop: 2 }}>
              {sessionGoalPct !== null && (
                <div style={{ width: `${sessionGoalPct}%`, height: '100%', borderRadius: 4, background: '#7c3aed' }} />
              )}
            </div>
          </div>

          {/* KG Lifted */}
          <div style={{ background: '#0e0e1a', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(109,40,217,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src="/images/icon_workout.png" alt="kg" style={{ width: 26, height: 26 }} onError={(e) => { e.target.style.display='none'; }} />
            </div>
            <p style={{ margin: 0, fontSize: 26, fontWeight: 900, lineHeight: 1 }}>
              {weekStats.kgLifted !== null ? weekStats.kgLifted : '—'}
            </p>
            <p style={{ margin: 0, fontSize: 9, color: '#6b7280', fontWeight: 700, letterSpacing: '0.05em' }}>KG LIFTED</p>
            <p style={{ margin: 0, fontSize: 9, color: '#a78bfa', fontWeight: 600 }}>—</p>
            <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 4, height: 3, marginTop: 2 }}>
              <div style={{ width: '0%', height: '100%', borderRadius: 4, background: '#7c3aed' }} />
            </div>
          </div>

          {/* Streak */}
          <div style={{ background: '#0e0e1a', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(109,40,217,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src="/images/icon_fire.png" alt="streak" style={{ width: 26, height: 26 }} onError={(e) => { e.target.style.display='none'; }} />
            </div>
            <p style={{ margin: 0, fontSize: 26, fontWeight: 900, lineHeight: 1 }}>
              {weekStats.streak !== null ? weekStats.streak : '—'}
            </p>
            <p style={{ margin: 0, fontSize: 9, color: '#6b7280', fontWeight: 700, letterSpacing: '0.05em' }}>DAY STREAK</p>
            <p style={{ margin: 0, fontSize: 9, color: '#f97316', fontWeight: 600 }}>
              {weekStats.streak > 0 ? 'Keep it up!' : 'Start your streak!'}
            </p>
            <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 4, height: 3, marginTop: 2 }}>
              {streakPct !== null && (
                <div style={{ width: `${streakPct}%`, height: '100%', borderRadius: 4, background: '#f97316' }} />
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ── AI COACH CARD ── */}
      <div style={{ margin: '0 20px 14px' }}>
        <div style={{ background: 'linear-gradient(135deg, #130d2a, #0d1535)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 20, padding: '16px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg, #4c1d95, #1e1b4b)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid rgba(139,92,246,0.3)', fontSize: 24 }}>
            🐕
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <span style={{ fontSize: 14, fontWeight: 900, letterSpacing: '0.04em' }}>AI COACH</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: '#a78bfa', background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 6, padding: '2px 6px', letterSpacing: '0.06em' }}>BETA</span>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: '#9ca3af', lineHeight: 1.4 }}>
              {coachNote || 'Ready to optimize your performance? I\'ve got a session plan for you.'}
            </p>
          </div>
          <button onClick={() => router.push('/coach')} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '10px 14px', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
            VIEW PLAN ›
          </button>
        </div>
      </div>

      {/* ── BOTTOM NAV ── */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#0d0d14', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', zIndex: 100, paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {[
          { label: 'Home',      icon: '/images/icon_home.png',          href: '/dashboard', active: true  },
          { label: 'Train',     icon: '/images/icon_workout.png',       href: '/workout',   active: false },
          { label: 'Progress',  icon: '/images/Icon_progress.png',    href: '/progress',  active: false },
          { label: 'Community', icon: '/images/icon_community.png',   href: '/community', active: false },
          { label: 'Profile',   icon: '/images/icon_profile_nav.png', href: '/profile',   active: false },
        ].map((item) => (
          <button key={item.label} onClick={() => router.push(item.href)} style={{ flex: 1, background: 'transparent', border: 'none', cursor: 'pointer', padding: '10px 0 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <img src={item.icon} alt={item.label} style={{ width: 24, height: 24, opacity: item.active ? 1 : 0.4 }}
              onError={(e) => { e.target.style.display='none'; }} />
            <span style={{ fontSize: 10, fontWeight: item.active ? 700 : 400, color: item.active ? '#a78bfa' : '#6b7280' }}>{item.label}</span>
            {item.active && <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#a78bfa' }} />}
          </button>
        ))}
      </div>

    </div>
  );
}
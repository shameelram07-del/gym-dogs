'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMsal } from '@azure/msal-react';

const API = 'https://gymdogs-api-g9d0gve4angygdcj.newzealandnorth-01.azurewebsites.net/api';

const LEADERBOARD = [
  { rank: 1, name: 'Joel',    initials: 'J', pts: 5888.1, medal: '🥇' },
  { rank: 2, name: 'Shameel', initials: 'S', pts: 4698.1, medal: '🥈', isYou: true },
  { rank: 3, name: 'Harish',  initials: 'H', pts: 3298.1, medal: '🥉' },
  { rank: 4, name: 'Zai',     initials: 'Z', pts: 2698.1, medal: null },
];

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
  const [weekStats, setWeekStats] = useState({ sessions: 0, kgLifted: '0', streak: 0 });
  const [todayPlan, setTodayPlan] = useState(null);
  const [coachNote, setCoachNote] = useState('Ready to optimize your performance? I\'ve got a session plan for you.');
  const [level, setLevel]         = useState(12);
  const [xp, setXp]               = useState(580);
  const [xpToNext, setXpToNext]   = useState(1000);
  const [readiness]               = useState(70);
  const [loading, setLoading]     = useState(true);

  const xpPct = Math.round((xp / xpToNext) * 100);

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
        kgLifted: totalKg >= 1000 ? totalKg.toLocaleString() : Math.round(totalKg).toString(),
        streak,
      });

      const plansRes = await fetch(`${API}/workoutPlans?userId=${uid}`, {
        headers: { 'x-functions-key': process.env.NEXT_PUBLIC_PLANS_API_KEY || '' }
      });
      const plans = await plansRes.json();
      if (Array.isArray(plans) && plans.length > 0) {
        const plan = plans[0];
        const dayNames = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
        setTodayPlan(plan.schedule?.[dayNames[now.getDay()]] || plan.sessions?.[0] || plan);
      }

      const profileRes = await fetch(`${API}/userProfiles?userId=${uid}`, {
        headers: { 'x-functions-key': process.env.NEXT_PUBLIC_PROFILES_API_KEY || '' }
      });
      const profileData = await profileRes.json();
      const profile = Array.isArray(profileData)
        ? profileData.find(p => p.userId === uid || p.id === uid)
        : profileData;

      if (profile && !profile.error) {
        if (profile.level)    setLevel(profile.level);
        if (profile.xp)       setXp(profile.xp);
        if (profile.xpToNext) setXpToNext(profile.xpToNext);
        if (profile.name)     setUserName(profile.name.toUpperCase());
      }

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
  const sessionName   = todayPlan?.name         || 'SHOULDER / CHEST';
  const sessionMins   = todayPlan?.duration      || 75;
  const sessionFocus  = todayPlan?.focus         || 'Push Focus';
  const sessionXP     = todayPlan?.xp            || 350;
  const sessionIntens = todayPlan?.intensity     || 'HIGH INTENSITY';

  // Readiness label
  const readinessLabel = readiness >= 80 ? "Let's Get After It" : readiness >= 60 ? "Good to Go" : "Take It Easy";
  const readinessSubtext = readiness >= 80 ? "You're ready to crush today." : readiness >= 60 ? "Solid readiness today." : "Consider a lighter session.";

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#09090F', color: '#fff', fontFamily: "'Inter', sans-serif", paddingBottom: '90px', overflowX: 'hidden' }}>

      {/* ── HEADER ── */}
      <div style={{ padding: '52px 20px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {/* Greeting */}
        <div>
          <p style={{ margin: 0, fontSize: 11, color: '#a78bfa', fontWeight: 700, letterSpacing: '0.1em' }}>{getGreeting()}</p>
          <h1 style={{ margin: '2px 0 0', fontSize: 26, fontWeight: 900, letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: 8 }}>
            {loading ? '...' : userName} <span style={{ fontSize: 22 }}>💪</span>
          </h1>
        </div>

        {/* Right side — bell + avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Bell */}
          <div style={{ position: 'relative' }}>
            <img
              src="/images/icon_bell.png"
              alt="notifications"
              style={{ width: 24, height: 24, opacity: 0.7 }}
              onError={(e) => { e.target.replaceWith(Object.assign(document.createElement('span'), { textContent: '🔔', style: 'font-size:22px' })); }}
            />
            <div style={{ position: 'absolute', top: -2, right: -2, width: 8, height: 8, borderRadius: '50%', background: '#a78bfa', border: '2px solid #09090F' }} />
          </div>
          {/* Avatar */}
          <Avatar name={userName} size={40} fontSize={15} />
        </div>
      </div>

      {/* ── STREAK PILL ── */}
      <div style={{ padding: '0 20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(251,146,60,0.12)', border: '1px solid rgba(251,146,60,0.25)', borderRadius: 20, padding: '6px 14px' }}>
          <span style={{ fontSize: 16 }}>🔥</span>
          <span style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>{weekStats.streak}</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', letterSpacing: '0.06em' }}>DAY STREAK</span>
        </div>
      </div>

      {/* ── READINESS CARD ── */}
      <div style={{ margin: '0 20px 16px' }}>
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
              <circle cx="40" cy="40" r="34" fill="none" stroke="url(#readGrad)" strokeWidth="6"
                strokeDasharray={`${2 * Math.PI * 34 * readiness / 100} ${2 * Math.PI * 34}`}
                strokeLinecap="round" transform="rotate(-90 40 40)" />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 20, fontWeight: 900, lineHeight: 1 }}>{readiness}</span>
              <span style={{ fontSize: 8, color: '#6b7280', fontWeight: 700, letterSpacing: '0.05em', marginTop: 1 }}>READINESS</span>
            </div>
          </div>

          {/* Text */}
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#fff' }}>{readinessLabel}</p>
            <p style={{ margin: '3px 0 10px', fontSize: 12, color: '#9ca3af' }}>{readinessSubtext}</p>
            <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 6, height: 5 }}>
              <div style={{ width: `${xpPct}%`, height: '100%', borderRadius: 6, background: 'linear-gradient(90deg, #7c3aed, #a78bfa)' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
              <span style={{ fontSize: 10, color: '#6b7280' }}>{xpToNext - xp} XP to next level</span>
              <span style={{ fontSize: 10, fontWeight: 800, color: '#a78bfa' }}>LVL {level}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── SESSION CARD ── */}
      <div style={{ margin: '0 20px 16px' }}>
        <div style={{
          background: 'linear-gradient(135deg, #110820 0%, #0c1535 60%, #0a0d28 100%)',
          border: '1px solid rgba(139,92,246,0.3)',
          borderRadius: 20, padding: '18px 18px 16px',
          position: 'relative', overflow: 'hidden', minHeight: 240,
        }}>
          {/* Glow */}
          <div style={{ position: 'absolute', top: '20%', right: '-10%', width: 220, height: 220, background: 'radial-gradient(circle, rgba(109,40,217,0.5) 0%, transparent 70%)', pointerEvents: 'none' }} />

          {/* Avatar in card top right */}
          <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 5 }}>
            <Avatar name={userName} size={56} fontSize={20} />
          </div>

          {/* Date */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 12 }}>📅</span>
            <span style={{ fontSize: 11, color: '#818cf8', fontWeight: 600, letterSpacing: '0.06em' }}>{dateStr}</span>
          </div>

          {/* Session name */}
          <h2 style={{ margin: '0 0 10px', fontSize: 34, fontWeight: 900, lineHeight: 1.0, letterSpacing: '-0.02em', maxWidth: '65%' }}>
            {sessionName}
          </h2>

          {/* Intensity tag */}
          <div style={{ marginBottom: 14 }}>
            <span style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', padding: '4px 12px', borderRadius: 20, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              🔥 {sessionIntens}
            </span>
          </div>

          {/* Meta row */}
          <div style={{ display: 'flex', gap: 20, marginBottom: 16 }}>
            {[
              { icon: '⏱', val: `${sessionMins} MIN`, label: 'DURATION' },
              { icon: '🎯', val: 'FOCUS',              label: sessionFocus },
              { icon: '⭐', val: `+${sessionXP} XP`,  label: 'REWARD' },
            ].map((m, i) => (
              <div key={i}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 12 }}>{m.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>{m.val}</span>
                </div>
                <p style={{ margin: '2px 0 0 20px', fontSize: 9, color: '#6b7280', letterSpacing: '0.05em' }}>{m.label}</p>
              </div>
            ))}
          </div>

          {/* Start button */}
          <button onClick={() => router.push('/workout')} style={{
            background: 'linear-gradient(135deg, #6d28d9, #4f46e5)',
            border: 'none', borderRadius: 14, padding: '14px 0',
            width: '100%', color: '#fff', fontSize: 15, fontWeight: 800,
            letterSpacing: '0.08em', cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(109,40,217,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            START SESSION →
          </button>
        </div>
      </div>

      {/* ── THIS WEEK ── */}
      <div style={{ padding: '0 20px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.1em' }}>THIS WEEK</p>
          <button onClick={() => router.push('/progress')} style={{ background: 'none', border: 'none', color: '#a78bfa', fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', cursor: 'pointer' }}>
            VIEW ALL &gt;
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {[
            { icon: '/images/icon_3.png', val: weekStats.sessions, label: 'SESSIONS', sub: '80% of goal', subColor: '#a78bfa', barColor: '#7c3aed', barPct: 80, bg: '#0e0e1a' },
            { icon: '/images/icon_9.png', val: weekStats.kgLifted, label: 'KG LIFTED', sub: '+18% vs last week', subColor: '#a78bfa', barColor: '#7c3aed', barPct: 65, bg: '#0e0e1a' },
            { icon: '/images/icon_13.png', val: weekStats.streak, label: 'DAY STREAK', sub: 'Keep it up!', subColor: '#a78bfa', barColor: '#f97316', barPct: weekStats.streak * 10, bg: '#0e0e1a' },
          ].map((c, i) => (
            <div key={i} style={{ background: c.bg, border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {/* Icon in purple square */}
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(109,40,217,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src={c.icon} alt={c.label} style={{ width: 26, height: 26 }} onError={(e) => { e.target.style.display = 'none'; }} />
              </div>
              <p style={{ margin: 0, fontSize: 26, fontWeight: 900, lineHeight: 1, color: '#fff' }}>{c.val}</p>
              <p style={{ margin: 0, fontSize: 9, color: '#6b7280', fontWeight: 700, letterSpacing: '0.05em' }}>{c.label}</p>
              <p style={{ margin: 0, fontSize: 9, color: c.subColor, fontWeight: 600 }}>{c.sub}</p>
              {/* Progress bar */}
              <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 4, height: 3, marginTop: 2 }}>
                <div style={{ width: `${Math.min(c.barPct, 100)}%`, height: '100%', borderRadius: 4, background: c.barColor }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── AI COACH CARD ── */}
      <div style={{ margin: '0 20px 16px' }}>
        <div style={{ background: 'linear-gradient(135deg, #130d2a, #0d1535)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 20, padding: '16px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* AI avatar */}
          <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg, #4c1d95, #1e1b4b)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid rgba(139,92,246,0.3)' }}>
            <span style={{ fontSize: 24 }}>🐕</span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <span style={{ fontSize: 14, fontWeight: 900, color: '#fff', letterSpacing: '0.04em' }}>AI COACH</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: '#a78bfa', background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 6, padding: '2px 6px', letterSpacing: '0.06em' }}>BETA</span>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: '#9ca3af', lineHeight: 1.4 }}>{coachNote}</p>
          </div>
          <button onClick={() => router.push('/coach')} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '10px 14px', color: '#fff', fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            VIEW PLAN <span style={{ fontSize: 14 }}>›</span>
          </button>
        </div>
      </div>

      {/* ── BOTTOM NAV ── */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#0d0d14', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', zIndex: 100, paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {[
          { label: 'Home',      icon: '/images/icon_2.png',           href: '/dashboard', active: true  },
          { label: 'Train',     icon: '/images/icon_train.png',        href: '/workout',   active: false },
          { label: 'Progress',  icon: '/images/icon_progress.png',     href: '/progress',  active: false },
          { label: 'Community', icon: '/images/icon_community.png',    href: '/community', active: false },
          { label: 'Profile',   icon: '/images/icon_profile_nav.png',  href: '/profile',   active: false },
        ].map((item) => (
          <button key={item.label} onClick={() => router.push(item.href)} style={{ flex: 1, background: 'transparent', border: 'none', cursor: 'pointer', padding: '10px 0 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <img src={item.icon} alt={item.label} style={{ width: 24, height: 24, opacity: item.active ? 1 : 0.4 }}
              onError={(e) => { e.target.style.display = 'none'; }} />
            <span style={{ fontSize: 10, fontWeight: item.active ? 700 : 400, color: item.active ? '#a78bfa' : '#6b7280' }}>{item.label}</span>
            {item.active && <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#a78bfa' }} />}
          </button>
        ))}
      </div>

    </div>
  );
}
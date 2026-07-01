'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMsal } from '@azure/msal-react';
import BottomNav from '@/components/BottomNav';
import ThemeToggle from '@/components/ThemeToggle';

const API = 'https://gymdogs-api-g9d0gve4angygdcj.newzealandnorth-01.azurewebsites.net/api';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function titleCase(s) {
  if (!s) return s;
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function Avatar({ name, size = 42, fontSize = 15, onClick }) {
  const initial = (name || 'S').charAt(0).toUpperCase();
  return (
    <div
      onClick={onClick}
      style={{
        width: size, height: size, borderRadius: '50%',
        background: 'linear-gradient(135deg, var(--violet), var(--blue))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize, fontWeight: 700, color: '#fff', flexShrink: 0,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      {initial}
    </div>
  );
}

const card = {
  background: 'var(--card)',
  border: '1px solid var(--line)',
  borderRadius: 22,
  padding: 18,
  marginBottom: 14,
};

const eyebrow = {
  fontSize: 11, fontWeight: 700, letterSpacing: '0.09em',
  color: 'var(--ink-3)', textTransform: 'uppercase', margin: 0,
};

export default function DashboardPage() {
  const { accounts } = useMsal();
  const router = useRouter();

  const [userName, setUserName]     = useState('');
  const [userId, setUserId]         = useState('');
  const [weekStats, setWeekStats]   = useState({ sessions: null, kgLifted: null, streak: null });
  const [todayPlan, setTodayPlan]   = useState(null);
  const [coachNote, setCoachNote]   = useState(null);
  const [level, setLevel]           = useState(null);
  const [xp, setXp]                 = useState(null);
  const [xpToNext, setXpToNext]     = useState(null);
  const [readiness, setReadiness]   = useState(null);
  const [weeklyGoal, setWeeklyGoal] = useState(null);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    if (!accounts || accounts.length === 0) return;
    const account = accounts[0];
    const uid = account.localAccountId;
    setUserId(uid);
    const msalName = (account.name && account.name !== 'unknown')
      ? account.name
      : account.username?.split('@')[0] || '...';
    setUserName(titleCase(msalName));
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
        kgLifted: totalKg > 0 ? (totalKg >= 1000 ? (totalKg/1000).toFixed(1)+'k' : Math.round(totalKg).toString()) : '0',
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
      const profile = Array.isArray(profileData) ? profileData[0] : profileData;

      if (profile && !profile.error) {
        if (profile.level)      setLevel(profile.level);
        if (profile.xp)         setXp(profile.xp);
        if (profile.xpToNext)   setXpToNext(profile.xpToNext);
        if (profile.readiness)  setReadiness(profile.readiness);
        if (profile.weeklyGoal) setWeeklyGoal(profile.weeklyGoal);
        if (profile.name && profile.name.length < 50) {
          setUserName(titleCase(profile.name));
        }
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
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const sessionName   = todayPlan?.name      || null;
  const sessionMins   = todayPlan?.duration  || null;
  const sessionFocus  = todayPlan?.focus     || null;
  const exerciseCount = todayPlan?.exercises?.length || null;

  const readinessLabel = readiness
    ? readiness >= 80 ? 'Primed to train' : readiness >= 60 ? 'Good to go' : 'Take it easy'
    : 'Readiness pending';

  const readinessSub = readiness
    ? readiness >= 80 ? 'Recovery is high. A great day to push volume.'
      : readiness >= 60 ? 'Solid recovery. Train as planned today.'
      : 'Recovery is low. Keep intensity moderate.'
    : 'Complete a check-in to see your score.';

  const R = 52;
  const CIRC = 2 * Math.PI * R;
  const ringOffset = readiness ? CIRC * (1 - readiness / 100) : CIRC;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)', paddingBottom: 96 }}>

      {/* ── HEADER ── */}
      <div style={{ padding: '52px 20px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-2)' }}>{dateStr}</p>
          <h1 style={{ margin: '2px 0 0', fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em' }}>
            {getGreeting()}{userName ? `, ${userName.split(' ')[0]}` : ''}
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ThemeToggle />
          <Avatar name={userName} onClick={() => router.push('/profile')} />
        </div>
      </div>

      <div style={{ padding: '0 20px' }}>

        {/* ── READINESS ── */}
        <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ position: 'relative', width: 100, height: 100, flexShrink: 0 }}>
            <svg width="100" height="100" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r={R} fill="none" stroke="var(--soft)" strokeWidth="11" />
              {readiness && (
                <circle cx="60" cy="60" r={R} fill="none" stroke="var(--accent)" strokeWidth="11"
                  strokeLinecap="round" strokeDasharray={CIRC} strokeDashoffset={ringOffset}
                  transform="rotate(-90 60 60)" />
              )}
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 30, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.03em' }}>
                {readiness || '—'}
              </span>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--ink-3)', marginTop: 3 }}>READY</span>
            </div>
          </div>
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 16 }}>{readinessLabel}</p>
            <p style={{ margin: '7px 0 0', fontSize: 13, lineHeight: 1.5, color: 'var(--ink-2)' }}>{readinessSub}</p>
          </div>
        </div>

        {/* ── TODAY'S SESSION ── */}
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '18px 18px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={eyebrow}>Today&rsquo;s session</p>
                <p style={{ margin: '5px 0 0', fontSize: 19, fontWeight: 800, letterSpacing: '-0.02em' }}>
                  {sessionName || 'Rest day'}
                </p>
              </div>
              <div style={{ width: 46, height: 46, borderRadius: 14, background: 'var(--accent-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                🏋️
              </div>
            </div>
            {sessionName && (
              <div style={{ display: 'flex', gap: 8, marginTop: 13, flexWrap: 'wrap' }}>
                {exerciseCount && <span style={chip}>{exerciseCount} exercises</span>}
                {sessionMins && <span style={chip}>~{sessionMins} min</span>}
                {sessionFocus && <span style={chip}>{sessionFocus}</span>}
              </div>
            )}
          </div>
          {todayPlan ? (
            <button onClick={() => router.push('/workout')} style={{
              width: '100%', border: 'none', background: 'var(--accent)', color: 'var(--on-accent)',
              padding: 16, fontSize: 15, fontWeight: 700, cursor: 'pointer',
            }}>
              Start session →
            </button>
          ) : (
            <div style={{ padding: '0 18px 18px' }}>
              <div style={{ background: 'var(--soft)', borderRadius: 14, padding: 14, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13, fontWeight: 600 }}>
                No session assigned yet
              </div>
            </div>
          )}
        </div>

        {/* ── THIS WEEK ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 4px 9px' }}>
          <p style={eyebrow}>This week</p>
          <button onClick={() => router.push('/progress')} style={{ background: 'none', border: 'none', color: 'var(--accent-strong)', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0 }}>
            View all ›
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
          <Stat value={weekStats.sessions !== null ? weekStats.sessions : '—'} label="sessions" />
          <Stat value={weekStats.kgLifted !== null ? weekStats.kgLifted : '—'} label="kg lifted" />
          <Stat value={weekStats.streak !== null ? weekStats.streak : '—'} label="day streak" color="var(--orange)" suffix="🔥" />
        </div>

        {/* ── AI COACH ── */}
        <div style={{ background: `linear-gradient(135deg, var(--ai-card-1), var(--ai-card-2))`, borderRadius: 22, padding: 18, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 18 }}>✨</span>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>AI Coach</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: '#C9C5FF', background: 'rgba(122,90,248,0.25)', borderRadius: 6, padding: '2px 7px', letterSpacing: '0.06em' }}>BETA</span>
          </div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: '#D9D9E3' }}>
            {coachNote || 'Ready to optimise your performance? Start a session and I will track your progress.'}
          </p>
        </div>

        <button onClick={() => router.push('/nutrition')} style={{ ...card, width: '100%', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', textAlign: 'left' }}>
          <div style={{ width: 46, height: 46, borderRadius: 14, background: 'var(--accent-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🥗</div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Nutrition</p>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--ink-2)' }}>Log meals and macros</p>
          </div>
          <span style={{ color: 'var(--ink-3)', fontSize: 18 }}>›</span>
        </button>

      </div>

      <BottomNav />
    </div>
  );
}

const chip = {
  fontSize: 12, fontWeight: 600, padding: '6px 11px', borderRadius: 999,
  background: 'var(--soft)', color: 'var(--ink-2)',
};

function Stat({ value, label, color, suffix }) {
  return (
    <div style={{ background: 'var(--soft)', borderRadius: 16, padding: '14px 8px', textAlign: 'center' }}>
      <p style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: color || 'var(--ink)' }}>
        {value}{suffix && <span style={{ fontSize: 16 }}>{suffix}</span>}
      </p>
      <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--ink-3)', fontWeight: 600 }}>{label}</p>
    </div>
  );
}

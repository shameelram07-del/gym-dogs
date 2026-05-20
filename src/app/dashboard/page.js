'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMsal } from '@azure/msal-react';

const CUTOUT_MAP = {
  '6d765ac9-47b2-4d3f-b36a-9d784015b917': '/images/shameel double_bicep_waist_up.png',
};

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

export default function DashboardPage() {
  const { accounts } = useMsal();
  const router = useRouter();

  const [userName, setUserName]   = useState('');
  const [userId, setUserId]       = useState('');
  const [weekStats, setWeekStats] = useState({ sessions: 0, kgLifted: '0', streak: 0 });
  const [todayPlan, setTodayPlan] = useState(null);
  const [coachNote, setCoachNote] = useState('Ready to start your journey? Your coach has a session ready for you!');
  const [level, setLevel]         = useState(12);
  const [xp, setXp]               = useState(580);
  const [xpToNext, setXpToNext]   = useState(1000);
  const [readiness]               = useState(70);
  const [loading, setLoading]     = useState(true);
  const [isDesktop, setIsDesktop] = useState(false);

  const cutout = CUTOUT_MAP[userId] || null;
  const xpPct  = Math.round((xp / xpToNext) * 100);

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

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
      const logsRes = await fetch(
        `https://gymdogs-api-g9d0gve4angygdcj.newzealandnorth-01.azurewebsites.net/api/gymLogs?userId=${uid}`,
        { headers: { 'x-functions-key': process.env.NEXT_PUBLIC_API_KEY || '' } }
      );
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
        kgLifted: totalKg >= 1000 ? (totalKg / 1000).toFixed(1) + 'K' : Math.round(totalKg).toString(),
        streak,
      });

      const plansRes = await fetch(
        `https://gymdogs-api-g9d0gve4angygdcj.newzealandnorth-01.azurewebsites.net/api/workoutPlans?userId=${uid}`,
        { headers: { 'x-functions-key': process.env.NEXT_PUBLIC_PLANS_API_KEY || '' } }
      );
      const plans = await plansRes.json();
      if (Array.isArray(plans) && plans.length > 0) {
        const plan = plans[0];
        const dayNames = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
        setTodayPlan(plan.schedule?.[dayNames[now.getDay()]] || plan.sessions?.[0] || null);
      }

      const profileRes = await fetch(
        `https://gymdogs-api-g9d0gve4angygdcj.newzealandnorth-01.azurewebsites.net/api/userProfiles?userId=${uid}`,
        { headers: { 'x-functions-key': process.env.NEXT_PUBLIC_PROFILES_API_KEY || '' } }
      );
      const profile = await profileRes.json();
      if (profile && !profile.error) {
        if (profile.level)    setLevel(profile.level);
        if (profile.xp)       setXp(profile.xp);
        if (profile.xpToNext) setXpToNext(profile.xpToNext);
        if (profile.name)     setUserName(profile.name.toUpperCase());
      }

      const noteRes = await fetch('https://gymdogs-api-g9d0gve4angygdcj.newzealandnorth-01.azurewebsites.net/api/aiCoach', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-functions-key': process.env.NEXT_PUBLIC_AI_COACH_KEY || '',
        },
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
  const dateStr = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
  const sessionName   = todayPlan?.name         || 'SHOULDER / CHEST';
  const sessionTags   = todayPlan?.tags          || ['STRENGTH', '4 EXERCISES', 'HIGH INTENSITY'];
  const sessionMins   = todayPlan?.duration      || 75;
  const sessionFocus  = todayPlan?.focus         || 'PUSH FOCUS';
  const sessionXP     = todayPlan?.xp            || 350;
  const sessionIntens = todayPlan?.intensity     || 'HIGH';
  const sessionPct    = todayPlan?.completionPct || 0;

  const BottomNav = () => (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#0d1117', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', zIndex: 100, paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {[
        { label: 'Home',      icon: '/images/icon_2.png',        href: '/dashboard',  active: true  },
        { label: 'Log',       icon: '/images/icon_3.png',        href: '/workout',    active: false },
        { label: 'Progress',  icon: '/images/icon_4.png',        href: '/progress',   active: false },
        { label: 'Community', icon: '/images/extra_icon_10.png', href: '/community',  active: false },
        { label: 'Coach',     icon: '/images/icon_5.png',        href: '/coach',      active: false },
        { label: 'Profile',   icon: '/images/icon_6.png',        href: '/profile',    active: false },
      ].map((item) => (
        <button key={item.label} onClick={() => router.push(item.href)} style={{ flex: 1, background: 'transparent', border: 'none', cursor: 'pointer', padding: '10px 0 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
          <img src={item.icon} alt={item.label} style={{ width: 24, height: 24, opacity: item.active ? 1 : 0.4 }} />
          <span style={{ fontSize: '10px', fontWeight: item.active ? 700 : 400, color: item.active ? '#a78bfa' : '#6b7280' }}>{item.label}</span>
          {item.active && <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#a78bfa', marginTop: -1 }} />}
        </button>
      ))}
    </div>
  );

  if (!isDesktop) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#080C14', color: '#fff', fontFamily: "'Inter', sans-serif", paddingBottom: '90px', overflowX: 'hidden' }}>
        <div style={{ padding: '20px 18px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ fontSize: '11px', color: '#a78bfa', fontWeight: 600, letterSpacing: '0.1em', margin: '0 0 2px' }}>{getGreeting()}</p>
            <h1 style={{ fontSize: '24px', fontWeight: 900, margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              {loading ? '...' : userName} <span style={{ fontSize: '20px' }}>💪</span>
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.35)', borderRadius: '20px', padding: '4px 10px 4px 6px' }}>
              <img src="/images/icon_8.png" alt="level" style={{ width: 18, height: 18 }} />
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#a78bfa' }}>{level}</span>
            </div>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, color: '#fff', border: '2px solid rgba(167,139,250,0.4)' }}>
              {userName?.charAt(0) || 'S'}
            </div>
          </div>
        </div>
        <div style={{ padding: '12px 18px 0' }}>
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img src="/images/icon_9.png" alt="badge" style={{ width: 52, height: 52, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: '28px', fontWeight: 900, color: '#34d399' }}>{readiness}</span>
                <div>
                  <p style={{ margin: 0, fontSize: '12px', fontWeight: 700 }}>Let&apos;s Get Started</p>
                  <p style={{ margin: 0, fontSize: '9px', color: '#6b7280', fontWeight: 600, letterSpacing: '0.06em' }}>READINESS SCORE</p>
                </div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '6px', height: '5px', margin: '6px 0 4px' }}>
                <div style={{ width: `${xpPct}%`, height: '100%', borderRadius: '6px', background: 'linear-gradient(90deg, #34d399, #10b981)' }} />
              </div>
              <p style={{ margin: 0, fontSize: '10px', color: '#6b7280' }}>{xpToNext - xp} XP to next level</p>
            </div>
          </div>
        </div>
        <div style={{ padding: '12px 18px 0' }}>
          <div style={{ background: 'linear-gradient(135deg, #1a0533 0%, #0d1a40 55%, #060d2a 100%)', border: '1px solid rgba(139,92,246,0.4)', borderRadius: '20px', padding: '18px 16px', position: 'relative', overflow: 'hidden', minHeight: '260px' }}>
            <div style={{ position: 'absolute', top: '30%', right: '-20px', width: '280px', height: '280px', background: 'radial-gradient(circle, rgba(110,60,255,0.5) 0%, rgba(60,30,180,0.25) 40%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'relative', zIndex: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '8px', paddingLeft: '72px' }}>
                <img src="/images/icon_17.png" alt="" style={{ width: 11, height: 11 }} />
                <span style={{ fontSize: '10px', color: '#818cf8', fontWeight: 600, letterSpacing: '0.06em' }}>{dateStr}</span>
              </div>
              <h2 style={{ fontSize: '24px', fontWeight: 900, margin: '0 0 10px', lineHeight: 1.05, paddingLeft: '72px', maxWidth: '60%' }}>{sessionName}</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '14px', paddingLeft: '72px' }}>
                {sessionTags.map((tag, i) => (
                  <span key={i} style={{ fontSize: '9px', fontWeight: 700, padding: '3px 9px', borderRadius: '20px', background: i === 2 ? 'rgba(239,68,68,0.2)' : i === 1 ? 'rgba(99,102,241,0.2)' : 'rgba(139,92,246,0.2)', border: `1px solid ${i === 2 ? 'rgba(239,68,68,0.5)' : i === 1 ? 'rgba(99,102,241,0.5)' : 'rgba(139,92,246,0.5)'}`, color: i === 2 ? '#f87171' : i === 1 ? '#a5b4fc' : '#c4b5fd' }}>{tag}</span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '14px', marginBottom: '16px', flexWrap: 'wrap' }}>
                {[
                  { icon: '/images/icon_12.png', val: `${sessionMins} MIN`, label: 'DURATION' },
                  { icon: '/images/icon_14.png', val: sessionIntens, label: 'INTENSITY' },
                  { icon: '/images/icon_13.png', val: sessionFocus, label: 'FOCUS AREA' },
                  { icon: '/images/icon_10.png', val: `+${sessionXP} XP`, label: 'REWARD' },
                ].map((m, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <img src={m.icon} alt="" style={{ width: 15, height: 15 }} />
                    <div>
                      <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: '#e2e8f0' }}>{m.val}</p>
                      <p style={{ margin: 0, fontSize: '8px', color: '#6b7280', letterSpacing: '0.05em' }}>{m.label}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => router.push('/workout')} style={{ background: 'linear-gradient(135deg, #5b21b6, #4338ca)', border: '1px solid rgba(139,92,246,0.5)', borderRadius: '12px', padding: '12px 24px', color: '#fff', fontSize: '13px', fontWeight: 800, letterSpacing: '0.05em', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 20px rgba(109,40,217,0.5)' }}>
                START SESSION <span style={{ fontSize: '16px' }}>›</span>
              </button>
            </div>
            <div style={{ position: 'absolute', top: '16px', left: '12px', zIndex: 2 }}>
              <svg width="68" height="68" viewBox="0 0 68 68">
                <defs><linearGradient id="rg2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#a78bfa"/><stop offset="100%" stopColor="#6d28d9"/></linearGradient></defs>
                <circle cx="34" cy="34" r="28" fill="none" stroke="rgba(139,92,246,0.15)" strokeWidth="4"/>
                <circle cx="34" cy="34" r="28" fill="none" stroke="url(#rg2)" strokeWidth="4" strokeDasharray={`${2*Math.PI*28*0.05} ${2*Math.PI*28}`} strokeLinecap="round" transform="rotate(-90 34 34)"/>
                <text x="34" y="30" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="800">{sessionPct}%</text>
                <text x="34" y="43" textAnchor="middle" fill="#6b7280" fontSize="6" fontWeight="600" letterSpacing="0.3">NOT STARTED</text>
              </svg>
            </div>
          </div>
        </div>
        <div style={{ padding: '16px 18px 0' }}>
          <p style={{ fontSize: '11px', color: '#6b7280', fontWeight: 700, letterSpacing: '0.1em', margin: '0 0 10px' }}>THIS WEEK</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            {[
              { bg: '#081a10', iconBg: 'rgba(20,184,166,0.2)', icon: '/images/icon_3.png', val: weekStats.sessions, label: 'SESSIONS', sub: '0% of goal', subColor: '#4ade80' },
              { bg: '#080f1a', iconBg: 'rgba(59,130,246,0.2)', icon: '/images/icon_9.png', val: weekStats.kgLifted, label: 'KG LIFTED', sub: '+18% last wk', subColor: '#60a5fa' },
              { bg: '#1a0a00', iconBg: 'rgba(239,68,68,0.15)', icon: '/images/icon_13.png', val: weekStats.streak, label: 'DAY STREAK', sub: 'Keep it up!', subColor: '#fb923c' },
            ].map((c, i) => (
              <div key={i} style={{ background: c.bg, border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ width: 40, height: 40, borderRadius: '10px', background: c.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img src={c.icon} alt={c.label} style={{ width: 26, height: 26 }} />
                </div>
                <p style={{ margin: 0, fontSize: '22px', fontWeight: 900 }}>{c.val}</p>
                <p style={{ margin: 0, fontSize: '9px', color: '#6b7280', fontWeight: 600, letterSpacing: '0.04em' }}>{c.label}</p>
                <p style={{ margin: 0, fontSize: '8px', color: c.subColor }}>{c.sub}</p>
              </div>
            ))}
          </div>
        </div>
        <div style={{ padding: '12px 18px 0' }}>
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '14px 14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800, color: '#fff' }}>CO</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: '0 0 2px', fontSize: '12px', color: '#e2e8f0', lineHeight: 1.4 }}>{coachNote}</p>
              <p style={{ margin: 0, fontSize: '10px', color: '#6b7280' }}>— Coach Shameel · AI Coach</p>
            </div>
            <button onClick={() => router.push('/coach')} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', padding: '7px 10px', color: '#e2e8f0', fontSize: '10px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>VIEW</button>
          </div>
        </div>
        <div style={{ padding: '14px 18px 0' }}>
          <p style={{ fontSize: '11px', color: '#6b7280', fontWeight: 700, letterSpacing: '0.1em', margin: '0 0 10px' }}>THIS WEEK&apos;S LEADERS</p>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', overflow: 'hidden' }}>
            {LEADERBOARD.map((user, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '12px 14px', borderBottom: i < LEADERBOARD.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', background: user.isYou ? 'rgba(139,92,246,0.08)' : 'transparent' }}>
                <div style={{ width: 24, textAlign: 'center', fontSize: '16px', flexShrink: 0 }}>{user.medal || <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 700 }}>{user.rank}</span>}</div>
                <div style={{ width: 30, height: 30, borderRadius: '50%', marginLeft: 8, marginRight: 10, background: user.isYou ? 'linear-gradient(135deg, #7c3aed, #4f46e5)' : 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: '#fff', flexShrink: 0 }}>{user.initials}</div>
                <span style={{ flex: 1, fontSize: '13px', fontWeight: user.isYou ? 700 : 500 }}>{user.name}{user.isYou && <span style={{ fontSize: '10px', color: '#a78bfa', marginLeft: 5 }}>(you)</span>}</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#a78bfa' }}>{user.pts.toLocaleString()} <span style={{ fontSize: '9px', color: '#6b7280' }}>PTS</span></span>
              </div>
            ))}
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#080C14', color: '#fff', fontFamily: "'Inter', sans-serif", paddingBottom: '90px', overflowX: 'hidden', position: 'relative' }}>
      <div style={{ padding: '28px 32px 0', position: 'relative', zIndex: 10 }}>
        <p style={{ fontSize: '12px', color: '#a78bfa', fontWeight: 600, letterSpacing: '0.1em', margin: '0 0 4px' }}>{getGreeting()}</p>
        <h1 style={{ fontSize: '34px', fontWeight: 900, margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
          {loading ? '...' : userName} <span style={{ fontSize: '28px' }}>💪</span>
        </h1>
      </div>
      <div style={{ position: 'absolute', top: '24px', right: '32px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '12px', zIndex: 30 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.35)', borderRadius: '20px', padding: '5px 14px 5px 8px' }}>
            <img src="/images/icon_8.png" alt="level" style={{ width: 22, height: 22 }} />
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#a78bfa' }}>{level}</span>
          </div>
          <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 700, color: '#fff', border: '2px solid rgba(167,139,250,0.4)' }}>
            {userName?.charAt(0) || 'S'}
          </div>
        </div>
        <div style={{ background: 'rgba(59,36,180,0.55)', border: '1px solid rgba(139,92,246,0.45)', borderRadius: '14px', padding: '12px 18px', width: '185px' }}>
          <p style={{ margin: 0, fontSize: '13px', color: '#c4b5fd', fontStyle: 'italic', lineHeight: 1.6, textAlign: 'center' }}>
            &ldquo; Discipline today,<br />strength tomorrow. &rdquo;
          </p>
        </div>
      </div>
      {cutout && (
        <img src={cutout} alt="" style={{ position: 'absolute', top: '80px', right: '22%', height: '500px', width: 'auto', objectFit: 'contain', objectPosition: 'top center', pointerEvents: 'none', zIndex: 20 }} />
      )}
      <div style={{ padding: '16px 32px 0', position: 'relative', zIndex: 10 }}>
        <div style={{ maxWidth: '48%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <img src="/images/icon_9.png" alt="badge" style={{ width: 62, height: 62, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '4px' }}>
              <span style={{ fontSize: '34px', fontWeight: 900, color: '#34d399' }}>{readiness}</span>
              <div>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>Let&apos;s Get Started</p>
                <p style={{ margin: 0, fontSize: '10px', color: '#6b7280', fontWeight: 600, letterSpacing: '0.06em' }}>READINESS SCORE</p>
              </div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '6px', height: '7px', margin: '8px 0 5px' }}>
              <div style={{ width: `${xpPct}%`, height: '100%', borderRadius: '6px', background: 'linear-gradient(90deg, #34d399, #10b981)' }} />
            </div>
            <p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>{xpToNext - xp} XP to next level</p>
          </div>
        </div>
      </div>
      <div style={{ padding: '16px 32px 0', position: 'relative', zIndex: 10 }}>
        <div style={{ background: 'linear-gradient(135deg, #1a0533 0%, #0d1a40 55%, #060d2a 100%)', border: '1px solid rgba(139,92,246,0.4)', borderRadius: '20px', padding: '28px 28px', position: 'relative', overflow: 'hidden', minHeight: '300px' }}>
          <div style={{ position: 'absolute', top: '50%', left: '55%', transform: 'translate(-50%, -50%)', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(110,60,255,0.5) 0%, rgba(60,30,180,0.25) 40%, transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', paddingLeft: '100px' }}>
            <img src="/images/icon_17.png" alt="" style={{ width: 14, height: 14 }} />
            <span style={{ fontSize: '12px', color: '#818cf8', fontWeight: 600, letterSpacing: '0.06em' }}>{dateStr}</span>
          </div>
          <h2 style={{ fontSize: '36px', fontWeight: 900, margin: '0 0 16px', lineHeight: 1.0, paddingLeft: '100px', maxWidth: '50%' }}>{sessionName}</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px', paddingLeft: '100px' }}>
            {sessionTags.map((tag, i) => (
              <span key={i} style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em', padding: '5px 14px', borderRadius: '20px', background: i === 2 ? 'rgba(239,68,68,0.2)' : i === 1 ? 'rgba(99,102,241,0.2)' : 'rgba(139,92,246,0.2)', border: `1px solid ${i === 2 ? 'rgba(239,68,68,0.5)' : i === 1 ? 'rgba(99,102,241,0.5)' : 'rgba(139,92,246,0.5)'}`, color: i === 2 ? '#f87171' : i === 1 ? '#a5b4fc' : '#c4b5fd' }}>{tag}</span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '28px', marginBottom: '24px' }}>
            {[
              { icon: '/images/icon_12.png', val: `${sessionMins} MIN`, label: 'DURATION' },
              { icon: '/images/icon_14.png', val: sessionIntens, label: 'INTENSITY' },
              { icon: '/images/icon_13.png', val: sessionFocus, label: 'FOCUS AREA' },
              { icon: '/images/icon_10.png', val: `+${sessionXP} XP`, label: 'REWARD' },
            ].map((m, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <img src={m.icon} alt="" style={{ width: 20, height: 20 }} />
                <div>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#e2e8f0' }}>{m.val}</p>
                  <p style={{ margin: 0, fontSize: '10px', color: '#6b7280', letterSpacing: '0.06em' }}>{m.label}</p>
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => router.push('/workout')} style={{ background: 'linear-gradient(135deg, #5b21b6, #4338ca)', border: '1px solid rgba(139,92,246,0.5)', borderRadius: '14px', padding: '15px 40px', color: '#fff', fontSize: '15px', fontWeight: 800, letterSpacing: '0.06em', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 4px 24px rgba(109,40,217,0.5)' }}>
            START SESSION <span style={{ fontSize: '20px' }}>›</span>
          </button>
          <div style={{ position: 'absolute', top: '24px', left: '20px' }}>
            <svg width="88" height="88" viewBox="0 0 88 88">
              <defs><linearGradient id="rg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#a78bfa"/><stop offset="100%" stopColor="#6d28d9"/></linearGradient></defs>
              <circle cx="44" cy="44" r="38" fill="none" stroke="rgba(139,92,246,0.15)" strokeWidth="5"/>
              <circle cx="44" cy="44" r="38" fill="none" stroke="url(#rg)" strokeWidth="5" strokeDasharray={`${2*Math.PI*38*0.05} ${2*Math.PI*38}`} strokeLinecap="round" transform="rotate(-90 44 44)"/>
              <text x="44" y="40" textAnchor="middle" fill="#fff" fontSize="15" fontWeight="800">{sessionPct}%</text>
              <text x="44" y="55" textAnchor="middle" fill="#6b7280" fontSize="7" fontWeight="600" letterSpacing="0.5">NOT STARTED</text>
            </svg>
          </div>
        </div>
      </div>
      <div style={{ padding: '24px 32px 0', position: 'relative', zIndex: 10 }}>
        <p style={{ fontSize: '12px', color: '#6b7280', fontWeight: 700, letterSpacing: '0.1em', margin: '0 0 12px' }}>THIS WEEK</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
          {[
            { bg: '#081a10', iconBg: 'rgba(20,184,166,0.2)', icon: '/images/icon_3.png', val: weekStats.sessions, label: 'SESSIONS', sub: '0% of weekly goal', subColor: '#4ade80' },
            { bg: '#080f1a', iconBg: 'rgba(59,130,246,0.2)', icon: '/images/icon_9.png', val: weekStats.kgLifted, label: 'KG LIFTED', sub: '+18% vs last week', subColor: '#60a5fa' },
            { bg: '#1a0a00', iconBg: 'rgba(239,68,68,0.15)', icon: '/images/icon_13.png', val: weekStats.streak, label: 'DAY STREAK', sub: 'Keep it up!', subColor: '#fb923c' },
          ].map((c, i) => (
            <div key={i} style={{ background: c.bg, border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '18px 16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: 56, height: 56, borderRadius: '14px', background: c.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <img src={c.icon} alt={c.label} style={{ width: 34, height: 34 }} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '28px', fontWeight: 900 }}>{c.val}</p>
                <p style={{ margin: 0, fontSize: '11px', color: '#6b7280', fontWeight: 600, letterSpacing: '0.05em' }}>{c.label}</p>
                <p style={{ margin: 0, fontSize: '10px', color: c.subColor, marginTop: '2px' }}>{c.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ padding: '16px 32px 0', position: 'relative', zIndex: 10 }}>
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: 46, height: 46, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 800, color: '#fff' }}>CO</div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: '0 0 3px', fontSize: '14px', color: '#e2e8f0', lineHeight: 1.4 }}>{coachNote}</p>
            <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>— Coach Shameel · AI Coach</p>
          </div>
          <button onClick={() => router.push('/coach')} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', padding: '10px 16px', color: '#e2e8f0', fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}>
            VIEW MESSAGE <img src="/images/icon_15.png" alt="" style={{ width: 14, height: 14 }} />
          </button>
        </div>
      </div>
      <div style={{ padding: '16px 32px 0', position: 'relative', zIndex: 10 }}>
        <p style={{ fontSize: '12px', color: '#6b7280', fontWeight: 700, letterSpacing: '0.1em', margin: '0 0 10px' }}>THIS WEEK&apos;S LEADERS</p>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', overflow: 'hidden' }}>
          {LEADERBOARD.map((user, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '14px 20px', borderBottom: i < LEADERBOARD.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', background: user.isYou ? 'rgba(139,92,246,0.08)' : 'transparent' }}>
              <div style={{ width: 30, textAlign: 'center', fontSize: '20px', flexShrink: 0 }}>{user.medal || <span style={{ fontSize: '14px', color: '#6b7280', fontWeight: 700 }}>{user.rank}</span>}</div>
              <div style={{ width: 36, height: 36, borderRadius: '50%', marginLeft: 12, marginRight: 14, background: user.isYou ? 'linear-gradient(135deg, #7c3aed, #4f46e5)' : 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: '#fff', flexShrink: 0 }}>{user.initials}</div>
              <span style={{ flex: 1, fontSize: '15px', fontWeight: user.isYou ? 700 : 500 }}>{user.name}{user.isYou && <span style={{ fontSize: '12px', color: '#a78bfa', marginLeft: 8 }}>(you)</span>}</span>
              <span style={{ fontSize: '15px', fontWeight: 700, color: '#a78bfa' }}>{user.pts.toLocaleString()} <span style={{ fontSize: '11px', color: '#6b7280' }}>PTS</span></span>
            </div>
          ))}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
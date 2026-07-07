'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useMsal } from '@azure/msal-react';
import BottomNav from '@/components/BottomNav';
import ThemeToggle from '@/components/ThemeToggle';
import QuoteCard from '@/components/QuoteCard';
import Reveal from '@/components/Reveal';

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

// Some Entra accounts have their display name set to the account GUID —
// don't greet people with "Good morning, 6d765ac9-…".
const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function looksLikeGuid(s) {
  return !!s && GUID_RE.test(s.trim());
}

// Pull the sets out of a gymLogs doc. Workout saves them as a JSON string in
// `sets_data`, but older docs may have an `exercises` array — handle both.
function logSets(log) {
  try {
    if (log.sets_data) return JSON.parse(log.sets_data);
  } catch (e) {}
  return log.exercises?.flatMap((e) => e.sets || []) || [];
}

function logVolume(log) {
  return logSets(log).reduce(
    (s, set) => s + (parseFloat(set.kg) || 0) * (parseInt(set.reps) || 0), 0
  );
}

// ── Level / XP, computed from training logs (no backend field needed) ──
// 50 XP per session + 1 XP per 100kg lifted. Each level needs 200 × level XP.
const LEVEL_TITLES = ['Pup', 'Young Dog', 'Trainee', 'Working Dog', 'Strong Dog', 'Beast', 'Big Dog', 'Alpha', 'Top Dog', 'Legend'];
function computeLevel(allLogs) {
  const sessions = new Set(allLogs.map((l) => l.date?.split('T')[0]).filter(Boolean)).size;
  const volume = allLogs.reduce((sum, log) => sum + logVolume(log), 0);
  const totalXp = sessions * 50 + Math.round(volume / 100);
  let level = 1, into = totalXp, need = 200;
  while (into >= need) { into -= need; level++; need = 200 * level; }
  return {
    level,
    title: LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)],
    totalXp,
    xpInto: into,
    xpToNext: need - into,
    pct: Math.round((into / need) * 100),
  };
}

// Count-up number that animates when `value` first arrives.
function CountUp({ value, format }) {
  const [display, setDisplay] = useState(0);
  const raf = useRef(null);
  useEffect(() => {
    const target = typeof value === 'number' ? value : parseFloat(value) || 0;
    const t0 = performance.now();
    const ms = 900;
    cancelAnimationFrame(raf.current);
    const step = (t) => {
      const p = Math.min((t - t0) / ms, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(target * eased));
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [value]);
  if (format === 'k' && display >= 1000) return <>{(display / 1000).toFixed(1)}k</>;
  return <>{display}</>;
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
  const [weekDays, setWeekDays]     = useState([]); // [{label, dayNum, trained, isToday}]
  const [levelInfo, setLevelInfo]   = useState(null);
  const [xpAnimated, setXpAnimated] = useState(false);
  const [todayPlan, setTodayPlan]   = useState(null);
  const [coachNote, setCoachNote]   = useState(null);
  const [coachLoading, setCoachLoading] = useState(false);
  const [askedWhy, setAskedWhy]     = useState(false);
  const [readiness, setReadiness]   = useState(null);
  const [ringOn, setRingOn]         = useState(false);
  const [showSetup, setShowSetup]   = useState(false); // gentle onboarding nudge
  const [sessionOpen, setSessionOpen] = useState(false); // expandable exercise list
  const [loading, setLoading]       = useState(true);

  const dismissSetup = () => {
    setShowSetup(false);
    try { localStorage.setItem('gd-setup-dismissed', userId); } catch (e) {}
  };

  useEffect(() => {
    if (!accounts || accounts.length === 0) return;
    const account = accounts[0];
    const uid = account.localAccountId;
    setUserId(uid);
    const msalName = (account.name && account.name !== 'unknown' && !looksLikeGuid(account.name))
      ? account.name
      : account.username?.split('@')[0] || '';
    setUserName(titleCase(msalName));
    loadDashboardData(uid);
  }, [accounts]);

  async function askCoach(promptText) {
    setCoachLoading(true);
    try {
      const res = await fetch(`${API}/aiCoach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-functions-key': process.env.NEXT_PUBLIC_AI_COACH_KEY || '' },
        // The function contract is inconsistent between screens — send both
        // keys and accept either response shape.
        body: JSON.stringify({ message: promptText, prompt: promptText }),
      });
      const data = await res.json();
      const text = data.reply || data.message || (typeof data === 'string' ? data : null);
      if (text) setCoachNote(text);
    } catch (err) {} finally { setCoachLoading(false); }
  }

  async function loadDashboardData(uid) {
    try {
      const key = process.env.NEXT_PUBLIC_API_KEY || '';

      const logsRes = await fetch(`${API}/gymLogs?userId=${uid}`, {
        headers: { 'x-functions-key': key }
      });
      const logs = await logsRes.json();
      const allLogs = Array.isArray(logs) ? logs : [];

      const now = new Date();
      // Week starts Monday
      const weekStart = new Date(now);
      const dow = (now.getDay() + 6) % 7; // 0 = Monday
      weekStart.setDate(now.getDate() - dow);
      weekStart.setHours(0, 0, 0, 0);

      const trainedDates = new Set(allLogs.map((l) => l.date?.split('T')[0]).filter(Boolean));
      const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
      const days = dayLabels.map((label, i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        const iso = d.toISOString().split('T')[0];
        return {
          label,
          dayNum: d.getDate(),
          trained: trainedDates.has(iso),
          isToday: d.toDateString() === now.toDateString(),
        };
      });
      setWeekDays(days);

      const thisWeekLogs = allLogs.filter(l => new Date(l.date) >= weekStart);
      const weekSessions = new Set(thisWeekLogs.map((l) => l.date?.split('T')[0]).filter(Boolean)).size;
      const totalKg = thisWeekLogs.reduce((sum, log) => sum + logVolume(log), 0);

      let streak = 0;
      const sortedDates = [...trainedDates].sort().reverse();
      let checkDate = new Date();
      checkDate.setHours(0, 0, 0, 0);
      for (const d of sortedDates) {
        const logDate = new Date(d);
        logDate.setHours(0, 0, 0, 0);
        const diff = Math.round((checkDate - logDate) / 86400000);
        if (diff <= 1) { streak++; checkDate = logDate; }
        else break;
      }

      setWeekStats({ sessions: weekSessions, kgLifted: Math.round(totalKg), streak });
      setLevelInfo(computeLevel(allLogs));
      setTimeout(() => setXpAnimated(true), 150);

      const plansRes = await fetch(`${API}/workoutPlans?userId=${uid}`, {
        headers: { 'x-functions-key': process.env.NEXT_PUBLIC_PLANS_API_KEY || '' }
      });
      const plans = await plansRes.json();
      if (Array.isArray(plans) && plans.length > 0) {
        const plan = plans[0];
        const dayNames = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
        setTodayPlan(plan.schedule?.[dayNames[now.getDay()]] || plan.sessions?.[0] || plan);
      } else if (plans && plans.exercises) {
        setTodayPlan(plans);
      }

      const profileRes = await fetch(`${API}/userProfiles?userId=${uid}`, {
        headers: { 'x-functions-key': process.env.NEXT_PUBLIC_PROFILES_API_KEY || '' }
      });
      const profileData = await profileRes.json();
      // Find THIS user's profile — [0] could be someone else's once more users exist.
      const profile = Array.isArray(profileData)
        ? profileData.find((p) => p.userId === uid)
        : profileData;

      if (profile && !profile.error) {
        if (profile.readiness) {
          setReadiness(profile.readiness);
          setTimeout(() => setRingOn(true), 150);
        }
        if (profile.name && profile.name.length < 50 && !looksLikeGuid(profile.name)) {
          setUserName(titleCase(profile.name));
        }
      }

      // Nudge (not force) onboarding if it has never been completed —
      // skipped if done on this device or previously dismissed.
      try {
        const done = (profile && !profile.error && profile.onboardingComplete)
          || localStorage.getItem('gd-onboarded') === uid;
        const dismissed = localStorage.getItem('gd-setup-dismissed') === uid;
        if (!done && !dismissed) setShowSetup(true);
      } catch (e) {}

      askCoach(`Give a short motivational coach note (1 sentence, max 12 words) for someone with a ${streak}-day streak who has done ${weekSessions} sessions this week.`);

    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleAskWhy() {
    if (coachLoading) return;
    setAskedWhy(true);
    askCoach(`Explain in 2 short sentences the reasoning behind today's training recommendation for someone with a ${weekStats.streak || 0}-day streak, ${weekStats.sessions || 0} sessions this week and readiness score ${readiness || 'unknown'}.`);
  }

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-NZ', { weekday: 'long', month: 'long', day: 'numeric' });
  const sessionName   = todayPlan?.name      || null;
  const sessionMins   = todayPlan?.duration  || null;
  const sessionFocus  = todayPlan?.focus     || todayPlan?.tag || null;
  const exerciseCount = todayPlan?.exercises?.length || null;

  const readinessLabel = readiness
    ? readiness >= 80 ? 'Primed to train' : readiness >= 60 ? 'Good to go' : 'Take it easy'
    : 'Readiness pending';

  const readinessSub = readiness
    ? readiness >= 80 ? 'Recovery is high. A great day to push volume.'
      : readiness >= 60 ? 'Solid recovery. Train as planned today.'
      : 'Recovery is low. Keep intensity moderate.'
    : 'Complete a soreness check-in to see your score.';

  const R = 52;
  const CIRC = 2 * Math.PI * R;
  const ringOffset = readiness && ringOn ? CIRC * (1 - readiness / 100) : CIRC;

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

        {/* ── SETUP NUDGE ── */}
        {showSetup && (
          <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 14, border: '1px solid var(--accent)', padding: '14px 16px' }}>
            <div style={{ width: 42, height: 42, borderRadius: 13, background: 'var(--accent-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🎯</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Set up your training profile</p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--ink-2)' }}>2 minutes — personalises your plan and coach</p>
            </div>
            <button onClick={() => router.push('/onboarding')} style={{ flexShrink: 0, background: 'var(--accent)', border: 'none', borderRadius: 12, padding: '9px 14px', color: 'var(--on-accent)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              Start
            </button>
            <button onClick={dismissSetup} aria-label="Dismiss" style={{ flexShrink: 0, background: 'none', border: 'none', color: 'var(--ink-3)', fontSize: 16, cursor: 'pointer', padding: '0 2px' }}>
              ✕
            </button>
          </div>
        )}

        {/* ── WEEK STRIP ── */}
        {weekDays.length > 0 && (
          <Reveal>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {weekDays.map((d, i) => (
              <div key={i} style={{
                flex: 1, textAlign: 'center', padding: '9px 0 8px', borderRadius: 14,
                background: d.isToday ? 'var(--accent)' : 'var(--card)',
                border: `1px solid ${d.isToday ? 'var(--accent)' : 'var(--line)'}`,
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: d.isToday ? 'var(--on-accent)' : 'var(--ink-3)' }}>{d.label}</div>
                <div style={{ fontSize: 14, fontWeight: 800, marginTop: 2, color: d.isToday ? 'var(--on-accent)' : 'var(--ink)' }}>{d.dayNum}</div>
                <div style={{
                  width: 5, height: 5, borderRadius: 999, margin: '5px auto 0',
                  background: d.trained ? (d.isToday ? 'var(--on-accent)' : 'var(--accent)') : 'transparent',
                }} />
              </div>
            ))}
          </div>
          </Reveal>
        )}

        {/* ── LEVEL / XP ── */}
        {levelInfo && (
          <Reveal delay={60}>
          <div style={{ ...card, padding: '14px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <div style={{ width: 34, height: 34, borderRadius: 11, background: 'linear-gradient(135deg, var(--violet), var(--blue))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>⚡</div>
                <div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>Level {levelInfo.level} · {levelInfo.title}</p>
                  <p style={{ margin: 0, fontSize: 11, color: 'var(--ink-3)' }}>{levelInfo.xpToNext} XP to Level {levelInfo.level + 1}</p>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: 'var(--violet)' }}>{levelInfo.totalXp.toLocaleString()} XP</p>
            </div>
            <div style={{ height: 8, background: 'var(--soft)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 999,
                background: 'linear-gradient(90deg, var(--violet), var(--blue))',
                width: xpAnimated ? `${levelInfo.pct}%` : 0,
                transition: 'width 1.2s cubic-bezier(0.4, 0, 0.2, 1)',
              }} />
            </div>
          </div>
          </Reveal>
        )}

        {/* ── READINESS ── */}
        <Reveal delay={100}>
        <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ position: 'relative', width: 100, height: 100, flexShrink: 0 }}>
            <svg width="100" height="100" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r={R} fill="none" stroke="var(--soft)" strokeWidth="11" />
              {readiness && (
                <circle cx="60" cy="60" r={R} fill="none" stroke="var(--accent)" strokeWidth="11"
                  strokeLinecap="round" strokeDasharray={CIRC} strokeDashoffset={ringOffset}
                  style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)' }}
                  transform="rotate(-90 60 60)" />
              )}
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 30, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.03em' }}>
                {readiness ? <CountUp value={readiness} /> : '—'}
              </span>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--ink-3)', marginTop: 3 }}>READY</span>
            </div>
          </div>
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 16 }}>{readinessLabel}</p>
            <p style={{ margin: '7px 0 0', fontSize: 13, lineHeight: 1.5, color: 'var(--ink-2)' }}>{readinessSub}</p>
          </div>
        </div>
        </Reveal>

        {/* ── TODAY'S SESSION ── */}
        <Reveal delay={140}>
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          <div
            onClick={() => todayPlan?.exercises?.length && setSessionOpen(o => !o)}
            style={{ padding: '18px 18px 14px', cursor: todayPlan?.exercises?.length ? 'pointer' : 'default' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={eyebrow}>Today&rsquo;s session</p>
                <p style={{ margin: '5px 0 0', fontSize: 19, fontWeight: 800, letterSpacing: '-0.02em' }}>
                  {sessionName || 'Rest day'}
                  {todayPlan?.exercises?.length ? (
                    <span style={{
                      display: 'inline-block', marginLeft: 8, fontSize: 13, color: 'var(--ink-3)',
                      transform: sessionOpen ? 'rotate(90deg)' : 'none',
                      transition: 'transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
                    }}>›</span>
                  ) : null}
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

          {/* smooth unfold: the exercise list opens like Apple's product cards */}
          {todayPlan?.exercises?.length > 0 && (
            <div style={{
              display: 'grid',
              gridTemplateRows: sessionOpen ? '1fr' : '0fr',
              transition: 'grid-template-rows 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
            }}>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ padding: '2px 18px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {todayPlan.exercises.map((ex, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 26, height: 26, borderRadius: 999, background: 'var(--soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', flexShrink: 0 }}>{i + 1}</div>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{ex.name}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--ink-3)', flexShrink: 0 }}>{ex.sets} × {ex.reps}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
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
        </Reveal>

        {/* ── THIS WEEK ── */}
        <Reveal delay={180}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 4px 9px' }}>
          <p style={eyebrow}>This week</p>
          <button onClick={() => router.push('/progress')} style={{ background: 'none', border: 'none', color: 'var(--accent-strong)', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0 }}>
            View all ›
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
          <Stat value={weekStats.sessions !== null ? <CountUp value={weekStats.sessions} /> : '—'} label="sessions" />
          <Stat value={weekStats.kgLifted !== null ? <CountUp value={weekStats.kgLifted} format="k" /> : '—'} label="kg lifted" />
          <Stat value={weekStats.streak !== null ? <CountUp value={weekStats.streak} /> : '—'} label="day streak" color="var(--orange)" suffix="🔥" />
        </div>
        </Reveal>

        {/* ── AI COACH ── */}
        <Reveal delay={220}>
        <div style={{ background: `linear-gradient(135deg, var(--ai-card-1), var(--ai-card-2))`, borderRadius: 22, padding: 18, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 18 }}>✨</span>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>AI Coach</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: '#C9C5FF', background: 'rgba(122,90,248,0.25)', borderRadius: 6, padding: '2px 7px', letterSpacing: '0.06em' }}>BETA</span>
          </div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: '#D9D9E3' }}>
            {coachLoading
              ? 'Thinking…'
              : coachNote || 'Ready to optimise your performance? Start a session and I will track your progress.'}
          </p>
          {coachNote && !askedWhy && (
            <button onClick={handleAskWhy} style={{
              marginTop: 10, background: 'rgba(122,90,248,0.25)', border: 'none', color: '#C9C5FF',
              borderRadius: 10, padding: '7px 13px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>
              Ask why →
            </button>
          )}
        </div>
        </Reveal>

        <Reveal delay={260}>
        <div style={{ marginBottom: 14 }}><QuoteCard mode="random" /></div>
        </Reveal>

        <Reveal delay={300}>
        <button onClick={() => router.push('/nutrition')} style={{ ...card, width: '100%', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', textAlign: 'left' }}>
          <div style={{ width: 46, height: 46, borderRadius: 14, background: 'var(--accent-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🥗</div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Nutrition</p>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--ink-2)' }}>Log meals and macros</p>
          </div>
          <span style={{ color: 'var(--ink-3)', fontSize: 18 }}>›</span>
        </button>
        </Reveal>

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

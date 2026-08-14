'use client';
import { todayISO, toLocalISO } from '@/lib/day';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useMsal } from '@azure/msal-react';
import BottomNav from '@/components/BottomNav';
import ThemeToggle from '@/components/ThemeToggle';
import QuoteCard from '@/components/QuoteCard';
import Reveal from '@/components/Reveal';
import { captureError, breadcrumb } from '@/lib/monitoring';

const API = 'https://gymdogs-api-g9d0gve4angygdcj.newzealandnorth-01.azurewebsites.net/api';

// Fetch JSON from the API without letting one bad response take the whole
// dashboard down. An error body isn't JSON, so calling res.json() on it throws
// "Unexpected end of JSON input" — returns null instead, and the caller carries on.
async function getJson(url, key, label) {
  try {
    const res = await fetch(url, { headers: { 'x-functions-key': key } });
    if (!res.ok) {
      console.error(`Dashboard: ${label} failed (${res.status} ${res.statusText})`);
      captureError(new Error(`${label} failed (${res.status})`), {
        screen: 'dashboard', action: 'load', endpoint: label, status: res.status,
      });
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error(`Dashboard: ${label} failed`, err);
    captureError(err, { screen: 'dashboard', action: 'load', endpoint: label });
    return null;
  }
}

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
  } catch (e) {
    // Not expected — a doc we wrote ourselves failing to parse means that
    // session's volume silently reads as zero across the whole app.
    captureError(e, { screen: 'dashboard', action: 'parse-sets' });
  }
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

// Types text out character by character with a blinking caret — mockup port.
function TypeText({ text }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    if (!text) return;
    const iv = setInterval(() => {
      setN((v) => {
        if (v >= text.length) { clearInterval(iv); return v; }
        return v + 2;
      });
    }, 18);
    return () => clearInterval(iv);
  }, [text]);
  const doneTyping = n >= (text?.length || 0);
  return (
    <>
      {text?.slice(0, n)}
      {!doneTyping && (
        <span style={{
          display: 'inline-block', width: 2, height: 14, background: 'var(--on-dark-2)',
          marginLeft: 2, verticalAlign: '-2px', animation: 'gdBlink 1s steps(1) infinite',
        }} />
      )}
    </>
  );
}

function Avatar({ name, size = 42, fontSize = 15, onClick }) {
  const initial = (name || 'S').charAt(0).toUpperCase();
  // IGNITE: slowly-rotating conic gradient ring around the avatar
  return (
    <div
      onClick={onClick}
      style={{
        width: size + 6, height: size + 6, borderRadius: '50%', padding: 3,
        background: 'conic-gradient(from 210deg, var(--ice), var(--steel), var(--vio), var(--ice))',
        animation: 'gdSpin 9s linear infinite',
        flexShrink: 0, cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div style={{
        width: '100%', height: '100%', borderRadius: '50%', background: 'var(--soft)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize, fontWeight: 700, color: 'var(--ink)',
        animation: 'gdSpin 9s linear infinite reverse',
      }}>
        {initial}
      </div>
    </div>
  );
}

const card = {
  background: 'var(--card)',
  border: '1px solid var(--line)',
  borderRadius: 26,
  padding: 18,
  marginBottom: 14,
  boxShadow: 'var(--shadow-card)',
};

// Premium stroke icons — replace the emoji look
const Icon = {
  bolt: (c = 'var(--accent)') => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L4.5 12.5h6L11 22l8.5-10.5h-6L13 2z" /></svg>
  ),
  dumbbell: (c = 'var(--accent-strong)') => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round"><path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" /></svg>
  ),
  bowl: (c = 'var(--accent-strong)') => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 11h16a8 8 0 0 1-16 0z" /><path d="M9 11c0-4 2-6 6-8" /></svg>
  ),
  flame: (c = 'var(--orange)') => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-2px' }}><path d="M12 22c4 0 7-2.7 7-7 0-3-2-5.5-3.5-7C15 10 14 11 13 11c0-3-1-6-4-8 .5 3-1 5-2.5 7C5 11.7 5 13 5 15c0 4.3 3 7 7 7z" /></svg>
  ),
  sparkle: (c = 'var(--on-dark-2)') => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z" /></svg>
  ),
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
  const [doneToday, setDoneToday]   = useState(false);
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
    // Deliberate: private mode blocks localStorage. Worst case the nudge
    // reappears next visit.
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

  // uidArg matters: the first call comes from loadDashboardData, which runs in
  // the same tick as setUserId(uid) — so the `userId` state is still '' and this
  // was posting an empty id, leaving the backend without a user to cost-cap or
  // personalise against.
  async function askCoach(promptText, uidArg) {
    const who = uidArg || userId;
    setCoachLoading(true);
    try {
      const res = await fetch(`${API}/aiCoach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-functions-key': process.env.NEXT_PUBLIC_AI_COACH_KEY || '' },
        // The function contract is inconsistent between screens — send both
        // keys and accept either response shape.
        body: JSON.stringify({ message: promptText, prompt: promptText, userId: who }),
      });
      if (!res.ok) {
        captureError(new Error(`aiCoach failed (${res.status})`), {
          screen: 'dashboard', action: 'coach-note', endpoint: 'aiCoach', status: res.status,
        });
        return;
      }
      const data = await res.json();
      const text = data.reply || data.message || (typeof data === 'string' ? data : null);
      if (text) setCoachNote(text);
    } catch (err) {
      captureError(err, { screen: 'dashboard', action: 'coach-note', endpoint: 'aiCoach' });
    } finally { setCoachLoading(false); }
  }

  async function loadDashboardData(uid) {
    breadcrumb('dashboard load started');
    try {
      const key = process.env.NEXT_PUBLIC_API_KEY || '';

      const logs = await getJson(`${API}/gymLogs?userId=${uid}`, key, 'gymLogs');
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
        const iso = toLocalISO(d);
        return {
          label,
          dayNum: d.getDate(),
          iso,
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

      const plans = await getJson(
        `${API}/workoutPlans?userId=${uid}`,
        process.env.NEXT_PUBLIC_PLANS_API_KEY || '',
        'workoutPlans'
      );
      if (Array.isArray(plans) && plans.length > 0) {
        const plan = plans[0];
        const dayNames = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
        setTodayPlan(plan.schedule?.[dayNames[now.getDay()]] || plan.sessions?.[0] || plan);
      } else if (plans && plans.exercises) {
        setTodayPlan(plans);
      }

      const profileData = await getJson(
        `${API}/userProfiles?userId=${uid}`,
        process.env.NEXT_PUBLIC_PROFILES_API_KEY || '',
        'userProfiles'
      );
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
        setDoneToday(profile.lastWorkoutDate === todayISO());
      }

      // The email save that used to live here referenced an `account` variable
      // that isn't in this function's scope, so it threw a ReferenceError on
      // every single load and the surrounding catch ate it. `EmailCapture`
      // (rendered app-wide inside MsalProvider) does this job properly now.

      // Nudge (not force) onboarding if it has never been completed —
      // skipped if done on this device or previously dismissed.
      // Deliberate: localStorage throws in private mode; the nudge just doesn't show.
      try {
        const done = (profile && !profile.error && profile.onboardingComplete)
          || localStorage.getItem('gd-onboarded') === uid;
        const dismissed = localStorage.getItem('gd-setup-dismissed') === uid;
        if (!done && !dismissed) setShowSetup(true);
      } catch (e) {}

      askCoach(`Give a short motivational coach note (1 sentence, max 12 words) for someone with a ${streak}-day streak who has done ${weekSessions} sessions this week.`, uid);

    } catch (err) {
      // This catch is the reason this whole brief exists: it swallowed a
      // TypeError on every load for weeks and the screen just quietly did half
      // its job. Anything that lands here is a bug, not a condition.
      console.error('Dashboard load error:', err);
      captureError(err, { screen: 'dashboard', action: 'load' });
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
  // The active plan stays active until a new one is published, so a session from
  // a previous day shouldn't be shown as today's — only surface a plan dated today.
  const planDate = todayPlan?.date || null;
  // Named todayStr, not todayISO — that would shadow the imported todayISO()
  // for the whole component, including inside loadDashboardData.
  const todayStr = toLocalISO(today);
  const planIsToday = planDate === todayStr;
  const effPlan       = planIsToday ? todayPlan : null;               // today's session (or none)
  const stalePlan     = todayPlan && !planIsToday ? todayPlan : null; // exists but not for today
  const sessionName   = effPlan?.name      || null;
  const sessionMins   = effPlan?.duration  || null;
  const sessionFocus  = effPlan?.focus     || effPlan?.tag || null;
  const exerciseCount = effPlan?.exercises?.length || null;
  const sessionEyebrow = "Today's session";

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
          <h1 className="gd-disp" style={{ margin: '2px 0 0', fontSize: 27, fontWeight: 700 }}>
            {getGreeting()}{userName ? `, ${userName.split(' ')[0]}` : ''}
            <span className="gd-grad-text">.</span>
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ThemeToggle />
          <div style={{ position: 'relative' }}>
            <Avatar name={userName} onClick={() => router.push('/profile')} />
            {weekStats.streak > 0 && (
              <span style={{
                position: 'absolute', bottom: -4, right: -6,
                background: 'linear-gradient(135deg, var(--ember), var(--steel))',
                borderRadius: 99, padding: '2px 7px', fontSize: 10, fontWeight: 800,
                color: 'var(--on-accent)', border: '2px solid var(--bg)',
                boxShadow: '0 4px 14px var(--orange-tint)',
                animation: 'gdFlick 2.2s ease-in-out infinite',
              }}>
                {weekStats.streak}
              </span>
            )}
          </div>
        </div>
      </div>

      <div style={{ padding: '0 20px' }}>

        {/* ── SETUP NUDGE ── */}
        {showSetup && (
          <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 14, border: '1px solid var(--accent)', padding: '14px 16px' }}>
            <div style={{ width: 42, height: 42, borderRadius: 13, background: 'var(--accent-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="0.8" fill="var(--accent)" /></svg>
            </div>
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
              <button key={i} onClick={() => router.push('/history?date=' + d.iso)} style={{
                flex: 1, textAlign: 'center', padding: '9px 0 8px', borderRadius: 14, cursor: 'pointer',
                background: d.isToday ? 'var(--grad)' : 'var(--card)',
                border: `1px solid ${d.isToday ? 'transparent' : 'var(--line)'}`,
                boxShadow: d.isToday ? '0 6px 20px var(--accent-glow)' : 'none',
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: d.isToday ? 'var(--on-accent)' : 'var(--ink-3)' }}>{d.label}</div>
                <div style={{ fontSize: 14, fontWeight: 800, marginTop: 2, color: d.isToday ? 'var(--on-accent)' : 'var(--ink)' }}>{d.dayNum}</div>
                <div style={{
                  width: 5, height: 5, borderRadius: 999, margin: '5px auto 0',
                  background: d.trained ? (d.isToday ? 'var(--on-accent)' : 'var(--accent)') : 'transparent',
                  boxShadow: d.trained && !d.isToday ? '0 0 6px var(--accent-glow)' : 'none',
                }} />
              </button>
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
                <div style={{ width: 34, height: 34, borderRadius: 11, background: 'var(--accent-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{Icon.bolt()}</div>
                <div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>Level {levelInfo.level} · {levelInfo.title}</p>
                  <p style={{ margin: 0, fontSize: 11, color: 'var(--ink-3)' }}>{levelInfo.xpToNext} XP to Level {levelInfo.level + 1}</p>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: 'var(--accent-strong)' }}>{levelInfo.totalXp.toLocaleString()} XP</p>
            </div>
            <div style={{ height: 9, background: 'var(--soft)', borderRadius: 999, overflow: 'hidden' }}>
              <div className="gd-shimbar" style={{
                height: '100%', borderRadius: 999,
                background: 'var(--grad)',
                width: xpAnimated ? `${levelInfo.pct}%` : 0,
                transition: 'width 1.4s cubic-bezier(0.22, 1, 0.36, 1)',
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
              <defs>
                <linearGradient id="gdReadyGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#6EE7F9" />
                  <stop offset="1" stopColor="#8B5CF6" />
                </linearGradient>
              </defs>
              <circle cx="60" cy="60" r={R} fill="none" stroke="var(--soft)" strokeWidth="11" />
              {readiness && (
                <circle cx="60" cy="60" r={R} fill="none" stroke="url(#gdReadyGrad)" strokeWidth="11"
                  strokeLinecap="round" strokeDasharray={CIRC} strokeDashoffset={ringOffset}
                  style={{
                    transition: 'stroke-dashoffset 1.6s cubic-bezier(0.22, 1, 0.36, 1)',
                    filter: 'drop-shadow(0 0 10px rgba(110,231,249,0.4))',
                  }}
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

        {/* ── TODAY'S SESSION — SLATE mesh hero ── */}
        <Reveal delay={140}>
        <div style={{
          borderRadius: 26, padding: 0, overflow: 'hidden', marginBottom: 14,
          background: 'var(--hero-mesh)',
          border: '1px solid var(--hero-line)',
          boxShadow: 'var(--hero-glow)',
          color: 'var(--on-dark)',
        }}>
          <div
            onClick={() => effPlan?.exercises?.length && setSessionOpen(o => !o)}
            style={{ padding: '20px 20px 14px', cursor: effPlan?.exercises?.length ? 'pointer' : 'default' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ ...eyebrow, color: 'rgba(255,255,255,0.75)' }}>{sessionEyebrow}</p>
                <p className="gd-disp" style={{ margin: '6px 0 0', fontSize: 32, fontWeight: 700, lineHeight: 1.05, textTransform: 'uppercase' }}>
                  {sessionName || (stalePlan ? 'No session today' : 'Rest day')}
                  {effPlan?.exercises?.length ? (
                    <span style={{
                      display: 'inline-block', marginLeft: 8, fontSize: 15, color: 'rgba(255,255,255,0.7)',
                      transform: sessionOpen ? 'rotate(90deg)' : 'none',
                      transition: 'transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
                    }}>›</span>
                  ) : null}
                </p>
              </div>
              <div style={{ width: 46, height: 46, borderRadius: 14, background: 'rgba(255,255,255,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {Icon.dumbbell('var(--on-dark)')}
              </div>
            </div>
            {sessionName && (
              <div style={{ display: 'flex', gap: 8, marginTop: 13, flexWrap: 'wrap' }}>
                {exerciseCount && <span style={heroChip}>{exerciseCount} exercises</span>}
                {sessionMins && <span style={heroChip}>~{sessionMins} min</span>}
                {sessionFocus && <span style={heroChip}>{sessionFocus}</span>}
              </div>
            )}
          </div>

          {/* smooth unfold: the exercise list opens like Apple's product cards */}
          {effPlan?.exercises?.length > 0 && (
            <div style={{
              display: 'grid',
              gridTemplateRows: sessionOpen ? '1fr' : '0fr',
              transition: 'grid-template-rows 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
            }}>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ padding: '2px 20px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {effPlan.exercises.map((ex, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 26, height: 26, borderRadius: 999, background: 'rgba(255,255,255,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.85)', flexShrink: 0 }}>{i + 1}</div>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{ex.name}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 12, color: 'rgba(255,255,255,0.7)', flexShrink: 0 }}>{ex.sets} × {ex.reps}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {effPlan ? (
            <div style={{ padding: '0 20px 20px' }}>
              {doneToday ? (
                <div style={{ width: '100%', borderRadius: 17, background: 'var(--on-dark-soft)', color: 'var(--on-dark)', padding: 15, fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12.5l5 5L20 6.5" /></svg>
                  Completed today
                </div>
              ) : (
                /* mockup: white pill button on the mesh card */
                <button onClick={() => router.push('/workout')} className="gd-disp" style={{
                  width: '100%', border: 'none', borderRadius: 17,
                  background: 'var(--hero-btn)', color: 'var(--hero-btn-ink)', padding: 15, fontSize: 16, fontWeight: 700,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
                  boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--hero-btn-ink)"><polygon points="6 3 20 12 6 21 6 3" /></svg>
                  START WORKOUT
                </button>
              )}
            </div>
          ) : (
            <div style={{ padding: '0 20px 20px' }}>
              <div style={{ background: 'rgba(255,255,255,0.10)', borderRadius: 14, padding: 14, textAlign: 'center', color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: 600, lineHeight: 1.5 }}>
                {stalePlan ? 'No session set for today yet — check the Train tab or ask your coach.' : 'No session assigned yet'}
              </div>
            </div>
          )}
        </div>
        </Reveal>

        {/* ── THIS WEEK ── */}
        <Reveal delay={180}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 4px 9px' }}>
          <p style={eyebrow}>This week</p>
          <button onClick={() => router.push('/history')} style={{ background: 'none', border: 'none', color: 'var(--accent-strong)', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0 }}>
            View all ›
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
          <Stat value={weekStats.sessions !== null ? <CountUp value={weekStats.sessions} /> : '—'} label="sessions" />
          <Stat value={weekStats.kgLifted !== null ? <CountUp value={weekStats.kgLifted} format="k" /> : '—'} label="kg lifted" />
          <Stat value={weekStats.streak !== null ? <CountUp value={weekStats.streak} /> : '—'} label="day streak" color="var(--orange)" suffix={Icon.flame()} />
        </div>
        </Reveal>

        {/* ── AI COACH ── */}
        <Reveal delay={220}>
        <div style={{ background: `linear-gradient(135deg, var(--ai-card-1), var(--ai-card-2))`, borderRadius: 26, padding: 18, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            {Icon.sparkle()}
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--on-dark)' }}>AI Coach</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--on-dark-2)', background: 'var(--on-dark-soft)', borderRadius: 6, padding: '2px 7px', letterSpacing: '0.06em' }}>BETA</span>
          </div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: 'var(--on-dark)', minHeight: 22 }}>
            {coachLoading
              ? 'Thinking…'
              : <TypeText text={coachNote || 'Ready to optimise your performance? Start a session and I will track your progress.'} />}
          </p>
          {coachNote && !askedWhy && (
            <button onClick={handleAskWhy} style={{
              marginTop: 10, background: 'var(--on-dark-soft)', border: 'none', color: 'var(--on-dark-2)',
              borderRadius: 10, padding: '7px 13px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>
              Ask why →
            </button>
          )}
        </div>
        </Reveal>

        {/* ── CHALLENGE TEASER ── */}
        <Reveal delay={240}>
        <button onClick={() => router.push('/community')} className="gd-shine" style={{
          ...card, width: '100%', display: 'flex', alignItems: 'center', gap: 14,
          cursor: 'pointer', textAlign: 'left', border: '1px solid var(--gold-tint)',
        }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: 'var(--gold-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21h8M12 21v-4M17 4H7v5a5 5 0 0 0 10 0V4z" /><path d="M17 6h3v2a3 3 0 0 1-3 3M7 6H4v2a3 3 0 0 0 3 3" /></svg>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>100,000 kg club</p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--ink-2)' }}>Pack challenge · prize: creatine — see who&rsquo;s closest</p>
          </div>
          <span style={{ color: 'var(--gold)', fontSize: 18 }}>›</span>
        </button>
        </Reveal>

        <Reveal delay={260}>
        <div style={{ marginBottom: 14 }}><QuoteCard mode="random" /></div>
        </Reveal>

        <Reveal delay={300}>
        <button onClick={() => router.push('/nutrition')} style={{ ...card, width: '100%', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', textAlign: 'left' }}>
          <div style={{ width: 46, height: 46, borderRadius: 14, background: 'var(--accent-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{Icon.bowl()}</div>
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

// light-on-mesh chips for the IGNITE hero card
const heroChip = {
  fontSize: 12, fontWeight: 600, padding: '6px 11px', borderRadius: 999,
  background: 'rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.88)',
};

function Stat({ value, label, color, suffix }) {
  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 18,
      padding: '16px 8px', textAlign: 'center', boxShadow: 'var(--shadow-card)',
    }}>
      <p className="gd-disp" style={{ margin: 0, fontSize: 24, fontWeight: 700, color: color || 'var(--ink)' }}>
        {value}{suffix && <span style={{ fontSize: 16 }}>{suffix}</span>}
      </p>
      <p style={{ margin: '5px 0 0', fontSize: 10, color: 'var(--ink-3)', fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase' }}>{label}</p>
    </div>
  );
}

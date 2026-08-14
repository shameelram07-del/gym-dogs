'use client';
import { todayISO, toLocalISO } from '@/lib/day';
import { heatLevel, heatMax, heatStyle } from '@/lib/heat';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useMsal } from '@azure/msal-react';
import BottomNav from '@/components/BottomNav';
import QuoteCard from '@/components/QuoteCard';
import Reveal from '@/components/Reveal';
import { captureError } from '@/lib/monitoring';

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
    const weekKey = toLocalISO(weekStart);
    if (!weeks[weekKey]) weeks[weekKey] = 0;
    try {
      const sets = JSON.parse(log.sets_data || '[]');
      sets.forEach(s => { if (s.kg && s.reps) weeks[weekKey] += parseFloat(s.kg) * parseFloat(s.reps); });
    } catch (e) {
      // A doc we wrote that won't parse understates this week's volume.
      captureError(e, { screen: 'progress', action: 'parse-sets' });
    }
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
    } catch (e) {
      captureError(e, { screen: 'progress', action: 'parse-sets' });
    }
  });
  return Object.entries(maxByExercise)
    .map(([exercise, { kg, date }]) => ({ exercise, weight: kg, date: getWeekLabel(date) }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5);
}

// IGNITE consistency heatmap — last 5 weeks (Mon→Sun), intensity from daily volume
function calcHeatmap(logs) {
  const volByDay = {};
  logs.forEach(log => {
    if (!log.date) return;
    const day = log.date.split('T')[0];
    try {
      const sets = JSON.parse(log.sets_data || '[]');
      sets.forEach(s => { if (s.kg && s.reps) volByDay[day] = (volByDay[day] || 0) + parseFloat(s.kg) * parseFloat(s.reps); });
    } catch (e) {
      captureError(e, { screen: 'progress', action: 'parse-sets' });
    }
  });
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const end = new Date(today);
  const dow = (today.getDay() + 6) % 7; // 0 = Monday
  end.setDate(today.getDate() + (6 - dow)); // grid ends on the coming Sunday
  const max = heatMax(Object.values(volByDay));
  const days = [];
  for (let i = 34; i >= 0; i--) {
    const d = new Date(end); d.setDate(end.getDate() - i);
    const iso = toLocalISO(d);
    days.push({
      iso,
      level: heatLevel(volByDay[iso] || 0, max),
      future: d > today,
    });
  }
  return days;
}

function calcTotalVolume(logs) {
  let total = 0;
  logs.forEach(log => {
    try {
      const sets = JSON.parse(log.sets_data || '[]');
      sets.forEach(s => { if (s.kg && s.reps) total += parseFloat(s.kg) * parseFloat(s.reps); });
    } catch (e) {
      captureError(e, { screen: 'progress', action: 'parse-sets' });
    }
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
const cardStyle = { background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 26, padding: 18 };

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
  const [goalWeight, setGoalWeight] = useState('');
  const [weighIns, setWeighIns] = useState([]); // [{ date:'YYYY-MM-DD', kg:Number }]
  const [goalInput, setGoalInput] = useState('');
  const [wiInput, setWiInput] = useState('');
  const [savingGoal, setSavingGoal] = useState(false);
  const [savingWi, setSavingWi] = useState(false);
  const [saveError, setSaveError] = useState('');
  // weighIns is read-modify-write: the new array is built from the loaded one.
  // If the profile read never landed, that array is empty and saving would
  // replace a real weigh-in history with a single entry — so a weigh-in taken
  // before then is held here and written the moment the history arrives.
  const profileLoaded = useRef(false);
  const pendingWeighIn = useRef(null);

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
    // A weigh-in taken before the history arrived has nothing safe to merge
    // into, so it waits here. Kept inside the effect deliberately: reaching out
    // to component-scope helpers would make this effect depend on them.
    const dropPending = (message) => {
      if (!pendingWeighIn.current) return;
      pendingWeighIn.current = null;
      setSavingWi(false);
      setSaveError(message);
    };

    const fetchProfile = async () => {
      try {
        const res = await fetch(`${PROFILES_URL}?userId=${uid}`, { headers: { 'x-functions-key': PROFILES_KEY } });
        if (res.ok) {
          const data = await res.json();
          const profile = Array.isArray(data) ? data.find(p => p.userId === uid) : null;
          // The read landed, so the weigh-in history on screen is the real one.
          profileLoaded.current = true;
          if (profile) {
            setProfileRef(profile);
            if (profile.soreness) setSorenessLevels(profile.soreness);
            if (profile.goalWeight) setGoalWeight(String(profile.goalWeight));
            if (Array.isArray(profile.weighIns)) setWeighIns(profile.weighIns);
          }

          // Anything logged while this was in flight now has real history to
          // merge into, so write it for real.
          const pending = pendingWeighIn.current;
          if (pending) {
            pendingWeighIn.current = null;
            const base = (profile && Array.isArray(profile.weighIns)) ? profile.weighIns : [];
            const merged = [...base.filter((w) => w.date !== pending.date), pending]
              .sort((a, b) => a.date.localeCompare(b.date));
            setWeighIns(merged);
            const patch = { weighIns: merged, weight: pending.kg };
            try {
              const save = await fetch(PROFILES_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-functions-key': PROFILES_KEY },
                body: JSON.stringify({ userId: uid, ...patch }),
              });
              if (!save.ok) throw new Error(`Save failed (${save.status})`);
              setProfileRef((prev) => ({ ...(prev || {}), userId: uid, ...patch }));
              setSaveError('');
            } catch (e) {
              setSaveError('Could not save your weigh-in — check your connection.');
              captureError(e, { screen: 'progress', action: 'save-weigh-in', endpoint: 'userProfiles', fields: 'weighIns,weight' });
            } finally {
              setSavingWi(false);
            }
          }
        } else {
          dropPending('Could not load your history, so that weigh-in was not saved. Try again.');
          captureError(new Error(`userProfiles failed (${res.status})`), {
            screen: 'progress', action: 'load-profile', endpoint: 'userProfiles', status: res.status,
          });
        }
      } catch (e) {
        // A queued weigh-in can never be merged now — say so rather than leave
        // it spinning against a history that never arrived.
        dropPending('Could not load your history, so that weigh-in was not saved. Try again.');
        captureError(e, { screen: 'progress', action: 'load-profile', endpoint: 'userProfiles' });
      }
    };
    fetchProfile();
  }, [accounts, inProgress, router]);

  useEffect(() => {
    if (!userId) return;
    const fetchLogs = async () => {
      try {
        const res = await fetch(`${API_URL}?userId=${userId}`, { headers: { 'x-functions-key': API_KEY } });
        if (res.ok) setLogs(await res.json());
        else captureError(new Error(`gymLogs failed (${res.status})`), {
          screen: 'progress', action: 'load-logs', endpoint: 'gymLogs', status: res.status,
        });
      } catch (e) {
        // Charts render empty on failure, which reads as "I've never trained".
        captureError(e, { screen: 'progress', action: 'load-logs', endpoint: 'gymLogs' });
      }
      finally { setLoading(false); }
    };
    fetchLogs();
  }, [userId]);

  const cycleLevel = async (areaId) => {
    const next = LEVELS[(LEVELS.indexOf(sorenessLevels[areaId]) + 1) % LEVELS.length];
    const updated = { ...sorenessLevels, [areaId]: next };
    const readiness = calcRecoveryScore(updated);
    setSorenessLevels(updated);
    // Keep the local copy current — this used to never update it, so every
    // later save on this screen re-sent the profile as it was at page load.
    setProfileRef((prev) => ({ ...(prev || {}), userId, soreness: updated, readiness }));
    setSavingSoreness(true);
    setSaveError('');
    try {
      const res = await fetch(PROFILES_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-functions-key': PROFILES_KEY },
        // Only what changed. Sending the whole document re-asserted a stale
        // weighIns / nutrition / goals snapshot over whatever was newer.
        body: JSON.stringify({ userId, soreness: updated, readiness }),
      });
      if (!res.ok) throw new Error(`Save failed (${res.status})`);
      setSorenessSaved(true);
      setTimeout(() => setSorenessSaved(false), 1500);
    } catch (e) {
      setSaveError('Could not save — check your connection.');
      captureError(e, { screen: 'progress', action: 'save-soreness', endpoint: 'userProfiles' });
    }
    finally { setSavingSoreness(false); }
  };

  // Throws on a failed write so callers can say so — the screen updates
  // optimistically, and silently swallowing a 500 leaves the number on screen
  // looking saved when the server never took it.
  const saveProfile = async (patch) => {
    // Merge locally for reads, but send only the changed fields — the API
    // merges by field, so a whole-document write just rolls other screens back.
    setProfileRef((prev) => ({ ...(prev || {}), userId, ...patch }));
    const res = await fetch(PROFILES_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-functions-key': PROFILES_KEY },
      body: JSON.stringify({ userId, ...patch }),
    });
    if (!res.ok) throw new Error(`Save failed (${res.status})`);
  };

  const saveGoal = async () => {
    const g = parseFloat(goalInput);
    if (!g) return;
    setSavingGoal(true);
    setSaveError('');
    setGoalWeight(String(g));
    try { await saveProfile({ goalWeight: g }); }
    catch (e) {
      setSaveError('Could not save your goal — check your connection.');
      // The goal weight itself never leaves the device.
      captureError(e, { screen: 'progress', action: 'save-goal', endpoint: 'userProfiles', fields: 'goalWeight' });
    }
    finally { setSavingGoal(false); setGoalInput(''); }
  };

  const withWeighIn = (list, entry) =>
    [...(Array.isArray(list) ? list : []).filter((w) => w.date !== entry.date), entry]
      .sort((a, b) => a.date.localeCompare(b.date));

  const logWeighIn = async () => {
    const kg = parseFloat(wiInput);
    if (!kg) return;
    const today = todayISO();
    if (!profileLoaded.current) {
      // Take it now, save it the moment the history arrives. Refusing would
      // throw away what they typed; saving now would replace a real history
      // with this one entry.
      pendingWeighIn.current = { date: today, kg };
      setWeighIns((prev) => withWeighIn(prev, { date: today, kg }));
      setWiInput('');
      setSavingWi(true);
      setSaveError('');
      return;
    }
    const next = withWeighIn(weighIns, { date: today, kg });
    setWeighIns(next);
    setWiInput('');
    setSavingWi(true);
    setSaveError('');
    try { await saveProfile({ weighIns: next, weight: kg }); }
    catch (e) {
      setSaveError('Could not save your weigh-in — check your connection.');
      // Field names only — the weight itself is exactly what must not be sent.
      captureError(e, { screen: 'progress', action: 'save-weigh-in', endpoint: 'userProfiles', fields: 'weighIns,weight' });
    }
    finally { setSavingWi(false); }
  };

  if (!userId) return null;

  const weeklyData = calcWeeklyVolume(logs);
  const heatDays = calcHeatmap(logs);
  const prs = calcPRs(logs);
  const totalVolume = calcTotalVolume(logs);
  const totalSessions = new Set(logs.map(l => l.date).filter(Boolean)).size;
  const recoveryScore = calcRecoveryScore(sorenessLevels);
  const status = recoveryStatus(recoveryScore);

  // ── Goal weight + weigh-in tracking ──
  const latestWi = weighIns.length ? weighIns[weighIns.length - 1] : null;
  const currentKg = latestWi ? latestWi.kg : (profileRef?.weight ? parseFloat(profileRef.weight) : null);
  const goalKg = goalWeight ? parseFloat(goalWeight) : null;
  const startKg = weighIns.length ? weighIns[0].kg : currentKg;
  const todayIso2 = todayISO();
  const daysSinceWi = latestWi ? Math.floor((new Date(todayIso2) - new Date(latestWi.date)) / 86400000) : null;
  const needWeighIn = goalKg != null && (latestWi ? daysSinceWi >= 7 : true);
  const atGoal = goalKg != null && currentKg != null && Math.abs(currentKg - goalKg) <= 0.2;

  let estWeeks = null, estDate = null;
  if (goalKg != null && currentKg != null && !atGoal) {
    estWeeks = Math.ceil(Math.abs(currentKg - goalKg) / 0.5); // ~0.5 kg/week healthy pace
    const d = new Date(); d.setDate(d.getDate() + estWeeks * 7);
    estDate = d.toLocaleDateString('en-NZ', { month: 'short', year: 'numeric' });
  }

  let goalPct = 0;
  if (goalKg != null && currentKg != null && startKg != null && startKg !== goalKg) {
    goalPct = Math.min(Math.max((startKg - currentKg) / (startKg - goalKg) * 100, 0), 100);
  }

  const deltaSince = (monthsAgo) => {
    if (!latestWi || weighIns.length < 2) return null;
    const c = new Date(); c.setMonth(c.getMonth() - monthsAgo);
    const cIso = toLocalISO(c);
    const prior = [...weighIns].reverse().find(w => w.date <= cIso);
    if (!prior) return null;
    return +(latestWi.kg - prior.kg).toFixed(1);
  };
  const milestones = [{ label: '1 month', d: deltaSince(1) }, { label: '3 months', d: deltaSince(3) }, { label: '6 months', d: deltaSince(6) }].filter(m => m.d !== null);

  const wiChart = weighIns.slice(-12);

  const aiNote = totalSessions >= 10
    ? 'You have been putting in serious work. Monitor your soreness and consider a deload if several areas read moderate or severe.'
    : totalSessions >= 3
    ? 'Good consistency building up. Keep logging sessions and your chart will start showing real trends.'
    : 'Every session counts. Log workouts consistently and your records will climb week by week.';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)', paddingBottom: 100 }}>

      {/* ── HEADER ── */}
      <div style={{ padding: '52px 20px 14px' }}>
        <h1 className="gd-disp" style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>Progress</h1>
        <p style={{ margin: '2px 0 0', fontSize: 14, color: 'var(--ink-2)' }}>All time</p>
      </div>

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* ── STATS ── */}
        <Reveal>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {[
            { value: loading ? '—' : totalSessions, label: 'sessions', color: 'var(--ink)' },
            { value: loading ? '—' : `${totalVolume}`, label: 'kg lifted', color: 'var(--accent-strong)' },
            { value: loading ? '—' : prs.length, label: 'PRs set', color: 'var(--orange)' },
          ].map((s, i) => (
            <div key={i} style={{ background: 'var(--soft)', borderRadius: 16, padding: '14px 8px', textAlign: 'center' }}>
              <p className="gd-disp" style={{ margin: 0, fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--ink-3)', fontWeight: 600 }}>{s.label}</p>
            </div>
          ))}
        </div>
        </Reveal>

        {/* ── GOAL WEIGHT + WEIGH-IN ── */}
        <Reveal delay={30}>
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <p style={eyebrow}>Goal weight</p>
            {goalKg != null && currentKg != null && (
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>
                <span className="gd-grad-text">{currentKg}</span> <span style={{ color: 'var(--ink-3)' }}>&rarr; {goalKg} kg</span>
              </p>
            )}
          </div>

          {goalKg == null ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="number" inputMode="decimal" value={goalInput} onChange={e => setGoalInput(e.target.value)} placeholder="Target weight (kg)"
                style={{ flex: 1, background: 'var(--soft)', border: '1px solid var(--line)', borderRadius: 12, padding: '12px 14px', color: 'var(--ink)', fontSize: 14, fontWeight: 600, outline: 'none', boxSizing: 'border-box' }} />
              <button onClick={saveGoal} disabled={savingGoal || !goalInput} style={{ background: 'var(--accent)', border: 'none', borderRadius: 12, padding: '0 18px', color: 'var(--on-accent)', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: savingGoal || !goalInput ? 0.5 : 1 }}>Set</button>
            </div>
          ) : (
            <>
              <div style={{ background: 'var(--soft)', borderRadius: 999, height: 9, overflow: 'hidden', marginBottom: 8 }}>
                <div className="gd-shimbar" style={{ width: `${goalPct}%`, height: '100%', borderRadius: 999, background: 'var(--grad)', transition: 'width 1s cubic-bezier(0.22,1,0.36,1)' }} />
              </div>
              <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>
                {atGoal ? '🎉 You’re at your goal — nice work.'
                  : currentKg == null ? 'Log your first weigh-in to start tracking.'
                  : <>At a steady pace you&rsquo;ll reach <b style={{ color: 'var(--ink)' }}>{goalKg} kg</b> in about <b style={{ color: 'var(--ink)' }}>{estWeeks} weeks</b> (&asymp; {estDate}).</>}
              </p>

              {needWeighIn && (
                <div style={{ background: 'var(--orange-tint)', borderRadius: 12, padding: '9px 12px', marginBottom: 10 }}>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--orange-ink)' }}>&#9200; Time for your weekly weigh-in</p>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="number" inputMode="decimal" value={wiInput} onChange={e => setWiInput(e.target.value)} placeholder="Weight today (kg)"
                  style={{ flex: 1, background: 'var(--soft)', border: '1px solid var(--line)', borderRadius: 12, padding: '12px 14px', color: 'var(--ink)', fontSize: 14, fontWeight: 600, outline: 'none', boxSizing: 'border-box' }} />
                <button onClick={logWeighIn} disabled={savingWi || !wiInput} style={{ background: 'var(--accent)', border: 'none', borderRadius: 12, padding: '0 18px', color: 'var(--on-accent)', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: savingWi || !wiInput ? 0.5 : 1 }}>{savingWi ? '…' : 'Log'}</button>
              </div>

              {saveError && (
                <div style={{ background: 'var(--red-tint)', borderRadius: 12, padding: '9px 12px', marginTop: 10 }}>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--red-ink)' }}>&#9888; {saveError}</p>
                </div>
              )}

              {wiChart.length >= 2 && (
                <div style={{ marginTop: 14 }}>
                  <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: 70, display: 'block' }}>
                    {(() => {
                      const kgs = wiChart.map(p => p.kg);
                      const lo = Math.min(...kgs, goalKg), hi = Math.max(...kgs, goalKg);
                      const range = (hi - lo) || 1;
                      const yv = v => 96 - ((v - lo) / range) * 92;
                      const dPath = wiChart.map((p, i) => `${i === 0 ? 'M' : 'L'}${(i / (wiChart.length - 1) * 100).toFixed(1)},${yv(p.kg).toFixed(1)}`).join(' ');
                      return (<>
                        <line x1="0" y1={yv(goalKg)} x2="100" y2={yv(goalKg)} stroke="var(--accent)" strokeWidth="0.7" strokeDasharray="3 2" opacity="0.7" />
                        <path d={dPath} fill="none" stroke="var(--accent-strong)" strokeWidth="1.6" strokeLinejoin="round" />
                      </>);
                    })()}
                  </svg>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--ink-3)', fontWeight: 600, marginTop: 2 }}>
                    <span>{wiChart[0].kg}kg</span><span>goal {goalKg}kg</span><span>{wiChart[wiChart.length - 1].kg}kg</span>
                  </div>
                </div>
              )}

              {milestones.length > 0 && (
                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  {milestones.map(m => (
                    <div key={m.label} style={{ flex: 1, background: 'var(--soft)', borderRadius: 12, padding: '10px 8px', textAlign: 'center' }}>
                      <p className="gd-disp" style={{ margin: 0, fontSize: 15, fontWeight: 700, color: m.d < 0 ? 'var(--accent-strong)' : m.d > 0 ? 'var(--orange-ink)' : 'var(--ink)' }}>{m.d > 0 ? '+' : ''}{m.d}kg</p>
                      <p style={{ margin: '2px 0 0', fontSize: 10, color: 'var(--ink-3)', fontWeight: 600 }}>vs {m.label}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        </Reveal>

        {/* ── WEEKLY VOLUME ── */}
        <Reveal delay={60}>
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
                  <div className={d.isCurrent ? 'gd-shimbar' : undefined} style={{ width: '100%', height: chartOn ? `${Math.max(d.volume, 5)}%` : '0%', background: d.isCurrent ? 'var(--grad)' : 'var(--soft)', borderRadius: '8px 8px 4px 4px', transition: 'height 0.8s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: d.isCurrent ? '0 4px 18px var(--accent-glow)' : 'none' }} />
                  <span style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600 }}>{d.week}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        </Reveal>

        {/* ── CONSISTENCY HEATMAP (IGNITE) ── */}
        {!loading && heatDays.length > 0 && (
          <Reveal delay={85}>
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={eyebrow}>Consistency</p>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', border: '1px solid var(--line)', borderRadius: 999, padding: '4px 10px' }}>
                {heatDays.filter(d => d.level > 0).length} of 35 days
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginTop: 12 }}>
              {heatDays.map((d, i) => (
                <div key={d.iso} style={{
                  aspectRatio: '1', borderRadius: 7,
                  ...heatStyle(d.level),
                  opacity: d.future ? 0.3 : 1,
                  animation: `gdCellIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) ${i * 18}ms both`,
                }} />
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
              <span style={{ fontSize: 10, color: 'var(--ink-3)', fontWeight: 600, letterSpacing: '0.06em' }}>MON</span>
              <span style={{ fontSize: 10, color: 'var(--ink-3)', fontWeight: 600, letterSpacing: '0.06em' }}>SUN</span>
            </div>
          </div>
          </Reveal>
        )}

        {/* ── SORENESS ── */}
        <Reveal delay={110}>
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <p style={eyebrow}>Soreness check-in</p>
              <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--ink-3)' }}>Tap a muscle to update</p>
            </div>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 600, textAlign: 'right', color: saveError ? 'var(--red-ink)' : sorenessSaved ? 'var(--accent-strong)' : 'var(--ink-3)' }}>
              {savingSoreness ? 'Saving…' : saveError ? '⚠ Not saved' : sorenessSaved ? '✓ Saved' : ''}
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
              <p className="gd-disp" style={{ margin: '2px 0 0', fontSize: 28, fontWeight: 700, color: status.color, lineHeight: 1 }}>{recoveryScore}%</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: status.color }}>{status.label}</p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--ink-3)' }}>{status.sub}</p>
            </div>
          </div>
        </div>
        </Reveal>

        {/* ── PERSONAL RECORDS ── */}
        <Reveal delay={150}>
        <div style={cardStyle}>
          <p style={{ ...eyebrow, marginBottom: 6 }}>Personal records</p>
          {loading ? (
            <p style={{ fontSize: 12, color: 'var(--ink-3)', textAlign: 'center', padding: '16px 0' }}>Loading…</p>
          ) : prs.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--ink-3)', textAlign: 'center', padding: '16px 0' }}>Log a session to start tracking PRs.</p>
          ) : (
            prs.map((pr, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: i === 0 ? 'none' : '1px solid var(--line-2)' }}>
                <div className="gd-shine" style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--grad-soft)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21h8M12 21v-4M17 4H7v5a5 5 0 0 0 10 0V4z" /><path d="M17 6h3v2a3 3 0 0 1-3 3M7 6H4v2a3 3 0 0 0 3 3" /></svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pr.exercise}</p>
                  <p style={{ margin: '1px 0 0', fontSize: 12, color: 'var(--ink-3)' }}>{pr.date}</p>
                </div>
                <p className="gd-disp gd-grad-text" style={{ margin: 0, fontSize: 17, fontWeight: 700, flexShrink: 0 }}>{pr.weight}kg</p>
              </div>
            ))
          )}
        </div>
        </Reveal>

        {/* ── AI RECOVERY NOTE ── */}
        <Reveal delay={190}>
        <div style={{ background: `linear-gradient(135deg, var(--ai-card-1), var(--ai-card-2))`, borderRadius: 26, padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 18 }}>✨</span>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>AI Recovery Note</span>
          </div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: 'var(--on-dark)' }}>{aiNote}</p>
        </div>
        </Reveal>

        {/* ── GYM DADDY ── */}
        <Reveal delay={230}>
        <QuoteCard mode="random" plain />
        </Reveal>

      </div>

      <BottomNav />
    </div>
  );
}

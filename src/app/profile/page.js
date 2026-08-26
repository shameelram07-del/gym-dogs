'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMsal } from '@azure/msal-react';
import BottomNav from '@/components/BottomNav';
import ThemeToggle from '@/components/ThemeToggle';
import Reveal from '@/components/Reveal';
import { captureError } from '@/lib/monitoring';
import { eyebrow, cardStyle } from '@/lib/ui';
import { prCount } from '@/lib/prs';

const API_URL = 'https://gymdogs-api-g9d0gve4angygdcj.newzealandnorth-01.azurewebsites.net/api/gymLogs';
const PROFILES_URL = 'https://gymdogs-api-g9d0gve4angygdcj.newzealandnorth-01.azurewebsites.net/api/userProfiles';
const API_KEY = process.env.NEXT_PUBLIC_API_KEY;
const PROFILES_KEY = process.env.NEXT_PUBLIC_PROFILES_API_KEY;

const emptyStats = { weight: '', height: '', age: '', bodyFat: '' };

// Labels for the ids saved by the onboarding flow.
const GOAL_LABELS = {
  build_muscle: 'Build muscle', lose_fat: 'Lose body fat', get_stronger: 'Get stronger',
  improve_fitness: 'Improve fitness', athletic: 'Athletic performance', general_health: 'General health',
};
const EQUIP_LABELS = {
  full_gym: 'Full gym', home_gym: 'Home gym', dumbbells: 'Dumbbells only',
  resistance: 'Resistance bands', bodyweight: 'Bodyweight only', outdoor: 'Outdoor / park',
};

// Build the goal chips from real onboarding answers; fall back to a nudge if none.
function goalChips(onboarding) {
  if (!onboarding) return null;
  const chips = [];
  (onboarding.goals || []).forEach(g => { if (GOAL_LABELS[g]) chips.push({ text: GOAL_LABELS[g], hot: true }); });
  if (onboarding.days) chips.push({ text: `${onboarding.days} days/wk`, hot: false });
  if (onboarding.duration) chips.push({ text: `${onboarding.duration} min`, hot: false });
  (onboarding.equipment || []).slice(0, 1).forEach(e => { if (EQUIP_LABELS[e]) chips.push({ text: EQUIP_LABELS[e], hot: false }); });
  return chips.length > 0 ? chips : null;
}

function calcStreak(logs) {
  if (!logs || logs.length === 0) return 0;
  const dates = [...new Set(logs.map(l => l.date).filter(Boolean))].sort().reverse();
  if (dates.length === 0) return 0;
  let streak = 0;
  let current = new Date();
  current.setHours(0, 0, 0, 0);
  for (const date of dates) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const diff = Math.round((current - d) / (1000 * 60 * 60 * 24));
    if (diff <= 1) { streak++; current = d; } else break;
  }
  return streak;
}

function calcTotalSessions(logs) {
  return new Set(logs.map(l => l.date).filter(Boolean)).size;
}

// "Member since" = the month of your first logged session (was always the current month).
function getJoinDate(logs) {
  const dates = (logs || []).map(l => l.date).filter(Boolean).sort();
  const first = dates.length > 0 ? new Date(dates[0]) : new Date();
  return first.toLocaleDateString('en-NZ', { month: 'long', year: 'numeric' });
}

function calcTotalVolume(logs) {
  let total = 0;
  (logs || []).forEach(log => {
    try {
      const sets = JSON.parse(log.sets_data || '[]');
      sets.forEach(s => { if (s.kg && s.reps) total += parseFloat(s.kg) * parseFloat(s.reps); });
    } catch (e) {
      // Same corrupt-doc case as the dashboard — here it silently lowers the level.
      captureError(e, { screen: 'profile', action: 'parse-sets' });
    }
  });
  return total;
}


// Same XP math as the dashboard so the level shown here always matches.
const LEVEL_TITLES = ['Pup', 'Young Dog', 'Trainee', 'Working Dog', 'Strong Dog', 'Beast', 'Big Dog', 'Alpha', 'Top Dog', 'Legend'];
function computeLevel(sessions, volume) {
  const totalXp = sessions * 50 + Math.round(volume / 100);
  let level = 1, into = totalXp, need = 200;
  while (into >= need) { into -= need; level++; need = 200 * level; }
  return { level, title: LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)] };
}

export default function ProfilePage() {
  const router = useRouter();
  const { instance, accounts, inProgress } = useMsal();
  const [userId, setUserId] = useState(null);
  const [userName, setUserName] = useState('');
  const [userInitials, setUserInitials] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [joinDate, setJoinDate] = useState('');
  const [logs, setLogs] = useState([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [editingStats, setEditingStats] = useState(false);
  const [savingStats, setSavingStats] = useState(false);
  const [statsSaved, setStatsSaved] = useState(false);
  const [stats, setStats] = useState(emptyStats);
  const [tempStats, setTempStats] = useState(emptyStats);
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [profileRef, setProfileRef] = useState(null);
  const [notice, setNotice] = useState('');

  const showNotice = (msg) => { setNotice(msg); setTimeout(() => setNotice(''), 1800); };

  useEffect(() => {
    if (inProgress === 'startup') return;
    if (accounts.length === 0) { router.push('/login'); return; }
    const user = accounts[0];
    const uid = user.localAccountId;
    setUserId(uid);
    setUserEmail(user.username || '');
    setJoinDate(getJoinDate([])); // fallback; replaced by first-log date once logs load

    const isGuid = (s) => !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim());
    const entraName = user.name && user.name !== 'unknown' && !isGuid(user.name)
      ? user.name
      : user.username?.split('@')[0] || 'Athlete';
    setUserName(entraName);
    setUserInitials(entraName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2));

    const fetchProfile = async () => {
      try {
        const res = await fetch(`${PROFILES_URL}?userId=${uid}`, { headers: { 'x-functions-key': PROFILES_KEY } });
        if (res.ok) {
          const data = await res.json();
          // Find THIS user's profile — [0] could be someone else's once more users exist.
          const profile = Array.isArray(data) ? data.find((p) => p.userId === uid) : null;
          if (profile) {
            setProfileRef(profile);
            if (profile.name && profile.name !== uid) {
              setUserName(profile.name);
              setUserInitials(profile.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2));
            }
            const savedStats = {
              weight: profile.weight || '', height: profile.height || '',
              age: profile.age || '', bodyFat: profile.bodyFat || '',
            };
            setStats(savedStats);
            setTempStats(savedStats);
          }
        }
      } catch (e) {
        captureError(e, { screen: 'profile', action: 'load-profile', endpoint: 'userProfiles' });
      }
    };
    fetchProfile();
  }, [accounts, inProgress, router]);

  useEffect(() => {
    if (!userId) return;
    const fetchLogs = async () => {
      try {
        const res = await fetch(`${API_URL}?userId=${userId}`, { headers: { 'x-functions-key': API_KEY } });
        if (res.ok) {
          const data = await res.json();
          setLogs(data);
          setJoinDate(getJoinDate(data));
        }
      } catch (e) {
        captureError(e, { screen: 'profile', action: 'load-logs', endpoint: 'gymLogs' });
      }
      finally { setStatsLoading(false); }
    };
    fetchLogs();
  }, [userId]);

  const handleSaveName = async () => {
    if (!tempName.trim()) return;
    setSavingName(true);
    try {
      const initials = tempName.trim().split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
      const name = tempName.trim();
      const res = await fetch(PROFILES_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-functions-key': PROFILES_KEY },
        // Only the two fields being edited. This used to post the whole profile
        // as it was at page load — and since profileRef was never refreshed
        // after a save, a second save re-sent that same stale document.
        body: JSON.stringify({ userId, name, initials })
      });
      if (res.ok) {
        setUserName(name);
        setUserInitials(initials);
        setProfileRef((prev) => ({ ...(prev || {}), userId, name, initials }));
        setEditingName(false);
      } else {
        // The modal just sits there on a failure, which reads as a dead button.
        captureError(new Error(`Name not saved (${res.status})`), {
          screen: 'profile', action: 'save-name', endpoint: 'userProfiles', status: res.status,
        });
      }
    } catch (e) {
      captureError(e, { screen: 'profile', action: 'save-name', endpoint: 'userProfiles' });
    }
    finally { setSavingName(false); }
  };

  const handleSaveStats = async () => {
    setSavingStats(true);
    try {
      const body = {
        userId,
        weight: tempStats.weight, height: tempStats.height,
        age: tempStats.age, bodyFat: tempStats.bodyFat,
      };
      const res = await fetch(PROFILES_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-functions-key': PROFILES_KEY },
        // Just the four body stats. `name` is no longer re-sent from state, and
        // the rest of the profile is left alone rather than overwritten with a
        // page-load-old copy.
        body: JSON.stringify(body)
      });
      if (res.ok) {
        setStats(tempStats);
        setProfileRef((prev) => ({ ...(prev || {}), ...body }));
        setEditingStats(false);
        setStatsSaved(true);
        setTimeout(() => setStatsSaved(false), 2000);
      } else {
        // Field names only — the body stats themselves stay on the device.
        captureError(new Error(`Body stats not saved (${res.status})`), {
          screen: 'profile', action: 'save-stats', endpoint: 'userProfiles', status: res.status,
          fields: 'weight,height,age,bodyFat',
        });
      }
    } catch (e) {
      captureError(e, {
        screen: 'profile', action: 'save-stats', endpoint: 'userProfiles',
        fields: 'weight,height,age,bodyFat',
      });
    }
    finally { setSavingStats(false); }
  };

  const handleSignOut = () => instance.logoutRedirect({ postLogoutRedirectUri: '/login' });

  if (!userId) return null;

  const totalSessions = calcTotalSessions(logs);
  const streak = calcStreak(logs);
  // Same definition as Progress — see @/lib/prs. These two screens showed 22
  // and 5 for the same account until they shared one.
  const prs = prCount(logs, (e) => captureError(e, { screen: 'profile', action: 'parse-sets' }));
  const totalVolume = calcTotalVolume(logs);
  const levelInfo = computeLevel(totalSessions, totalVolume);
  const myGoals = goalChips(profileRef?.onboarding);

  // Trophy coins — SVG icons on gradient coins, shine when earned
  const ACHIEVEMENTS = [
    { icon: 'medal',    label: 'First PR',      earned: prs >= 1,         coin: 'var(--grad)',       glow: 'var(--accent-glow)' },
    { icon: 'trophy',   label: '5 PRs set',     earned: prs >= 5,         coin: 'var(--coin-gold)',  glow: 'var(--coin-gold-glow)' },
    { icon: 'dumbbell', label: '10 tonnes',     earned: totalVolume >= 10000, coin: 'var(--coin-ice)',   glow: 'var(--coin-ice-glow)' },
    { icon: 'flame',    label: '14-day streak', earned: streak >= 14,         coin: 'var(--coin-ember)', glow: 'var(--coin-ember-glow)' },
  ];
  const COIN_ICONS = {
    medal:    <><circle cx="12" cy="8" r="6" /><path d="M8.2 13.9 7 22l5-3 5 3-1.2-8.1" /></>,
    trophy:   <><path d="M8 21h8M12 21v-4M17 4H7v5a5 5 0 0 0 10 0V4z" /><path d="M17 6h3v2a3 3 0 0 1-3 3M7 6H4v2a3 3 0 0 0 3 3" /></>,
    dumbbell: <><path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" /></>,
    flame:    <><path d="M12 22c4 0 7-2.7 7-7 0-3-2-5.5-3.5-7C15 10 14 11 13 11c0-3-1-6-4-8 .5 3-1 5-2.5 7C5 11.7 5 13 5 15c0 4.3 3 7 7 7z" /></>,
  };
  const BODY_STATS = [
    { key: 'weight',  label: 'Weight',   unit: 'kg' },
    { key: 'height',  label: 'Height',   unit: 'cm' },
    { key: 'age',     label: 'Age',      unit: 'yr' },
    { key: 'bodyFat', label: 'Body fat', unit: '%' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)', paddingBottom: 100 }}>

      {/* ── HEADER — IGNITE conic XP ring ── */}
      <div style={{ textAlign: 'center', padding: '52px 20px 8px' }}>
        <div style={{
          width: 96, height: 96, borderRadius: '50%', margin: '0 auto 12px', padding: 3.5,
          background: 'conic-gradient(from 210deg, var(--ice), var(--steel), var(--vio), var(--ice))',
          animation: 'gdSpin 10s linear infinite',
        }}>
          <div className="gd-disp" style={{
            width: '100%', height: '100%', borderRadius: '50%', background: 'var(--soft)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 32, fontWeight: 700, color: 'var(--ink)',
            animation: 'gdSpin 10s linear infinite reverse',
          }}>{userInitials}</div>
        </div>
        <p className="gd-disp" style={{ margin: 0, fontSize: 23, fontWeight: 700 }}>{userName}</p>
        <p style={{ margin: '3px 0 10px', fontSize: 13, color: 'var(--ink-2)' }}>
          {streak > 0 ? `${streak}-day streak · Member since ${joinDate}` : `Member since ${joinDate}`}
        </p>
        <div className="gd-disp" style={{
          display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 14,
          padding: '7px 15px', borderRadius: 999, background: 'var(--grad)', color: 'var(--on-accent)',
          fontWeight: 700, fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase',
          boxShadow: 'var(--glow-grad)',
        }}>
          LV {levelInfo.level} · {levelInfo.title}
        </div>
        <br />
        <button onClick={() => { setTempName(userName); setEditingName(true); }} style={{
          display: 'inline-flex', padding: '10px 22px', borderRadius: 14,
          background: 'var(--soft)', border: '1px solid var(--line)', color: 'var(--ink)',
          fontSize: 14, fontWeight: 700, cursor: 'pointer',
        }}>Edit profile</button>
      </div>

      <div style={{ padding: '8px 20px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── STATS ── */}
        <Reveal delay={0} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {[
            { value: statsLoading ? '—' : totalSessions, label: 'workouts' },
            { value: statsLoading ? '—' : streak, label: 'day streak' },
            { value: statsLoading ? '—' : prs, label: 'PRs set' },
          ].map((s, i) => (
            <div key={i} style={{ background: 'var(--soft)', borderRadius: 16, padding: '14px 8px', textAlign: 'center' }}>
              {/* Gradient numbers — the three read as one set rather than three
                  unrelated colours. The label underneath carries the meaning. */}
              <p className="gd-disp gd-grad-text" style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{s.value}</p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--ink-3)', fontWeight: 600 }}>{s.label}</p>
            </div>
          ))}
        </Reveal>

        {/* ── MY GOALS (from onboarding answers) ── */}
        <div>
          <p style={{ ...eyebrow, marginLeft: 4, marginBottom: 9 }}>My goals</p>
          {myGoals ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {myGoals.map((g, i) => (
                <span key={i} style={{
                  fontSize: 13, fontWeight: 600, padding: '8px 14px', borderRadius: 999,
                  background: g.hot ? 'var(--accent-tint)' : 'var(--soft)',
                  color: g.hot ? 'var(--accent-strong)' : 'var(--ink-2)',
                }}>{g.text}</span>
              ))}
            </div>
          ) : (
            <button onClick={() => router.push('/onboarding')} style={{
              width: '100%', background: 'var(--soft)', border: '1px dashed var(--line)', borderRadius: 14,
              padding: 14, color: 'var(--ink-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>
              Answer a few questions to set your goals →
            </button>
          )}
        </div>

        {/* ── BODY STATS ── */}
        <Reveal delay={80} style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 18px 12px' }}>
            <p style={eyebrow}>Body stats</p>
            {!editingStats ? (
              <button onClick={() => { setTempStats(stats); setEditingStats(true); }} style={{ background: 'none', border: 'none', color: 'var(--accent-strong)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Edit ›</button>
            ) : (
              <div style={{ display: 'flex', gap: 14 }}>
                <button onClick={() => { setTempStats(stats); setEditingStats(false); }} style={{ background: 'none', border: 'none', color: 'var(--ink-3)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleSaveStats} disabled={savingStats} style={{ background: 'none', border: 'none', color: 'var(--accent-strong)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  {savingStats ? 'Saving…' : statsSaved ? '✓ Saved' : 'Save'}
                </button>
              </div>
            )}
          </div>
          {BODY_STATS.map((item) => (
            <div key={item.key} style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', borderTop: '1px solid var(--line-2)' }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 500, flex: 1, color: 'var(--ink-2)' }}>{item.label}</p>
              {editingStats ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="number" inputMode="decimal" value={tempStats[item.key]}
                    onChange={e => setTempStats(prev => ({ ...prev, [item.key]: e.target.value }))}
                    style={{ width: 70, background: 'var(--soft)', border: '1px solid var(--accent)', borderRadius: 8, padding: '6px 8px', color: 'var(--ink)', fontSize: 14, fontWeight: 700, textAlign: 'right', outline: 'none' }} />
                  <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{item.unit}</span>
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: stats[item.key] ? 'var(--ink)' : 'var(--ink-3)' }}>
                  {stats[item.key] ? `${stats[item.key]} ${item.unit}` : '—'}
                </p>
              )}
            </div>
          ))}
        </Reveal>

        {/* ── ACHIEVEMENTS ── */}
        <Reveal delay={160} style={cardStyle}>
          <p style={{ ...eyebrow, marginBottom: 12 }}>Achievements</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 9 }}>
            {ACHIEVEMENTS.map((a, i) => (
              <div key={i} style={{ textAlign: 'center', opacity: a.earned ? 1 : 0.45 }}>
                <div className={a.earned ? 'gd-shine' : undefined} style={{
                  width: 54, height: 54, borderRadius: '50%', margin: '0 auto 8px',
                  background: a.earned ? a.coin : 'var(--soft)',
                  border: '1px solid var(--line)',
                  boxShadow: a.earned ? `0 8px 22px ${a.glow}` : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a.earned ? 'var(--on-accent)' : 'var(--ink-3)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    {COIN_ICONS[a.icon]}
                  </svg>
                </div>
                <p style={{ margin: 0, fontSize: 10.5, fontWeight: 700, color: a.earned ? 'var(--ink)' : 'var(--ink-3)', lineHeight: 1.3 }}>{a.label}</p>
              </div>
            ))}
          </div>
        </Reveal>

        {/* ── ACCOUNT ── */}
        <Reveal delay={240} style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
          <p style={{ ...eyebrow, padding: '16px 18px 10px' }}>Account</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 18px', borderTop: '1px solid var(--line-2)' }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-2)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
            </div>
            <span style={{ fontSize: 14, color: 'var(--ink)', flex: 1, fontWeight: 500 }}>Dark mode</span>
            <ThemeToggle size={34} />
          </div>
          {[
            { icon: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-4 3-6 7-6s7 2 7 6" /></>, label: 'Edit display name', action: () => { setTempName(userName); setEditingName(true); } },
            { icon: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>, label: 'Notification preferences', action: () => showNotice('Notifications — coming soon') },
            { icon: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>, label: 'Privacy settings', action: () => showNotice('Privacy settings — coming soon') },
          ].map((item) => (
            <button key={item.label} onClick={item.action} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '15px 18px',
              background: 'none', border: 'none', borderTop: '1px solid var(--line-2)', cursor: 'pointer', textAlign: 'left',
            }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-2)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{item.icon}</svg>
              </div>
              <span style={{ fontSize: 14, color: 'var(--ink)', flex: 1, fontWeight: 500 }}>{item.label}</span>
              <span style={{ fontSize: 18, color: 'var(--ink-3)' }}>›</span>
            </button>
          ))}
        </Reveal>

        {/* ── SIGN OUT ── */}
        <button onClick={handleSignOut} style={{
          width: '100%', background: 'var(--red-tint)', border: 'none', borderRadius: 16,
          padding: 16, color: 'var(--red-ink)', fontSize: 15, fontWeight: 700, cursor: 'pointer',
        }}>
          Sign out
        </button>

      </div>

      {/* ── TOAST ── */}
      {notice && (
        <div style={{ position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)', zIndex: 150, background: 'var(--ai-card-1)', color: 'var(--on-dark)', fontSize: 13, fontWeight: 600, padding: '10px 18px', borderRadius: 999 }}>
          {notice}
        </div>
      )}

      {/* ── EDIT NAME MODAL ── */}
      {editingName && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px', background: 'rgba(0,0,0,0.5)' }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 26, padding: 24, width: '100%', maxWidth: 360 }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 6px', color: 'var(--ink)' }}>Display name</h3>
            <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: '0 0 18px' }}>This is how you appear in the app and on the leaderboard.</p>
            <input type="text" value={tempName} onChange={e => setTempName(e.target.value)} placeholder="e.g. Shameel" autoFocus
              style={{ width: '100%', background: 'var(--soft)', border: '1px solid var(--accent)', borderRadius: 12, padding: '14px 16px', color: 'var(--ink)', fontSize: 15, outline: 'none', marginBottom: 16, boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setEditingName(false)} style={{ flex: 1, padding: 14, borderRadius: 12, border: '1px solid var(--line)', background: 'none', color: 'var(--ink-2)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSaveName} disabled={savingName || !tempName.trim()} style={{ flex: 1, padding: 14, borderRadius: 12, border: 'none', background: 'var(--accent)', color: 'var(--on-accent)', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: savingName || !tempName.trim() ? 0.5 : 1 }}>{savingName ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMsal } from '@azure/msal-react';
import BottomNav from '@/components/BottomNav';
import ThemeToggle from '@/components/ThemeToggle';

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

function calcPRCount(logs) {
  const maxByExercise = {};
  logs.forEach(log => {
    if (!log.exName) return;
    try {
      const sets = JSON.parse(log.sets_data || '[]');
      sets.forEach(s => {
        if (s.kg && parseFloat(s.kg) > 0) {
          const kg = parseFloat(s.kg);
          if (!maxByExercise[log.exName] || kg > maxByExercise[log.exName]) maxByExercise[log.exName] = kg;
        }
      });
    } catch (e) {}
  });
  return Object.keys(maxByExercise).length;
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
    } catch (e) {}
  });
  return total;
}

const eyebrow = { fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', color: 'var(--ink-3)', textTransform: 'uppercase', margin: 0 };
const cardStyle = { background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 22, padding: 18 };

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
      } catch (e) {}
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
      } catch (e) {}
      finally { setStatsLoading(false); }
    };
    fetchLogs();
  }, [userId]);

  const handleSaveName = async () => {
    if (!tempName.trim()) return;
    setSavingName(true);
    try {
      const initials = tempName.trim().split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
      const res = await fetch(PROFILES_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-functions-key': PROFILES_KEY },
        body: JSON.stringify({ ...(profileRef || {}), userId, name: tempName.trim(), initials })
      });
      if (res.ok) {
        setUserName(tempName.trim());
        setUserInitials(initials);
        setEditingName(false);
      }
    } catch (e) {}
    finally { setSavingName(false); }
  };

  const handleSaveStats = async () => {
    setSavingStats(true);
    try {
      const res = await fetch(PROFILES_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-functions-key': PROFILES_KEY },
        body: JSON.stringify({
          ...(profileRef || {}), userId, name: userName,
          weight: tempStats.weight, height: tempStats.height,
          age: tempStats.age, bodyFat: tempStats.bodyFat,
        })
      });
      if (res.ok) {
        setStats(tempStats);
        setEditingStats(false);
        setStatsSaved(true);
        setTimeout(() => setStatsSaved(false), 2000);
      }
    } catch (e) {}
    finally { setSavingStats(false); }
  };

  const handleSignOut = () => instance.logoutRedirect({ postLogoutRedirectUri: '/login' });

  if (!userId) return null;

  const totalSessions = calcTotalSessions(logs);
  const streak = calcStreak(logs);
  const prCount = calcPRCount(logs);
  const totalVolume = calcTotalVolume(logs);
  const myGoals = goalChips(profileRef?.onboarding);

  const ACHIEVEMENTS = [
    { emoji: '🥇', label: 'First PR',      earned: prCount >= 1 },
    { emoji: '🏆', label: '5 PRs set',     earned: prCount >= 5 },
    { emoji: '💪', label: '10 tonnes',     earned: totalVolume >= 10000 },
    { emoji: '🔥', label: '14-day streak', earned: streak >= 14 },
  ];
  const BODY_STATS = [
    { key: 'weight',  label: 'Weight',   unit: 'kg' },
    { key: 'height',  label: 'Height',   unit: 'cm' },
    { key: 'age',     label: 'Age',      unit: 'yr' },
    { key: 'bodyFat', label: 'Body fat', unit: '%' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)', paddingBottom: 100 }}>

      {/* ── HEADER ── */}
      <div style={{ textAlign: 'center', padding: '52px 20px 8px' }}>
        <div style={{
          width: 84, height: 84, borderRadius: '50%', margin: '0 auto 12px',
          background: 'linear-gradient(135deg, var(--violet), var(--blue))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 30, fontWeight: 700, color: '#fff',
        }}>{userInitials}</div>
        <p style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>{userName}</p>
        <p style={{ margin: '3px 0 14px', fontSize: 14, color: 'var(--ink-2)' }}>
          {streak > 0 ? `${streak} day streak 🔥` : `Member since ${joinDate}`}
        </p>
        <button onClick={() => { setTempName(userName); setEditingName(true); }} style={{
          display: 'inline-flex', padding: '10px 22px', borderRadius: 14,
          background: 'var(--soft)', border: '1px solid var(--line)', color: 'var(--ink)',
          fontSize: 14, fontWeight: 700, cursor: 'pointer',
        }}>Edit profile</button>
      </div>

      <div style={{ padding: '8px 20px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── STATS ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {[
            { value: statsLoading ? '—' : totalSessions, label: 'workouts', color: 'var(--ink)' },
            { value: statsLoading ? '—' : streak, label: 'day streak', color: 'var(--orange)' },
            { value: statsLoading ? '—' : prCount, label: 'PRs set', color: 'var(--accent-strong)' },
          ].map((s, i) => (
            <div key={i} style={{ background: 'var(--soft)', borderRadius: 16, padding: '14px 8px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: s.color }}>{s.value}</p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--ink-3)', fontWeight: 600 }}>{s.label}</p>
            </div>
          ))}
        </div>

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
        <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
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
        </div>

        {/* ── ACHIEVEMENTS ── */}
        <div style={cardStyle}>
          <p style={{ ...eyebrow, marginBottom: 12 }}>Achievements</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 9 }}>
            {ACHIEVEMENTS.map((a, i) => (
              <div key={i} style={{
                background: a.earned ? 'var(--accent-tint)' : 'var(--soft)',
                borderRadius: 16, padding: '16px 10px', textAlign: 'center', opacity: a.earned ? 1 : 0.5,
              }}>
                <div style={{ fontSize: 26, marginBottom: 6, filter: a.earned ? 'none' : 'grayscale(1)' }}>{a.emoji}</div>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: a.earned ? 'var(--accent-strong)' : 'var(--ink-3)', lineHeight: 1.3 }}>{a.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── ACCOUNT ── */}
        <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
          <p style={{ ...eyebrow, padding: '16px 18px 10px' }}>Account</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 18px', borderTop: '1px solid var(--line-2)' }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>🌙</div>
            <span style={{ fontSize: 14, color: 'var(--ink)', flex: 1, fontWeight: 500 }}>Dark mode</span>
            <ThemeToggle size={34} />
          </div>
          {[
            { emoji: '👤', label: 'Edit display name', action: () => { setTempName(userName); setEditingName(true); } },
            { emoji: '🔔', label: 'Notification preferences', action: () => showNotice('Notifications — coming soon') },
            { emoji: '🔒', label: 'Privacy settings', action: () => showNotice('Privacy settings — coming soon') },
          ].map((item) => (
            <button key={item.label} onClick={item.action} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '15px 18px',
              background: 'none', border: 'none', borderTop: '1px solid var(--line-2)', cursor: 'pointer', textAlign: 'left',
            }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{item.emoji}</div>
              <span style={{ fontSize: 14, color: 'var(--ink)', flex: 1, fontWeight: 500 }}>{item.label}</span>
              <span style={{ fontSize: 18, color: 'var(--ink-3)' }}>›</span>
            </button>
          ))}
        </div>

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
        <div style={{ position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)', zIndex: 150, background: 'var(--ai-card-1)', color: '#fff', fontSize: 13, fontWeight: 600, padding: '10px 18px', borderRadius: 999 }}>
          {notice}
        </div>
      )}

      {/* ── EDIT NAME MODAL ── */}
      {editingName && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px', background: 'rgba(0,0,0,0.5)' }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 24, padding: 24, width: '100%', maxWidth: 360 }}>
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

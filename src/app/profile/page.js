'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMsal } from '@azure/msal-react';
import Image from 'next/image';

const API_URL = 'https://gymdogs-api-g9d0gve4angygdcj.newzealandnorth-01.azurewebsites.net/api/gymLogs';
const PROFILES_URL = 'https://gymdogs-api-g9d0gve4angygdcj.newzealandnorth-01.azurewebsites.net/api/userProfiles';
const API_KEY = process.env.NEXT_PUBLIC_API_KEY;
const PROFILES_KEY = process.env.NEXT_PUBLIC_PROFILES_API_KEY;

const emptyStats = { weight: '', height: '', age: '', bodyFat: '' };
const mockGoals = [
  { label: 'Build Muscle',      icon: '/images/Onboard_icon_build_muscle.png' },
  { label: 'Improve Strength',  icon: '/images/Onboard_icon_get_stronger.png' },
  { label: 'Lose Body Fat',     icon: '/images/Onboard_icon_lose_fat.png' },
];

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
          if (!maxByExercise[log.exName] || kg > maxByExercise[log.exName]) {
            maxByExercise[log.exName] = kg;
          }
        }
      });
    } catch (e) {}
  });
  return Object.keys(maxByExercise).length;
}

function calcTotalSessions(logs) {
  return new Set(logs.map(l => l.date).filter(Boolean)).size;
}

function getJoinDate() {
  const now = new Date();
  return now.toLocaleDateString('en-NZ', { month: 'long', year: 'numeric' });
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

  useEffect(() => {
    if (inProgress === 'startup') return;
    if (accounts.length === 0) { router.push('/login'); return; }
    const user = accounts[0];
    const uid = user.localAccountId;
    setUserId(uid);
    setUserEmail(user.username || '');
    setJoinDate(getJoinDate());

    const entraName = user.name && user.name !== 'unknown'
      ? user.name
      : user.username?.split('@')[0] || 'Athlete';
    setUserName(entraName);
    setUserInitials(entraName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2));

    const fetchProfile = async () => {
      try {
        const res = await fetch(`${PROFILES_URL}?userId=${uid}`, {
          headers: { 'x-functions-key': PROFILES_KEY }
        });
        if (res.ok) {
          const data = await res.json();
          const profile = Array.isArray(data) ? data[0] : null;
          if (profile) {
            setProfileRef(profile);
            if (profile.name && profile.name !== uid) {
              setUserName(profile.name);
              setUserInitials(profile.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2));
            }
            const savedStats = {
              weight: profile.weight || '',
              height: profile.height || '',
              age: profile.age || '',
              bodyFat: profile.bodyFat || '',
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
        const res = await fetch(`${API_URL}?userId=${userId}`, {
          headers: { 'x-functions-key': API_KEY }
        });
        if (res.ok) setLogs(await res.json());
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

  const ACHIEVEMENTS = [
    { icon: '/images/icon_fire.png',        label: '14-Day Streak', sub: 'Keep going!',  earned: streak >= 14,            color: '#f97316' },
    { icon: '/images/icon_workout.png',     label: 'First PR',      sub: 'Unlocked',     earned: prCount >= 1,            color: '#facc15' },
    { icon: '/images/icon_trophy.png',      label: '5 PRs Set',     sub: 'Nice work!',   earned: prCount >= 5,            color: '#a78bfa' },
  ];

  const BODY_STATS = [
    { key: 'weight',  label: 'Weight',   unit: 'kg',    icon: '/images/icon_weight.png' },
    { key: 'height',  label: 'Height',   unit: 'cm',    icon: '/images/icon_height.png' },
    { key: 'age',     label: 'Age',      unit: 'years', icon: '/images/icon_age.png' },
    { key: 'bodyFat', label: 'Body Fat', unit: '%',     icon: '/images/icon_bodyfat.png' },
  ];

  return (
    <div style={{
      minHeight: '100vh',
      background: '#09090F',
      color: '#ffffff',
      fontFamily: 'system-ui, sans-serif',
      paddingBottom: '100px',
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
          <p style={{ fontSize: '11px', color: '#6b7280', letterSpacing: '2px', margin: '0 0 4px' }}>YOUR ACCOUNT</p>
          <h1 style={{ fontSize: '32px', fontWeight: 900, margin: 0 }}>PROFILE</h1>
        </div>
        <div style={{
          width: '48px', height: '48px', borderRadius: '50%',
          background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '16px', fontWeight: 800, flexShrink: 0,
        }}>
          {userInitials}
        </div>
      </div>

      {/* ── USER CARD ── */}
      <div style={{ padding: '0 20px 16px' }}>
        <div style={{
          background: '#13131A',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '20px',
          padding: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
        }}>
          {/* Big avatar */}
          <div style={{
            width: '72px', height: '72px', borderRadius: '16px',
            background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '26px', fontWeight: 800, flexShrink: 0,
          }}>
            {userInitials}
          </div>

          {/* Name + email */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '18px', fontWeight: 900, margin: '0 0 4px', letterSpacing: '0.5px' }}>
              {userName.toUpperCase()}
            </p>
            <p style={{ fontSize: '12px', color: '#9ca3af', margin: '0 0 4px' }}>{userEmail}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '11px' }}>📅</span>
              <p style={{ fontSize: '11px', color: '#6b7280', margin: 0 }}>Member since {joinDate}</p>
            </div>
          </div>

          {/* Edit Profile button */}
          <button
            onClick={() => { setTempName(userName); setEditingName(true); }}
            style={{
              background: 'none',
              border: '1.5px solid rgba(124,58,237,0.5)',
              borderRadius: '10px',
              padding: '8px 12px',
              color: '#a78bfa',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              flexShrink: 0,
            }}
          >
            ✏️ Edit Profile
          </button>
        </div>
      </div>

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* ── 3 STAT CARDS ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
          {[
            { icon: '/images/icon_workout.png', value: statsLoading ? '...' : totalSessions, label: 'WORKOUTS',  sub: 'TOTAL',      color: '#34d399' },
            { icon: '/images/icon_fire.png',    value: statsLoading ? '...' : streak,        label: 'DAY STREAK',sub: 'KEEP IT UP!', color: '#f97316' },
            { icon: '/images/icon_trophy.png',  value: statsLoading ? '...' : prCount,       label: 'PRS SET',  sub: 'ALL TIME',   color: '#a78bfa' },
          ].map((stat, i) => (
            <div key={i} style={{
              background: '#13131A',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '16px',
              padding: '14px 10px',
              textAlign: 'center',
            }}>
              <Image src={stat.icon} alt={stat.label} width={28} height={28} style={{ objectFit: 'contain', margin: '0 auto 8px' }} />
              <p style={{ fontSize: '26px', fontWeight: 900, color: stat.color, margin: '0 0 2px', lineHeight: 1 }}>{stat.value}</p>
              <p style={{ fontSize: '9px', color: '#9ca3af', margin: '0 0 2px', letterSpacing: '0.5px' }}>{stat.label}</p>
              <p style={{ fontSize: '9px', color: '#4b5563', margin: 0, letterSpacing: '0.5px' }}>{stat.sub}</p>
            </div>
          ))}
        </div>

        {/* ── BODY STATS ── */}
        <div style={{
          background: '#13131A',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '20px',
          overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '16px 16px 12px',
          }}>
            <p style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '1px', margin: 0 }}>BODY STATS</p>
            {!editingStats ? (
              <button
                onClick={() => { setTempStats(stats); setEditingStats(true); }}
                style={{ background: 'none', border: 'none', color: '#a78bfa', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                Edit ›
              </button>
            ) : (
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => { setTempStats(stats); setEditingStats(false); }} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleSaveStats} disabled={savingStats} style={{ background: 'none', border: 'none', color: '#a78bfa', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                  {savingStats ? 'Saving...' : statsSaved ? '✓ Saved' : 'Save'}
                </button>
              </div>
            )}
          </div>

          {BODY_STATS.map((item, i) => (
            <div key={item.key} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              padding: '14px 16px',
              borderTop: '1px solid rgba(255,255,255,0.05)',
            }}>
              <div style={{
                width: '36px', height: '36px',
                borderRadius: '10px',
                background: 'rgba(124,58,237,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Image src={item.icon} alt={item.label} width={20} height={20} style={{ objectFit: 'contain' }} />
              </div>
              <p style={{ fontSize: '14px', fontWeight: 600, margin: 0, flex: 1 }}>{item.label}</p>
              {editingStats ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input
                    type="number"
                    value={tempStats[item.key]}
                    onChange={e => setTempStats(prev => ({ ...prev, [item.key]: e.target.value }))}
                    style={{
                      width: '70px',
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(124,58,237,0.5)',
                      borderRadius: '8px',
                      padding: '6px 8px',
                      color: '#ffffff',
                      fontSize: '14px',
                      fontWeight: 700,
                      textAlign: 'right',
                      outline: 'none',
                    }}
                  />
                  <span style={{ fontSize: '12px', color: '#6b7280' }}>{item.unit}</span>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <p style={{ fontSize: '15px', fontWeight: 800, color: stats[item.key] ? '#ffffff' : '#4b5563', margin: 0 }}>
                    {stats[item.key] || '— —'}
                  </p>
                  <span style={{ fontSize: '12px', color: '#6b7280' }}>{stats[item.key] ? item.unit : ''}</span>
                  <span style={{ fontSize: '16px', color: '#4b5563' }}>›</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ── MY GOALS ── */}
        <div style={{
          background: '#13131A',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '20px',
          padding: '16px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <p style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '1px', margin: 0 }}>MY GOALS</p>
            <button style={{ background: 'none', border: 'none', color: '#a78bfa', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>Manage</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {mockGoals.map((goal, i) => (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(124,58,237,0.15)',
                border: '1.5px solid rgba(124,58,237,0.35)',
                borderRadius: '99px',
                padding: '8px 14px',
              }}>
                <Image src={goal.icon} alt={goal.label} width={18} height={18} style={{ objectFit: 'contain' }} />
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#a78bfa', letterSpacing: '0.5px' }}>{goal.label.toUpperCase()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── ACHIEVEMENTS ── */}
        <div style={{
          background: '#13131A',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '20px',
          padding: '16px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <p style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '1px', margin: 0 }}>ACHIEVEMENTS</p>
            <button style={{ background: 'none', border: 'none', color: '#a78bfa', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>View all ›</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            {ACHIEVEMENTS.map((a, i) => (
              <div key={i} style={{
                background: a.earned ? `${a.color}15` : 'rgba(255,255,255,0.03)',
                border: `1.5px solid ${a.earned ? `${a.color}40` : 'rgba(255,255,255,0.06)'}`,
                borderRadius: '16px',
                padding: '14px 10px',
                textAlign: 'center',
                opacity: a.earned ? 1 : 0.4,
              }}>
                <Image src={a.icon} alt={a.label} width={40} height={40} style={{ objectFit: 'contain', margin: '0 auto 8px', display: 'block' }} />
                <p style={{ fontSize: '11px', fontWeight: 700, color: a.earned ? '#ffffff' : '#6b7280', margin: '0 0 4px', lineHeight: 1.3 }}>{a.label}</p>
                <p style={{ fontSize: '10px', color: a.earned ? a.color : '#4b5563', margin: 0, fontWeight: 600 }}>{a.sub}</p>
                {/* Progress bar */}
                <div style={{ height: '2px', background: 'rgba(255,255,255,0.08)', borderRadius: '99px', marginTop: '8px' }}>
                  {a.earned && <div style={{ height: '100%', width: '100%', background: a.color, borderRadius: '99px' }} />}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── ACCOUNT SETTINGS ── */}
        <div style={{
          background: '#13131A',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '20px',
          overflow: 'hidden',
        }}>
          <p style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '1px', margin: '0', padding: '16px 16px 12px' }}>ACCOUNT</p>
          {[
            { icon: '/images/icon_profile_nav.png', label: 'Edit Display Name',        action: () => { setTempName(userName); setEditingName(true); } },
            { icon: '/images/icon_bell.png',         label: 'Notification Preferences', action: () => {} },
            { icon: '/images/icon_focus.png',        label: 'Privacy Settings',         action: () => {} },
          ].map((item, i, arr) => (
            <button
              key={item.label}
              onClick={item.action}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '14px 16px',
                background: 'none',
                border: 'none',
                borderTop: '1px solid rgba(255,255,255,0.05)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div style={{
                width: '36px', height: '36px',
                borderRadius: '10px',
                background: 'rgba(124,58,237,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Image src={item.icon} alt={item.label} width={20} height={20} style={{ objectFit: 'contain' }} />
              </div>
              <span style={{ fontSize: '14px', color: '#e5e7eb', flex: 1, fontWeight: 500 }}>{item.label}</span>
              <span style={{ fontSize: '18px', color: '#4b5563' }}>›</span>
            </button>
          ))}
        </div>

        {/* ── SIGN OUT ── */}
        <button
          onClick={handleSignOut}
          style={{
            width: '100%',
            background: 'rgba(239,68,68,0.1)',
            border: '1.5px solid rgba(239,68,68,0.3)',
            borderRadius: '16px',
            padding: '18px',
            color: '#f87171',
            fontSize: '14px',
            fontWeight: 800,
            letterSpacing: '2px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
          }}
        >
          <Image src="/images/icon_signout.png" alt="sign out" width={20} height={20} style={{ objectFit: 'contain' }} />
          SIGN OUT
        </button>

      </div>

      {/* ── BOTTOM NAV ── */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#0d0d14', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', zIndex: 100, paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {[
          { label: 'Home',      icon: '/images/icon_home.png',         href: '/dashboard', active: false },
          { label: 'Train',     icon: '/images/icon_workout.png',      href: '/workout',   active: false },
          { label: 'Progress',  icon: '/images/icon_progress2.png',    href: '/progress',  active: false },
          { label: 'Community', icon: '/images/icon_community.png',    href: '/community', active: false },
          { label: 'Profile',   icon: '/images/icon_profile_nav.png',  href: '/profile',   active: true  },
        ].map((item) => (
          <button key={item.label} onClick={() => router.push(item.href)} style={{ flex: 1, background: 'transparent', border: 'none', cursor: 'pointer', padding: '10px 0 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <img src={item.icon} alt={item.label} style={{ width: 24, height: 24, opacity: item.active ? 1 : 0.4, objectFit: 'contain' }} onError={(e) => { e.target.style.display='none'; }} />
            <span style={{ fontSize: 10, fontWeight: item.active ? 700 : 400, color: item.active ? '#a78bfa' : '#6b7280' }}>{item.label}</span>
            {item.active && <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#a78bfa' }} />}
          </button>
        ))}
      </div>

      {/* ── EDIT NAME MODAL ── */}
      {editingName && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 24px',
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(8px)',
        }}>
          <div style={{
            background: '#13131A',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '24px',
            padding: '24px',
            width: '100%',
            maxWidth: '360px',
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: 900, margin: '0 0 6px', letterSpacing: '1px' }}>DISPLAY NAME</h3>
            <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 20px' }}>This is how you'll appear in the app and on the leaderboard</p>
            <input
              type="text"
              value={tempName}
              onChange={e => setTempName(e.target.value)}
              placeholder="e.g. Shameel or Shameel T"
              autoFocus
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(124,58,237,0.4)',
                borderRadius: '12px',
                padding: '14px 16px',
                color: '#ffffff',
                fontSize: '15px',
                outline: 'none',
                marginBottom: '16px',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setEditingName(false)}
                style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', background: 'none', color: '#9ca3af', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
              >CANCEL</button>
              <button
                onClick={handleSaveName}
                disabled={savingName || !tempName.trim()}
                style={{ flex: 1, padding: '14px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', color: '#ffffff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', opacity: savingName || !tempName.trim() ? 0.5 : 1 }}
              >{savingName ? 'SAVING...' : 'SAVE'}</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
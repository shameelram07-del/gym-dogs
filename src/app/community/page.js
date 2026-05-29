'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import BottomNav from '@/components/BottomNav';

// ─── DUMMY DATA (replace with real CosmosDB data later) ───────────────────────

const LEADERBOARD = [
  { name: 'Joel',    initial: 'J', sessions: 5, color: '#7c3aed', me: false },
  { name: 'Shameel', initial: 'S', sessions: 4, color: '#6d28d9', me: true  },
  { name: 'Hamish',  initial: 'H', sessions: 3, color: '#5b21b6', me: false },
];

const FEED = [
  {
    id: 1,
    name: 'Joel',
    initial: 'J',
    color: '#7c3aed',
    isPro: true,
    time: '2h ago',
    tag: 'Bench Press PR',
    text: 'Hit a new PR today! 122.5kg for 5 reps 💪 Consistency is everything.',
    fires: 24,
    comments: 12,
  },
  {
    id: 2,
    name: 'Hamish',
    initial: 'H',
    color: '#5b21b6',
    isPro: false,
    time: '1h ago',
    tag: 'Leg Day',
    text: 'Nothing beats a heavy leg day. Quads are on fire! 🔥',
    fires: 18,
    comments: 8,
  },
  {
    id: 3,
    name: 'Zafi',
    initial: 'Z',
    color: '#4c1d95',
    isPro: false,
    time: '3h ago',
    tag: 'Morning Session',
    text: '6am session done. No excuses, no skipping. Who else trains early?',
    fires: 31,
    comments: 5,
  },
];

const MEDAL_ICONS = [
  '/images/icon_medal_gold.png',
  '/images/icon_medal_silver.png',
  '/images/icon_medal_bronze.png',
];

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function CommunityPage() {
  const router = useRouter();
  const [joined, setJoined] = useState(false);
  const [firedPosts, setFiredPosts] = useState({});

  function toggleFire(id) {
    setFiredPosts(prev => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#09090F',
      color: '#ffffff',
      paddingBottom: '100px',
      fontFamily: 'system-ui, sans-serif',
    }}>

      {/* ── HEADER ── */}
      <div style={{
        padding: '52px 20px 16px',
        background: 'linear-gradient(180deg, rgba(124,58,237,0.12) 0%, transparent 100%)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
      }}>
        <div>
          <p style={{ fontSize: '11px', color: '#6b7280', letterSpacing: '2px', margin: '0 0 4px' }}>GOOD MORNING</p>
          <h1 style={{ fontSize: '30px', fontWeight: 900, margin: 0, lineHeight: 1.1 }}>
            SHAMEEL <span style={{ fontSize: '26px' }}>💪</span>
          </h1>
        </div>
        <button
          onClick={() => router.push('/profile')}
          style={{
            width: '44px', height: '44px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
            border: 'none',
            color: '#ffffff',
            fontSize: '14px',
            fontWeight: 800,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >ST</button>
      </div>

      {/* ── READINESS BANNER ── */}
      <div style={{ padding: '0 20px 16px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          background: '#13131A',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '16px',
          padding: '14px 16px',
        }}>
          <p style={{ fontSize: '32px', fontWeight: 900, color: '#34d399', margin: 0, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>87</p>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 2px' }}>Ready to Train</p>
            <p style={{ fontSize: '10px', color: '#6b7280', letterSpacing: '1.5px', margin: 0 }}>READINESS SCORE</p>
          </div>
          <span style={{ fontSize: '28px' }}>🏃</span>
          <span style={{ color: '#6b7280', fontSize: '18px' }}>›</span>
        </div>
      </div>

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* ── COMMUNITY HEADING ── */}
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 900, margin: '0 0 4px', letterSpacing: '1px' }}>COMMUNITY</h2>
          <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>Compete. Connect. Get Stronger.</p>
        </div>

        {/* ── WEEKLY CHALLENGE CARD ── */}
        <div style={{
          background: 'linear-gradient(135deg, #1a0a3a, #2d1060)',
          border: '1px solid rgba(124,58,237,0.4)',
          borderRadius: '20px',
          padding: '20px',
          overflow: 'hidden',
          position: 'relative',
        }}>
          {/* Top row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <p style={{ fontSize: '11px', color: '#a78bfa', fontWeight: 700, letterSpacing: '1.5px', margin: 0 }}>WEEKLY CHALLENGE</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Image src="/images/icon_timer.png" alt="timer" width={14} height={14} style={{ objectFit: 'contain' }} />
              <p style={{ fontSize: '11px', color: '#9ca3af', margin: 0 }}>5 DAYS LEFT</p>
            </div>
          </div>

          {/* Content row — text left, mascot right */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: '30px', fontWeight: 900, margin: '0 0 10px', lineHeight: 1.1, letterSpacing: '-0.5px' }}>
                PUSH THE<br />BENCH
              </h3>
              <p style={{ fontSize: '13px', color: '#9ca3af', margin: '0 0 14px', lineHeight: 1.5 }}>
                Add 2.5kg to your best bench press this week.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px' }}>
                <span style={{ fontSize: '16px' }}>👥</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>1,245</span>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>JOINING</span>
              </div>
              <button
                onClick={() => setJoined(j => !j)}
                style={{
                  background: joined ? 'rgba(124,58,237,0.3)' : 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                  border: joined ? '1.5px solid #7c3aed' : 'none',
                  borderRadius: '99px',
                  padding: '12px 22px',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 800,
                  letterSpacing: '1px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {joined ? '✓ JOINED' : 'JOIN CHALLENGE ›'}
              </button>
            </div>

            {/* Mascot */}
            <div style={{ flexShrink: 0 }}>
              <Image
                src="/images/gymdogs_logo.png"
                alt="GymDogs"
                width={120}
                height={140}
                style={{ objectFit: 'contain' }}
              />
            </div>
          </div>
        </div>

        {/* ── LEADERBOARD ── */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <p style={{ fontSize: '14px', fontWeight: 800, letterSpacing: '1px', margin: 0 }}>THIS WEEK'S LEADERBOARD</p>
            <button style={{ fontSize: '12px', color: '#7c3aed', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 700 }}>
              VIEW ALL ›
            </button>
          </div>

          <div style={{
            background: '#13131A',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '20px',
            overflow: 'hidden',
          }}>
            {LEADERBOARD.map((user, i) => (
              <div key={user.name} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '14px 16px',
                background: user.me ? 'rgba(124,58,237,0.08)' : 'transparent',
                borderBottom: i < LEADERBOARD.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
              }}>
                {/* Medal */}
                <Image src={MEDAL_ICONS[i]} alt={`rank ${i+1}`} width={32} height={32} style={{ objectFit: 'contain', flexShrink: 0 }} />

                {/* Avatar */}
                <div style={{
                  width: '38px', height: '38px',
                  borderRadius: '50%',
                  background: user.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '15px', fontWeight: 800,
                  flexShrink: 0,
                }}>
                  {user.initial}
                </div>

                {/* Name */}
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '15px', fontWeight: 700 }}>{user.name}</span>
                  {user.me && (
                    <span style={{ fontSize: '12px', color: '#a78bfa', marginLeft: '6px' }}>(you)</span>
                  )}
                </div>

                {/* Sessions */}
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '22px', fontWeight: 900, color: '#ffffff' }}>{user.sessions}</span>
                  <span style={{ fontSize: '11px', color: '#6b7280', marginLeft: '4px', letterSpacing: '0.5px' }}>SESSIONS</span>
                </div>
              </div>
            ))}

            {/* Motivational note */}
            <div style={{
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              borderTop: '1px solid rgba(255,255,255,0.05)',
            }}>
              <Image src="/images/icon_trophy.png" alt="trophy" width={18} height={18} style={{ objectFit: 'contain' }} />
              <p style={{ fontSize: '12px', color: '#a78bfa', margin: 0, fontWeight: 600 }}>Keep it up! You're killing it.</p>
            </div>
          </div>
        </div>

        {/* ── COMMUNITY FEED ── */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <p style={{ fontSize: '14px', fontWeight: 800, letterSpacing: '1px', margin: 0 }}>COMMUNITY FEED</p>
            <button style={{ fontSize: '12px', color: '#7c3aed', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 700 }}>
              SEE ALL ›
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {FEED.map(post => (
              <div key={post.id} style={{
                background: '#13131A',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '20px',
                padding: '16px',
              }}>
                {/* Top row — avatar, name, photo placeholder */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  {/* Avatar */}
                  <div style={{
                    width: '40px', height: '40px',
                    borderRadius: '50%',
                    background: post.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '16px', fontWeight: 800,
                    flexShrink: 0,
                  }}>
                    {post.initial}
                  </div>

                  {/* Name + meta */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '14px', fontWeight: 700 }}>{post.name}</span>
                      {post.isPro && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Image src="/images/icon_pro_badge.png" alt="PRO" width={40} height={20} style={{ objectFit: 'contain' }} />
                        </div>
                      )}
                    </div>
                    <p style={{ fontSize: '11px', color: '#6b7280', margin: '3px 0 0' }}>
                      {post.time} · {post.tag}
                    </p>
                  </div>

                  {/* Photo placeholder */}
                  <div style={{
                    width: '64px', height: '64px',
                    borderRadius: '12px',
                    background: 'rgba(124,58,237,0.15)',
                    border: '1px solid rgba(124,58,237,0.2)',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '22px',
                  }}>
                    🏋️
                  </div>
                </div>

                {/* Post text */}
                <p style={{ fontSize: '14px', color: '#e5e7eb', lineHeight: 1.5, margin: '12px 0' }}>
                  {post.text}
                </p>

                {/* Reactions row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  {/* Fire reaction */}
                  <button
                    onClick={() => toggleFire(post.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    }}
                  >
                    <Image src="/images/icon_fire.png" alt="fire" width={20} height={20} style={{ objectFit: 'contain', opacity: firedPosts[post.id] ? 1 : 0.6 }} />
                    <span style={{ fontSize: '13px', color: firedPosts[post.id] ? '#f97316' : '#6b7280', fontWeight: 600 }}>
                      {firedPosts[post.id] ? post.fires + 1 : post.fires}
                    </span>
                  </button>

                  {/* Comment */}
                  <button style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  }}>
                    <Image src="/images/icon_comment.png" alt="comment" width={20} height={20} style={{ objectFit: 'contain', opacity: 0.6 }} />
                    <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: 600 }}>{post.comments}</span>
                  </button>

                  {/* More */}
                  <button style={{
                    marginLeft: 'auto',
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    color: '#6b7280', fontSize: '18px', letterSpacing: '2px',
                  }}>···</button>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      <BottomNav />
    </div>
  );
}
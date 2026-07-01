'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import BottomNav from '@/components/BottomNav';

// Placeholder data — swap for real CosmosDB data once the social feed is built.
const LEADERBOARD = [
  { name: 'Joel',    initial: 'J', kg: '12.1k', me: false },
  { name: 'Shameel', initial: 'S', kg: '9.8k',  me: true  },
  { name: 'Hamish',  initial: 'H', kg: '8.4k',  me: false },
  { name: 'Zafi',    initial: 'Z', kg: '6.2k',  me: false },
];

const MEDAL = ['#F7B500', '#B0B7C3', '#CD7F32'];

const FEED = [
  { id: 1, name: 'Joel',   initial: 'J', time: '2h ago', tag: 'Bench PR', text: 'Hit a new PR today — 122.5kg for 5 reps. Consistency is everything.', fires: 24, comments: 12 },
  { id: 2, name: 'Hamish', initial: 'H', time: '1h ago', tag: 'Leg day', text: 'Nothing beats a heavy leg day. Quads are on fire.', fires: 18, comments: 8 },
  { id: 3, name: 'Zafi',   initial: 'Z', time: '3h ago', tag: 'Early session', text: '6am session done. No excuses, no skipping. Who else trains early?', fires: 31, comments: 5 },
];

const eyebrow = { fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', color: 'var(--ink-3)', textTransform: 'uppercase', margin: 0 };
const cardStyle = { background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 22, padding: 18 };

function Avatar({ initial, size = 38 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg, var(--violet), var(--blue))',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.4, fontWeight: 700, color: '#fff', flexShrink: 0,
    }}>{initial}</div>
  );
}

export default function CommunityPage() {
  const router = useRouter();
  const [joined, setJoined] = useState(false);
  const [firedPosts, setFiredPosts] = useState({});
  const [notice, setNotice] = useState('');

  const toggleFire = (id) => setFiredPosts(prev => ({ ...prev, [id]: !prev[id] }));
  const showNotice = (msg) => { setNotice(msg); setTimeout(() => setNotice(''), 1800); };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)', paddingBottom: 100 }}>

      {/* ── HEADER ── */}
      <div style={{ padding: '52px 20px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>Community</h1>
          <p style={{ margin: '2px 0 0', fontSize: 14, color: 'var(--ink-2)' }}>Gym Dogs · 5 members</p>
        </div>
        <button onClick={() => router.push('/profile')} aria-label="Profile" style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}>
          <Avatar initial="ST" size={42} />
        </button>
      </div>

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── CHALLENGE ── */}
        <div style={{ background: 'linear-gradient(135deg, var(--violet), var(--blue))', borderRadius: 22, padding: 18, color: '#fff' }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', opacity: 0.85 }}>WEEKLY CHALLENGE</p>
          <p style={{ margin: '6px 0 4px', fontSize: 20, fontWeight: 800 }}>10,000 kg club</p>
          <p style={{ margin: '0 0 14px', fontSize: 13, opacity: 0.9 }}>Lift 10 tonnes this week · 1,245 joining · 5 days left</p>
          <button onClick={() => setJoined(j => !j)} style={{
            background: joined ? 'rgba(255,255,255,0.18)' : '#fff',
            color: joined ? '#fff' : '#3A1D9E', border: 'none', borderRadius: 14,
            padding: '12px 22px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}>
            {joined ? '✓ Joined' : 'Join challenge'}
          </button>
        </div>

        {/* ── LEADERBOARD ── */}
        <div style={cardStyle}>
          <p style={{ ...eyebrow, marginBottom: 6 }}>Leaderboard</p>
          {LEADERBOARD.map((u, i) => (
            <div key={u.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderTop: i === 0 ? 'none' : '1px solid var(--line-2)' }}>
              {i < 3 ? (
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: MEDAL[i], color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, flexShrink: 0 }}>{i + 1}</div>
              ) : (
                <div style={{ width: 26, textAlign: 'center', fontWeight: 800, color: 'var(--ink-3)', fontSize: 14 }}>{i + 1}</div>
              )}
              <Avatar initial={u.initial} size={34} />
              <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: u.me ? 'var(--accent-strong)' : 'var(--ink)' }}>
                {u.name}{u.me ? ' (you)' : ''}
              </span>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-2)' }}>{u.kg} kg</span>
            </div>
          ))}
        </div>

        {/* ── FEED ── */}
        <div>
          <p style={{ ...eyebrow, marginLeft: 4, marginBottom: 10 }}>Feed</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {FEED.map(post => {
              const fired = firedPosts[post.id];
              return (
                <div key={post.id} style={cardStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 10 }}>
                    <Avatar initial={post.initial} size={38} />
                    <div>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{post.name}</p>
                      <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-3)' }}>{post.time} · {post.tag}</p>
                    </div>
                  </div>
                  <p style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--ink)', lineHeight: 1.5 }}>{post.text}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                    <button onClick={() => toggleFire(post.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: fired ? 'var(--orange)' : 'var(--ink-2)', fontSize: 13, fontWeight: 600 }}>
                      🔥 {fired ? post.fires + 1 : post.fires}
                    </button>
                    <button onClick={() => showNotice('Comments — coming soon')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--ink-2)', fontSize: 13, fontWeight: 600 }}>
                      💬 {post.comments}
                    </button>
                    <button onClick={() => showNotice('More — coming soon')} aria-label="More" style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--ink-3)', fontSize: 18, letterSpacing: 2 }}>···</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {notice && (
        <div style={{ position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)', zIndex: 150, background: 'var(--ai-card-1)', color: '#fff', fontSize: 13, fontWeight: 600, padding: '10px 18px', borderRadius: 999 }}>
          {notice}
        </div>
      )}

      <BottomNav />
    </div>
  );
}

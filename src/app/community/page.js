'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMsal } from '@azure/msal-react';
import BottomNav from '@/components/BottomNav';
import Reveal from '@/components/Reveal';

const API = 'https://gymdogs-api-g9d0gve4angygdcj.newzealandnorth-01.azurewebsites.net/api';
const KEY = process.env.NEXT_PUBLIC_API_KEY;
const PROFILES_KEY = process.env.NEXT_PUBLIC_PROFILES_API_KEY;

const MEDAL = ['#F7B500', '#B0B7C3', '#CD7F32'];

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

function timeAgo(iso) {
  if (!iso) return '';
  const mins = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

function fmtKg(kg) {
  return kg >= 1000 ? `${(kg / 1000).toFixed(1)}k` : `${kg}`;
}

const isGuid = (s) => !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim());

export default function CommunityPage() {
  const router = useRouter();
  const { accounts, inProgress } = useMsal();
  const [userId, setUserId] = useState(null);
  const [userName, setUserName] = useState('Athlete');
  const [userInitials, setUserInitials] = useState('A');
  const [posts, setPosts] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [lbScope, setLbScope] = useState('7d');
  const [challenge, setChallenge] = useState(null);
  const [joining, setJoining] = useState(false);
  const [members, setMembers] = useState(null);
  const [loading, setLoading] = useState(true);
  const [composeText, setComposeText] = useState('');
  const [posting, setPosting] = useState(false);
  const [commentOn, setCommentOn] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [notice, setNotice] = useState('');

  const showNotice = (msg) => { setNotice(msg); setTimeout(() => setNotice(''), 1800); };

  useEffect(() => {
    if (inProgress !== 'none') return;
    if (accounts.length === 0) { router.push('/login'); return; }
    const user = accounts[0];
    const uid = user.localAccountId;
    setUserId(uid);

    const fallback = user.name && user.name !== 'unknown' && !isGuid(user.name)
      ? user.name
      : user.username?.split('@')[0] || 'Athlete';
    setUserName(fallback);
    setUserInitials(fallback.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2));

    // Prefer the saved profile name for posting
    (async () => {
      try {
        const res = await fetch(`${API}/userProfiles?userId=${uid}`, { headers: { 'x-functions-key': PROFILES_KEY || KEY || '' } });
        if (res.ok) {
          const data = await res.json();
          const p = Array.isArray(data) ? data.find(x => x.userId === uid) : data;
          if (p && p.name && !isGuid(p.name)) {
            setUserName(p.name);
            setUserInitials((p.initials || p.name.substring(0, 2)).toUpperCase());
          }
        }
      } catch (e) {}
    })();

    loadFeed();
  }, [accounts, inProgress, router]);

  async function loadFeed() {
    try {
      const res = await fetch(`${API}/communityPosts`, { headers: { 'x-functions-key': KEY || '' } });
      if (res.ok) {
        const data = await res.json();
        setPosts(Array.isArray(data.posts) ? data.posts : []);
        setLeaderboard(Array.isArray(data.leaderboard) ? data.leaderboard : []);
        setLbScope(data.leaderboardScope || '7d');
        if (data.challenge) setChallenge(data.challenge);
        if (typeof data.members === 'number') setMembers(data.members);
      }
    } catch (e) {}
    finally { setLoading(false); }
  }

  async function submitPost() {
    const text = composeText.trim();
    if (!text || posting) return;
    setPosting(true);
    try {
      const res = await fetch(`${API}/communityPosts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-functions-key': KEY || '' },
        body: JSON.stringify({ userId, name: userName, initials: userInitials, text }),
      });
      if (res.ok) {
        const post = await res.json();
        setPosts(prev => [post, ...prev]);
        setComposeText('');
      } else {
        showNotice('Could not post — try again');
      }
    } catch (e) { showNotice('Could not post — try again'); }
    finally { setPosting(false); }
  }

  async function toggleFire(post) {
    // optimistic update
    setPosts(prev => prev.map(p => {
      if (p.id !== post.id) return p;
      const fired = (p.firedBy || []).includes(userId);
      return { ...p, firedBy: fired ? p.firedBy.filter(u => u !== userId) : [...(p.firedBy || []), userId] };
    }));
    try {
      const res = await fetch(`${API}/communityPosts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-functions-key': KEY || '' },
        body: JSON.stringify({ action: 'fire', postId: post.id, userId }),
      });
      if (!res.ok) throw new Error(`fire failed (${res.status})`);
    } catch (e) {
      // The tap already moved on screen — put the feed back the way the server
      // has it rather than leaving a reaction that was never recorded.
      showNotice('Could not react — try again');
      loadFeed();
    }
  }

  async function sendComment(post) {
    const text = commentText.trim();
    if (!text) return;
    const comment = { userId, name: userName, text, createdAt: new Date().toISOString() };
    setPosts(prev => prev.map(p => p.id === post.id
      ? { ...p, commentsList: [...(p.commentsList || []), comment] }
      : p));
    setCommentText('');
    try {
      const res = await fetch(`${API}/communityPosts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-functions-key': KEY || '' },
        body: JSON.stringify({ action: 'comment', postId: post.id, userId, name: userName, text }),
      });
      if (!res.ok) throw new Error(`comment failed (${res.status})`);
    } catch (e) {
      // Take the optimistic comment back out and hand the text back, so it
      // isn't lost to a comment that only ever existed on this screen.
      setPosts(prev => prev.map(p => p.id === post.id
        ? { ...p, commentsList: (p.commentsList || []).filter(c => c !== comment) }
        : p));
      setCommentText(text);
      showNotice('Could not comment — try again');
    }
  }

  async function joinChallenge() {
    if (joining || !challenge) return;
    setJoining(true);
    try {
      const res = await fetch(`${API}/communityPosts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-functions-key': KEY || '' },
        body: JSON.stringify({ action: 'joinChallenge', userId }),
      });
      if (res.ok) loadFeed();
    } catch (e) {}
    finally { setJoining(false); }
  }

  if (!userId) return null;

  const myRank = leaderboard.findIndex(u => u.userId === userId);

  // Challenge derived values
  const chJoined = challenge?.joinedBy?.includes(userId);
  const chMine = challenge?.progress?.find(p => p.userId === userId);
  const chMyKg = chMine?.kg || 0;
  const chPct = challenge ? Math.min((chMyKg / challenge.targetKg) * 100, 100) : 0;
  const chDaysLeft = challenge
    ? Math.max(Math.ceil((new Date(challenge.endDate) - new Date()) / 86400000), 0)
    : 0;
  const chLeader = challenge?.progress?.[0];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)', paddingBottom: 100 }}>

      {/* ── HEADER ── */}
      <div style={{ padding: '52px 20px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>Community</h1>
          <p style={{ margin: '2px 0 0', fontSize: 14, color: 'var(--ink-2)' }}>
            Gym Dogs{members ? ` · ${members} member${members === 1 ? '' : 's'}` : ''}
          </p>
        </div>
        <button onClick={() => router.push('/profile')} aria-label="Profile" style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}>
          <Avatar initial={userInitials} size={42} />
        </button>
      </div>

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── CHALLENGE (real) ── */}
        {challenge && (
          <Reveal>
          <div className="gd-shine" style={{
            background: 'linear-gradient(180deg, var(--card-2), var(--card))',
            border: '1px solid var(--gold-tint)', borderRadius: 22, padding: 18,
            boxShadow: 'var(--shadow-card)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', color: 'var(--gold)', textTransform: 'uppercase' }}>
                Challenge · prize: {challenge.prize}
              </p>
              <span style={{ fontSize: 11, fontWeight: 700, background: 'var(--gold-tint)', color: 'var(--gold)', borderRadius: 999, padding: '3px 10px' }}>
                {chDaysLeft} day{chDaysLeft === 1 ? '' : 's'} left
              </span>
            </div>
            <p style={{ margin: '6px 0 2px', fontSize: 21, fontWeight: 800, letterSpacing: '-0.02em' }}>{challenge.name}</p>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-2)' }}>
              First to {challenge.targetKg.toLocaleString()} kg takes it home
            </p>

            {challenge.winnerName ? (
              <div style={{ marginTop: 14, background: 'var(--gold-tint)', border: '1px solid var(--gold)', borderRadius: 14, padding: '12px 14px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21h8M12 21v-4M17 4H7v5a5 5 0 0 0 10 0V4z" /></svg>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>{challenge.winnerName} takes the creatine!</p>
              </div>
            ) : chJoined ? (
              <>
                <div style={{ position: 'relative', margin: '20px 0 6px' }}>
                  <div style={{ background: 'var(--soft)', borderRadius: 999, height: 9, overflow: 'hidden' }}>
                    <div className="gd-shimbar" style={{
                      height: '100%', width: `${chPct}%`, borderRadius: 999,
                      background: 'linear-gradient(90deg, #B8860B, var(--gold))',
                      transition: 'width 1.2s cubic-bezier(0.22, 1, 0.36, 1)',
                    }} />
                  </div>
                  {(challenge.progress || []).slice(0, 3).map((p, ri) => {
                    const left = Math.min(Math.max((p.kg / challenge.targetKg) * 100, 3), 97);
                    const mine = p.userId === userId;
                    return (
                      <div key={p.userId || ri} style={{
                        position: 'absolute', top: -7, left: `${left}%`, transform: 'translateX(-50%)',
                        width: 22, height: 22, borderRadius: 999,
                        background: 'linear-gradient(135deg, var(--soft), var(--card))',
                        border: `1.5px solid ${mine ? 'var(--gold)' : 'var(--line)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 9, fontWeight: 800, color: 'var(--ink)',
                        zIndex: mine ? 2 : 1,
                        boxShadow: mine ? '0 0 14px var(--gold-tint)' : '0 4px 12px rgba(0,0,0,0.3)',
                        transition: 'left 1.2s cubic-bezier(0.22, 1, 0.36, 1)',
                      }}>
                        {(p.initials || p.name || '?').charAt(0).toUpperCase()}
                      </div>
                    );
                  })}
                </div>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-2)' }}>
                  <b style={{ color: 'var(--ink)' }}>{fmtKg(chMyKg)} / {challenge.targetKg.toLocaleString()} kg</b>
                  {chLeader && chLeader.userId !== userId ? ` · ${chLeader.name} leads with ${fmtKg(chLeader.kg)} kg` : chMyKg > 0 ? ' · you lead the pack 🐕' : ' — log a session to get on the board'}
                </p>
              </>
            ) : (
              <button onClick={joinChallenge} disabled={joining} style={{
                marginTop: 14, border: 'none', borderRadius: 14,
                background: 'linear-gradient(180deg, #FFD97A, var(--gold))', color: '#2A1D00',
                padding: '12px 22px', fontSize: 14, fontWeight: 800, cursor: 'pointer',
                opacity: joining ? 0.6 : 1, boxShadow: '0 8px 24px var(--gold-tint)',
              }}>
                {joining ? 'Joining…' : `Join challenge · ${challenge.joinedBy?.length || 0} in`}
              </button>
            )}
          </div>
          </Reveal>
        )}

        {/* ── LEADERBOARD (real, this week) ── */}
        <Reveal>
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <p style={eyebrow}>Leaderboard · {lbScope === 'all' ? 'all time' : 'last 7 days'}</p>
            {myRank >= 0 && <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-strong)' }}>You&rsquo;re #{myRank + 1}</span>}
          </div>
          {loading ? (
            <p style={{ fontSize: 12, color: 'var(--ink-3)', textAlign: 'center', padding: '14px 0' }}>Loading…</p>
          ) : leaderboard.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--ink-3)', textAlign: 'center', padding: '14px 0' }}>
              No sessions logged in the last 7 days. First to lift leads the pack.
            </p>
          ) : (
            <>
              {/* Podium for the top 3 — mockup port */}
              {leaderboard.length >= 3 && (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, padding: '12px 4px 0' }}>
                  {[leaderboard[1], leaderboard[0], leaderboard[2]].map((u, col) => {
                    const first = col === 1;
                    const maxKg = leaderboard[0].kg || 1;
                    const h = first ? 64 : Math.max(26, Math.round(60 * ((u.kg || 0) / maxKg)));
                    const me = u.userId === userId;
                    return (
                      <div key={u.userId} style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
                        {first && (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="var(--gold)" style={{ marginBottom: 4 }}><path d="M3 8l4.5 3L12 4l4.5 7L21 8l-1.8 10H4.8L3 8z" /></svg>
                        )}
                        <div style={{
                          width: 44, height: 44, borderRadius: '50%', margin: '0 auto',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 800, fontSize: 14, color: '#fff',
                          background: 'linear-gradient(135deg, var(--violet), var(--blue))',
                          border: first ? '2px solid var(--gold)' : '2px solid transparent',
                          boxShadow: first ? '0 0 20px var(--gold-tint)' : 'none',
                        }}>
                          {(u.initials || u.name || 'A').charAt(0)}
                        </div>
                        <p style={{ margin: '7px 0 0', fontSize: 13, fontWeight: 800, color: first ? 'var(--gold)' : 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{fmtKg(u.kg)}</p>
                        <p style={{ margin: '1px 0 0', fontSize: 10.5, color: 'var(--ink-3)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}{me ? ' (you)' : ''}</p>
                        <div style={{
                          height: h, marginTop: 8, borderRadius: '12px 12px 0 0',
                          background: first ? 'linear-gradient(180deg, var(--gold-tint), transparent)' : 'linear-gradient(180deg, var(--soft), transparent)',
                          border: '1px solid var(--line)', borderBottom: 'none',
                        }} />
                      </div>
                    );
                  })}
                </div>
              )}
              {(leaderboard.length >= 3 ? leaderboard.slice(3) : leaderboard).map((u, i) => {
                const rank = leaderboard.length >= 3 ? i + 4 : i + 1;
                const me = u.userId === userId;
                return (
                  <div key={u.userId} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0',
                    borderTop: me ? 'none' : '1px solid var(--line-2)',
                    ...(me ? { background: 'var(--accent-tint)', margin: '0 -10px', padding: '11px 10px', borderRadius: 12 } : {}),
                  }}>
                    {rank <= 3 ? (
                      <div style={{ width: 26, height: 26, borderRadius: '50%', background: MEDAL[rank - 1], color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, flexShrink: 0 }}>{rank}</div>
                    ) : (
                      <div style={{ width: 26, textAlign: 'center', fontWeight: 800, color: 'var(--ink-3)', fontSize: 14 }}>{rank}</div>
                    )}
                    <Avatar initial={(u.initials || u.name || 'A').charAt(0)} size={34} />
                    <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: me ? 'var(--accent-strong)' : 'var(--ink)' }}>
                      {u.name}{me ? ' (you)' : ''}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: me ? 'var(--accent-strong)' : 'var(--ink-2)', fontVariantNumeric: 'tabular-nums' }}>{fmtKg(u.kg)} kg</span>
                  </div>
                );
              })}
            </>
          )}
        </div>
        </Reveal>

        {/* ── COMPOSE ── */}
        <Reveal delay={60}>
        <div style={{ ...cardStyle, padding: 14, display: 'flex', gap: 10, alignItems: 'center' }}>
          <Avatar initial={userInitials} size={36} />
          <input
            value={composeText}
            onChange={e => setComposeText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submitPost(); }}
            placeholder="Share a win with the pack…"
            maxLength={500}
            style={{ flex: 1, background: 'var(--soft)', border: '1px solid var(--line)', borderRadius: 999, padding: '11px 15px', color: 'var(--ink)', fontSize: 14, outline: 'none', minWidth: 0 }}
          />
          <button onClick={submitPost} disabled={posting || !composeText.trim()} style={{
            border: 'none', background: 'var(--accent)', color: 'var(--on-accent)', borderRadius: 999,
            width: 40, height: 40, fontWeight: 800, fontSize: 16, cursor: 'pointer',
            opacity: posting || !composeText.trim() ? 0.5 : 1, flexShrink: 0,
          }}>↑</button>
        </div>
        </Reveal>

        {/* ── FEED (real) ── */}
        <div>
          <p style={{ ...eyebrow, marginLeft: 4, marginBottom: 10 }}>Feed</p>
          {loading ? (
            <p style={{ fontSize: 12, color: 'var(--ink-3)', textAlign: 'center', padding: '20px 0' }}>Loading…</p>
          ) : posts.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: 'center', padding: 28 }}>
              <div style={{ fontSize: 34, marginBottom: 8 }}>🐕</div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>No posts yet</p>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--ink-3)' }}>Finish a workout and share it — be the first big dog on the feed.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {posts.map((post, pi) => {
                const fires = (post.firedBy || []).length;
                const fired = (post.firedBy || []).includes(userId);
                const comments = post.commentsList || [];
                return (
                  <Reveal key={post.id} delay={Math.min(pi * 50, 300)}>
                  <div style={cardStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 10 }}>
                      <Avatar initial={(post.initials || post.name || 'A').charAt(0)} size={38} />
                      <div>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{post.name}</p>
                        <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-3)' }}>{timeAgo(post.createdAt)}{post.tag ? ` · ${post.tag}` : ''}</p>
                      </div>
                    </div>
                    <p style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--ink)', lineHeight: 1.5 }}>{post.text}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button onClick={() => toggleFire(post)} style={{
                        display: 'flex', alignItems: 'center', gap: 6, borderRadius: 999, padding: '7px 13px',
                        background: fired ? 'var(--orange-tint)' : 'var(--soft)',
                        border: `1px solid ${fired ? 'var(--orange)' : 'transparent'}`,
                        cursor: 'pointer', color: fired ? 'var(--orange-ink)' : 'var(--ink-2)',
                        fontSize: 12.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                      }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ animation: fired ? 'gdPop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none' }}><path d="M12 2c1 4-4 6-4 10a4 4 0 0 0 8 0c0-1.5-.6-2.6-1.2-3.6C16.4 9.6 19 11.5 19 15a7 7 0 0 1-14 0C5 8 11 7 12 2z" /></svg>
                        {fires > 0 ? fires : ''}
                      </button>
                      <button onClick={() => { setCommentOn(commentOn === post.id ? null : post.id); setCommentText(''); }} style={{
                        display: 'flex', alignItems: 'center', gap: 6, borderRadius: 999, padding: '7px 13px',
                        background: 'var(--soft)', border: '1px solid transparent',
                        cursor: 'pointer', color: 'var(--ink-2)', fontSize: 12.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                      }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a8 8 0 0 1-8 8H4l2.5-2.5A8 8 0 1 1 21 12z" /></svg>
                        {comments.length > 0 ? comments.length : ''}
                      </button>
                    </div>

                    {/* comments */}
                    {commentOn === post.id && (
                      <div style={{ marginTop: 12 }}>
                        {comments.map((c, ci) => (
                          <div key={ci} style={{ display: 'flex', gap: 8, padding: '8px 0', borderTop: ci === 0 ? '1px solid var(--line-2)' : 'none' }}>
                            <span style={{ fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{c.name}</span>
                            <span style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.4 }}>{c.text}</span>
                          </div>
                        ))}
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                          <input
                            autoFocus
                            value={commentText}
                            onChange={e => setCommentText(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') sendComment(post); }}
                            placeholder={`Reply to ${post.name}…`}
                            maxLength={500}
                            style={{ flex: 1, background: 'var(--soft)', border: '1px solid var(--line)', borderRadius: 999, padding: '9px 14px', color: 'var(--ink)', fontSize: 13, outline: 'none', minWidth: 0 }}
                          />
                          <button onClick={() => sendComment(post)} style={{ border: 'none', background: 'var(--accent)', color: 'var(--on-accent)', borderRadius: 999, padding: '0 16px', fontWeight: 800, cursor: 'pointer' }}>↑</button>
                        </div>
                      </div>
                    )}
                  </div>
                  </Reveal>
                );
              })}
            </div>
          )}
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

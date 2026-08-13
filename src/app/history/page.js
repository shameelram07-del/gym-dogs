'use client';
import { todayISO, toLocalISO } from '@/lib/day';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useMsal } from '@azure/msal-react';
import BottomNav from '@/components/BottomNav';
import Reveal from '@/components/Reveal';
import { heatLevel, heatMax, heatStyle } from '@/lib/heat';

const API_URL = 'https://gymdogs-api-g9d0gve4angygdcj.newzealandnorth-01.azurewebsites.net/api/gymLogs';
const API_KEY = process.env.NEXT_PUBLIC_API_KEY;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const eyebrow = { fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', color: 'var(--ink-3)', textTransform: 'uppercase', margin: 0 };
const CARD_R = 26;

function setsOf(sets_data) {
  try { return JSON.parse(sets_data || '[]'); } catch { return []; }
}
function volumeOf(sets_data) {
  return setsOf(sets_data).reduce((s, x) => s + (parseFloat(x.kg) || 0) * (parseInt(x.reps) || 0), 0);
}
function fmtKg(v) {
  return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`;
}
function toIso(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export default function HistoryPage() {
  const router = useRouter();
  const { accounts, inProgress } = useMsal();
  const [userId, setUserId] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; });
  const [selected, setSelected] = useState(todayISO());

  useEffect(() => {
    if (inProgress !== 'none') return;
    if (accounts.length === 0) { router.push('/login'); return; }
    setUserId(accounts[0].localAccountId);
  }, [accounts, inProgress, router]);

  // Open a specific day if arrived via ?date=YYYY-MM-DD (e.g. dashboard week strip)
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('date');
    if (p && /^\d{4}-\d{2}-\d{2}$/.test(p)) {
      setSelected(p);
      const dt = new Date(p + 'T00:00:00');
      setMonth(new Date(dt.getFullYear(), dt.getMonth(), 1));
    }
  }, []);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const res = await fetch(`${API_URL}?userId=${userId}`, { headers: { 'x-functions-key': API_KEY } });
        if (res.ok) { const d = await res.json(); setLogs(Array.isArray(d) ? d.filter(x => x.date) : []); }
      } catch (e) {}
      finally { setLoading(false); }
    })();
  }, [userId]);

  // Group logs by day → { iso: { vol, plan, exercises:[{name, sets}] } }
  const byDate = useMemo(() => {
    const m = {};
    logs.forEach(l => {
      const iso = String(l.date).split('T')[0];
      if (!m[iso]) m[iso] = { vol: 0, plan: '', exercises: [] };
      m[iso].vol += volumeOf(l.sets_data);
      m[iso].exercises.push({ name: l.exName || 'Exercise', sets: setsOf(l.sets_data) });
      if (l.planName) m[iso].plan = l.planName;
    });
    return m;
  }, [logs]);

  const cells = useMemo(() => {
    const y = month.getFullYear(), mo = month.getMonth();
    const startDow = (new Date(y, mo, 1).getDay() + 6) % 7; // Monday-first
    const days = new Date(y, mo + 1, 0).getDate();
    const arr = [];
    for (let i = 0; i < startDow; i++) arr.push(null);
    for (let d = 1; d <= days; d++) arr.push({ d, iso: toIso(y, mo, d) });
    return arr;
  }, [month]);

  if (!userId) return null;

  // Same intensity ramp the progress heatmap uses, measured across the whole
  // history so a heavy day stays a heavy day as you page between months.
  const volMax = heatMax(Object.values(byDate).map((d) => d.vol));
  const todayIso = todayISO();
  const sel = byDate[selected];
  const shiftMonth = (delta) => setMonth(m => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  const selLabel = new Date(selected + 'T00:00:00').toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)', paddingBottom: 100 }}>

      <div style={{ padding: '52px 20px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.push('/dashboard')} aria-label="Back" style={{ width: 38, height: 38, borderRadius: 12, background: 'var(--soft)', border: '1px solid var(--line)', color: 'var(--ink)', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
        <div>
          <p style={eyebrow}>Train history</p>
          <h1 className="gd-disp" style={{ margin: '1px 0 0', fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em' }}>Calendar</h1>
        </div>
      </div>

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── MONTH CALENDAR ── */}
        <Reveal delay={0} style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: CARD_R, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <button onClick={() => shiftMonth(-1)} aria-label="Previous month" style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--soft)', border: 'none', color: 'var(--ink)', fontSize: 16, cursor: 'pointer' }}>‹</button>
            <p className="gd-disp" style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{MONTHS[month.getMonth()]} {month.getFullYear()}</p>
            <button onClick={() => shiftMonth(1)} aria-label="Next month" style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--soft)', border: 'none', color: 'var(--ink)', fontSize: 16, cursor: 'pointer' }}>›</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 6 }}>
            {DOW.map((d, i) => (
              <div key={i} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--ink-3)' }}>{d}</div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
            {cells.map((c, i) => {
              if (!c) return <div key={i} />;
              const day = byDate[c.iso];
              const isSel = c.iso === selected;
              const isFuture = c.iso > todayIso;
              // Intensity, not a binary dot: a light day and a heavy day should
              // not look identical on the calendar.
              const level = heatLevel(day ? day.vol : 0, volMax);
              return (
                <button key={i} onClick={() => setSelected(c.iso)} disabled={isFuture} style={{
                  aspectRatio: '1', borderRadius: 12, cursor: isFuture ? 'default' : 'pointer',
                  border: isSel ? '2px solid var(--accent-strong)' : '1px solid var(--line)',
                  ...heatStyle(level),
                  color: isFuture ? 'var(--ink-3)' : level >= 3 ? 'var(--on-accent)' : 'var(--ink)',
                  opacity: isFuture ? 0.4 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700, position: 'relative',
                }}>
                  {c.d}
                </button>
              );
            })}
          </div>

          {/* Legend — the shading means nothing without it */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginTop: 12 }}>
            <span style={{ ...eyebrow, fontSize: 10 }}>Less</span>
            {[0, 1, 2, 3].map((lv) => (
              <span key={lv} style={{ width: 12, height: 12, borderRadius: 4, ...heatStyle(lv) }} />
            ))}
            <span style={{ ...eyebrow, fontSize: 10 }}>More</span>
          </div>
        </Reveal>

        {/* ── SELECTED DAY DETAIL ── */}
        <Reveal delay={90}>
          <p style={{ ...eyebrow, margin: '0 4px 10px' }}>{selLabel}</p>

          {loading ? (
            <p style={{ fontSize: 12, color: 'var(--ink-3)', textAlign: 'center', padding: '20px 0' }}>Loading…</p>
          ) : !sel ? (
            <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: CARD_R, padding: 26, textAlign: 'center' }}>
              <div style={{ fontSize: 30, marginBottom: 6 }}>🐕</div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>No workout logged</p>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--ink-3)' }}>Pick a highlighted day to see the session.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ background: 'var(--grad-soft)', border: '1px solid var(--line)', borderRadius: CARD_R, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>{sel.plan || 'Workout'}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--ink-2)' }}>{sel.exercises.length} exercise{sel.exercises.length === 1 ? '' : 's'}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p className="gd-disp gd-grad-text" style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>{fmtKg(sel.vol)}</p>
                  <p style={{ margin: 0, fontSize: 10, color: 'var(--ink-3)', fontWeight: 700, letterSpacing: '0.06em' }}>KG TOTAL</p>
                </div>
              </div>

              {sel.exercises.map((ex, i) => {
                const done = ex.sets.filter(s => s.kg || s.reps);
                return (
                  <div key={i} style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: CARD_R, padding: 16 }}>
                    <p className="gd-disp" style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700 }}>{ex.name}</p>
                    {done.length === 0 ? (
                      <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-3)' }}>No sets recorded</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {done.map((s, j) => (
                          <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                            <span style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--soft)', color: 'var(--ink-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{j + 1}</span>
                            <span style={{ fontWeight: 700 }}>{s.kg || '—'} kg</span>
                            <span style={{ color: 'var(--ink-3)' }}>×</span>
                            <span style={{ fontWeight: 700 }}>{s.reps || '—'} reps</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Reveal>

      </div>

      <BottomNav />
    </div>
  );
}

'use client';
import { useState } from 'react';
import Reveal from '@/components/Reveal';
import { cardStyle, chip, R, T } from '@/lib/ui';
import Avatar from './Avatar';

function readinessStyle(score) {
  if (!score) return { ink: 'var(--ink-3)', bg: 'var(--soft)', label: 'No data' };
  if (score >= 80) return { ink: 'var(--accent-strong)', bg: 'var(--accent-tint)', label: 'Ready' };
  if (score >= 60) return { ink: 'var(--blue-ink)', bg: 'var(--blue-tint)', label: 'Moderate' };
  if (score >= 40) return { ink: 'var(--orange-ink)', bg: 'var(--orange-tint)', label: 'Fatigued' };
  return { ink: 'var(--red-ink)', bg: 'var(--red-tint)', label: 'Rest day' };
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'trained', label: 'Trained' },
  { key: 'rest', label: 'Rest' },
  { key: 'alerts', label: 'Alerts' },
];

/**
 * The pack, at a glance.
 *
 * The stats strip now lives HERE rather than above the tab switcher. Trained
 * today / average readiness / alerts is Clients data, and sitting outside the
 * tabs it stayed on screen while you built a session or edited a challenge —
 * about 110px of the wrong context on two tabs out of three.
 */
export default function ClientList({ clients, loading }) {
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);

  const trainedToday = clients.filter((c) => c.trainedToday).length;
  const alerting = clients.filter((c) => c.alert);
  const withReadiness = clients.filter((c) => c.readiness);
  const avgReadiness = withReadiness.length > 0
    ? Math.round(withReadiness.reduce((a, c) => a + c.readiness, 0) / withReadiness.length)
    : '—';
  // "avg readiness 84" was one person's score wearing the whole pack's label —
  // everybody else reads "— No data". The maths was right; say what it covers.
  const readinessLabel = withReadiness.length === clients.length && clients.length > 0
    ? 'avg readiness'
    : `readiness · ${withReadiness.length} of ${clients.length}`;

  const shown = clients.filter((c) => {
    if (filter === 'trained') return c.trainedToday;
    if (filter === 'alerts') return c.alert;
    if (filter === 'rest') return !c.trainedToday;
    return true;
  });

  return (
    <>
      <Reveal>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {[
            { value: `${trainedToday}/${clients.length}`, label: 'trained today', color: 'var(--accent-strong)' },
            { value: avgReadiness, label: readinessLabel, color: 'var(--blue-ink)' },
            { value: alerting.length, label: 'alerts', color: alerting.length > 0 ? 'var(--orange)' : 'var(--ink-3)' },
          ].map((s, i) => (
            <div key={i} style={{ ...cardStyle, padding: '16px 8px', textAlign: 'center' }}>
              <p className="gd-disp" style={{ margin: 0, fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</p>
              <p style={{ margin: '3px 0 0', fontSize: T.xs, color: 'var(--ink-3)', fontWeight: 600 }}>{s.label}</p>
            </div>
          ))}
        </div>
      </Reveal>

      {loading && (
        <p style={{ fontSize: T.sm, color: 'var(--ink-3)', textAlign: 'center', padding: '10px 0', margin: 0 }}>Loading clients…</p>
      )}

      {!loading && clients.length === 0 && (
        <div style={{ ...cardStyle, padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 30, marginBottom: 8 }}>🐕</div>
          <p style={{ margin: 0, fontSize: T.md, fontWeight: 700 }}>No clients yet</p>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--ink-3)' }}>They appear here as soon as your friends sign up.</p>
        </div>
      )}

      {alerting.length > 0 && (
        <div style={{ background: 'var(--orange-tint)', borderRadius: R.card, padding: '14px 16px' }}>
          <p style={{ margin: '0 0 10px', fontSize: T.xs, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--orange-ink)' }}>
            ⚠️ ATTENTION NEEDED
          </p>
          {alerting.map((c) => (
            <div key={c.userId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Avatar initials={c.initials} size={30} />
                <span style={{ fontSize: T.md, fontWeight: 700 }}>{c.name}</span>
              </div>
              <span style={{ fontSize: T.sm, color: 'var(--orange-ink)', fontWeight: 600 }}>{c.alert}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
        {FILTERS.map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)} style={{ ...chip(filter === f.key), flexShrink: 0, padding: '8px 16px', fontSize: T.sm }}>
            {f.label}
          </button>
        ))}
      </div>

      {shown.map((client, ci) => {
        const rs = readinessStyle(client.readiness);
        const open = selected === client.userId;
        return (
          <Reveal key={client.userId} delay={120 + ci * 50}>
            <button
              onClick={() => setSelected(open ? null : client.userId)}
              aria-expanded={open}
              style={{ width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
            >
              <div style={{ ...cardStyle, borderColor: open ? 'var(--accent)' : 'var(--line)', padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Avatar initials={client.initials} size={44} online={client.trainedToday} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{client.name}</p>
                      {client.alert && <span style={{ fontSize: 13 }}>⚠️</span>}
                    </div>
                    <p style={{ margin: '2px 0 0', fontSize: T.sm, color: 'var(--ink-3)' }}>{client.goal}</p>
                  </div>
                  <div style={{ background: rs.bg, borderRadius: R.inner, padding: '8px 12px', textAlign: 'center', flexShrink: 0 }}>
                    <p className="gd-disp" style={{ margin: 0, fontSize: 21, fontWeight: 700, color: rs.ink, lineHeight: 1 }}>
                      {client.readiness || '—'}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: T.xxs, color: rs.ink, fontWeight: 600 }}>{rs.label}</p>
                  </div>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateRows: open ? '1fr' : '0fr',
                  transition: 'grid-template-rows 0.45s cubic-bezier(0.22, 1, 0.36, 1)',
                }}>
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--line-2)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10 }}>
                        {[
                          { label: 'sessions', value: `${client.sessionsThisWeek || 0}/wk` },
                          { label: 'streak', value: `🔥${client.streak || 0}` },
                          { label: 'weight', value: client.weight ? `${client.weight}kg` : '—' },
                        ].map((s, i) => (
                          <div key={i} style={{ background: 'var(--soft)', borderRadius: R.inner, padding: 10, textAlign: 'center' }}>
                            <p className="gd-disp" style={{ margin: '0 0 3px', fontSize: 15, fontWeight: 700 }}>{s.value}</p>
                            <p style={{ margin: 0, fontSize: 9, color: 'var(--ink-3)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{s.label}</p>
                          </div>
                        ))}
                      </div>
                      <div style={{ background: 'var(--soft)', borderRadius: R.inner, padding: 12 }}>
                        <p style={{ margin: '0 0 4px', fontSize: T.xxs, color: 'var(--ink-3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Last session</p>
                        <p style={{ margin: 0, fontSize: T.md, fontWeight: 600 }}>
                          {client.lastSession || 'No sessions logged yet'}
                          {client.lastSessionDate ? <span style={{ color: 'var(--ink-3)', fontWeight: 500 }}> · {client.lastSessionDate}</span> : null}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </button>
          </Reveal>
        );
      })}
    </>
  );
}

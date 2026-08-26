'use client';
import { useState, useMemo } from 'react';
import { exerciseLibrary } from '@/lib/exercises';
import { stationClash } from '@/lib/session';
import { eyebrow, inputStyle, R, T } from '@/lib/ui';

/**
 * Change one exercise for another.
 *
 * This exists because the per-row muscle-group and equipment controls were cut,
 * and cutting them without a replacement would have been worse than leaving
 * them: swapping a movement is the one edit a coach actually makes on a
 * generated session.
 *
 * It is also strictly better than what it replaces, for a reason the old
 * controls could not have managed — they knew nothing about blocks. When two
 * people are training, each exercise is paired with a partner they alternate
 * with, and the pair must not need the same station or one of them stands and
 * waits. So anything that clashes with the partner's equipment is shown as
 * unavailable, with the reason, rather than silently offered and then quietly
 * repaired later.
 */
export default function SwapSheet({ exercises, index, onPick, onClose }) {
  const [q, setQ] = useState('');
  const current = exercises[index];

  // The other half of this block, if there is one.
  const partner = useMemo(() => {
    if (!current || !current.block) return null;
    return exercises.find((e, i) => i !== index && e.block === current.block) || null;
  }, [exercises, index, current]);

  const options = useMemo(() => {
    const group = current ? current.muscleGroup : null;
    const list = (group && exerciseLibrary[group]) || [];
    const needle = q.trim().toLowerCase();
    // Anything already in the session is out — a session with the same movement
    // twice is a bug, not a choice.
    const taken = new Set(exercises.filter((_, i) => i !== index).map((e) => e.name));
    return list
      .filter((e) => !needle || e.name.toLowerCase().includes(needle))
      .map((e) => ({
        ...e,
        used: taken.has(e.name),
        clashes: partner ? stationClash(e, partner) : false,
      }));
  }, [current, q, exercises, index, partner]);

  if (!current) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 480, maxHeight: '82vh',
          background: 'var(--card)',
          borderTopLeftRadius: R.card, borderTopRightRadius: R.card,
          borderTop: '1px solid var(--line)',
          boxShadow: 'var(--e3)',
          display: 'flex', flexDirection: 'column',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid var(--line-2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
            <p style={eyebrow}>Swap &middot; {current.muscleGroup}</p>
            <button onClick={onClose} style={{
              background: 'none', border: 'none', color: 'var(--ink-3)',
              fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: 0,
            }}>Close</button>
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 13.5, fontWeight: 600 }}>
            Replacing <span style={{ color: 'var(--accent-strong)' }}>{current.name || 'this row'}</span>
          </p>
          {partner && (
            <p style={{ margin: '4px 0 0', fontSize: T.xs, color: 'var(--ink-3)', lineHeight: 1.5 }}>
              Block {current.block} is shared with <b style={{ color: 'var(--ink-2)' }}>{partner.name}</b> on{' '}
              {partner.equipment} — anything on the same station is unavailable, so nobody waits.
            </p>
          )}
          <input
            type="text" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder={`Search ${current.muscleGroup.toLowerCase()} exercises…`}
            style={{ ...inputStyle, marginTop: 12 }}
          />
        </div>

        <div style={{ overflowY: 'auto', padding: '8px 12px 16px' }}>
          {options.length === 0 && (
            <p style={{ margin: '18px 0', textAlign: 'center', fontSize: 13, color: 'var(--ink-3)' }}>
              Nothing in {current.muscleGroup.toLowerCase()} matches that.
            </p>
          )}
          {options.map((e) => {
            const blocked = e.clashes || e.used;
            return (
              <button
                key={e.name}
                disabled={blocked}
                onClick={() => onPick(e)}
                style={{
                  width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '11px 10px', borderRadius: R.inner, border: 'none',
                  background: e.name === current.name ? 'var(--accent-tint)' : 'transparent',
                  cursor: blocked ? 'not-allowed' : 'pointer',
                  opacity: blocked ? 0.42 : 1,
                }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{e.name}</span>
                  <span style={{ display: 'block', marginTop: 1, fontSize: T.xs, color: 'var(--ink-3)' }}>
                    {e.equipment}
                    {e.used && ' · already in this session'}
                    {e.clashes && ` · same station as ${partner.name}`}
                  </span>
                </span>
                <span className="gd-num" style={{ flexShrink: 0, fontSize: T.xs, color: 'var(--ink-3)' }}>
                  {e.defaultSets} &times; {e.defaultReps}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

'use client';
import { useState } from 'react';

/**
 * A number input you can actually type into.
 *
 * These are controlled inputs. Without somewhere to park a half-finished value,
 * React restores the previous number on the next render and the field can never
 * be emptied — which is to say never retyped. Clamping per keystroke is what
 * made the old boxes impossible to use: a "1" on its way to "15" was being
 * snapped straight back to the minimum.
 *
 * So: hold the raw string while it is being typed, commit on blur or Enter, and
 * apply min/max only at that point.
 *
 * Lifted out of coach/page.js because the session brief and the challenge form
 * had grown separate copies of it, and only one of them had the Enter handler.
 */
export function useNumberDraft() {
  const [draft, setDraft] = useState({});

  /** Blur and Enter are where a typed value becomes real. */
  const commit = (f) => {
    const raw = draft[f.label];
    setDraft((d) => { const next = { ...d }; delete next[f.label]; return next; });
    if (raw === undefined) return;                  // never touched
    const n = parseInt(raw, 10);
    // Left empty: fall back to the field's own idea of "unset" if it has one,
    // otherwise drop the draft so the previous number comes back.
    if (Number.isNaN(n)) { if (f.onEmpty) f.onEmpty(); return; }
    f.onChange(Math.min(Math.max(n, f.min), f.max ?? Infinity));
  };

  /** Spread onto an <input type="number">. `f` is { label, value, min, max, step, onChange, onEmpty }. */
  const bind = (f) => ({
    type: 'number',
    value: draft[f.label] ?? String(f.value),
    min: f.min,
    max: f.max,
    step: f.step,
    onChange: (e) => {
      const raw = e.target.value;
      setDraft((d) => ({ ...d, [f.label]: raw }));
      const n = parseInt(raw, 10);
      // Commit while typing ONLY once the number is already in range, so the
      // spinner arrows still feel instant.
      if (!Number.isNaN(n) && n >= f.min && n <= (f.max ?? Infinity)) f.onChange(n);
    },
    onBlur: () => commit(f),
    onKeyDown: (e) => { if (e.key === 'Enter') e.currentTarget.blur(); },
  });

  return { bind };
}

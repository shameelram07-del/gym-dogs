// Consistency intensity — one ramp, two screens.
//
// The progress heatmap and the history calendar both colour a day by how much
// work it holds. They used to disagree: progress had a three-level ember →
// magenta → gradient scale, history just painted every trained day the same
// flat tint. Same question, two answers. This is the single answer.
//
// Pure — no React, no fetch. Colours come from the --heat-* tokens so a palette
// change lands in both screens at once.

/** 0 = nothing logged, 3 = a heavy day relative to `max`. */
export function heatLevel(volume, max) {
  const v = Number(volume) || 0;
  if (v <= 0) return 0;
  const m = Number(max) || 1;
  if (v < m * 0.5) return 1;
  if (v < m * 0.85) return 2;
  return 3;
}

/** The largest daily volume in a set, i.e. what level 3 is measured against. */
export function heatMax(volumes) {
  return Math.max(...(Array.isArray(volumes) ? volumes : []).map((v) => Number(v) || 0), 1);
}

/** Background + glow for a level. Level 3 carries the brand gradient, so text
 *  on it needs --on-accent rather than --ink. */
export function heatStyle(level) {
  if (level >= 3) return { background: 'var(--grad)', boxShadow: '0 0 10px var(--accent-glow)' };
  if (level === 2) return { background: 'var(--heat-2)', boxShadow: 'none' };
  if (level === 1) return { background: 'var(--heat-1)', boxShadow: 'none' };
  return { background: 'var(--soft)', boxShadow: 'none' };
}

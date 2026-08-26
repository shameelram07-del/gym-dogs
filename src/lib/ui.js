// The shared look, in one place.
//
// Pages here are styled with inline style objects reading CSS custom properties
// from globals.css — that is the house style and this file does not change it.
// What it changes is that the objects were being RE-TYPED on every screen.
// `eyebrow` was declared, character for character, in twelve separate files;
// `cardStyle` in four. Twelve identical constants are not a design system, they
// are twelve things that happen to agree today and will quietly stop agreeing
// the first time one of them is tweaked.
//
// Everything here is a plain object or a pure function of one argument. No
// React, no imports, nothing to initialise — so it can be spread anywhere a
// style object goes, and overridden inline the way it always was:
//
//   <div style={{ ...cardStyle, padding: 22 }}>
//
// Raw values only appear where a token genuinely does not exist. Colours are
// always `var(--…)` — never a hex.

// ── Scales ────────────────────────────────────────────────────────────────
// Mirrors of the CSS scales in globals.css, as numbers, because inline styles
// mostly want a number. Reach for these instead of typing a fresh one: the app
// had seventeen distinct corner radii and about twenty-five font sizes before
// these existed, which is most of why it read as unfinished.

export const R = {
  chip: 999,   // pills, avatars, anything fully round
  inner: 12,   // a field or tile INSIDE a card
  control: 14, // buttons, inputs, tab switchers
  panel: 18,   // a secondary panel or callout
  card: 26,    // the signature card. Nothing else should be this big
};

export const T = {
  xxs: 10,     // uppercase micro-labels only
  xs: 11,      // eyebrows, chip text
  sm: 12.5,    // secondary / meta copy
  md: 14,      // body — the default
  lg: 16,      // emphasised body, card titles
  xl: 20,      // section headings
  xxl: 26,     // screen headings
  hero: 34,    // hero numbers
};

export const SP = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32 };

// ── Surfaces ──────────────────────────────────────────────────────────────

/**
 * The card.
 *
 * Adds what the copies never had: a resting elevation and `--sheen`, the 1px
 * lit top edge. On a dark card that edge is most of the difference between a
 * flat rectangle and a surface, and it is the single cheapest thing that makes
 * the app look built rather than assembled.
 */
export const cardStyle = {
  background: 'var(--card)',
  border: '1px solid var(--line)',
  borderRadius: R.card,
  boxShadow: 'var(--e1), var(--sheen)',
  padding: 18,
};

/** A card that carries no padding of its own — lists, rows, media. */
export const cardBare = { ...cardStyle, padding: 0 };

/** A quieter surface for something nested inside a card. */
export const panelStyle = {
  background: 'var(--soft)',
  border: '1px solid var(--line-2)',
  borderRadius: R.panel,
  padding: 14,
};

/** A small tile — the stat blocks that run three-across. */
export const tileStyle = {
  background: 'var(--soft)',
  borderRadius: R.inner,
  padding: 10,
  textAlign: 'center',
};

// ── Type ──────────────────────────────────────────────────────────────────

/** The uppercase micro-heading above a section. Was in twelve files. */
export const eyebrow = {
  fontSize: T.xs,
  fontWeight: 700,
  letterSpacing: '0.09em',
  color: 'var(--ink-3)',
  textTransform: 'uppercase',
  margin: 0,
};

/** The same thing sitting above a form field, so it carries its own gap. */
export const fieldLabel = {
  ...eyebrow,
  letterSpacing: '0.06em',
  margin: '0 0 8px',
};

/** Small explanatory copy under a control. */
export const hint = {
  margin: '8px 0 0',
  fontSize: T.xs,
  color: 'var(--ink-3)',
  lineHeight: 1.5,
};

// ── Controls ──────────────────────────────────────────────────────────────

export const inputStyle = {
  width: '100%',
  background: 'var(--soft)',
  border: '1px solid var(--line)',
  borderRadius: R.inner,
  padding: '12px 14px',
  color: 'var(--ink)',
  fontSize: T.md,
  fontWeight: 600,
  outline: 'none',
  boxSizing: 'border-box',
};

/** A number field. Tabular digits so a value changing doesn't shift the box. */
export const numberInput = {
  ...inputStyle,
  fontSize: T.lg,
  fontWeight: 800,
  textAlign: 'center',
  fontVariantNumeric: 'tabular-nums',
};

/**
 * A selectable pill.
 *
 * `on` is the whole API on purpose — the selected treatment (tinted background,
 * strong accent ink) was being re-decided per screen, and had drifted into
 * three different versions of "selected".
 */
export const chip = (on) => ({
  padding: '8px 14px',
  borderRadius: R.chip,
  cursor: 'pointer',
  fontSize: T.xs,
  fontWeight: 700,
  border: 'none',
  background: on ? 'var(--accent-tint)' : 'var(--soft)',
  color: on ? 'var(--accent-strong)' : 'var(--ink-2)',
});

/** The larger pill used for filters and tabs within a screen. */
export const pill = (on) => ({
  ...chip(on),
  padding: '9px 16px',
  fontSize: T.sm,
});

// ── Buttons ───────────────────────────────────────────────────────────────

const buttonBase = {
  width: '100%',
  border: 'none',
  borderRadius: R.control,
  padding: 15,
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
};

/** The one real action on a screen. Brand gradient, and only one per view. */
export const btnPrimary = {
  ...buttonBase,
  background: 'var(--grad)',
  color: 'var(--on-accent)',
  boxShadow: 'var(--glow-grad)',
};

/** Everything else. */
export const btnQuiet = {
  ...buttonBase,
  background: 'var(--soft)',
  color: 'var(--ink-2)',
};

/** Destructive. Never the primary, never the default focus. */
export const btnDanger = {
  ...buttonBase,
  background: 'var(--red-tint)',
  color: 'var(--red-ink)',
};

/** Applied to a disabled/pending button, so "busy" looks the same everywhere. */
export const busy = (isBusy) => (isBusy ? { opacity: 0.5, cursor: 'wait' } : null);

// ── Feedback ──────────────────────────────────────────────────────────────

/** The success/error banner. Was re-declared inline on four screens. */
export const banner = (type) => ({
  borderRadius: R.control,
  padding: '12px 16px',
  textAlign: 'center',
  fontSize: 13,
  fontWeight: 700,
  background: type === 'error' ? 'var(--red-tint)' : 'var(--accent-tint)',
  color: type === 'error' ? 'var(--red-ink)' : 'var(--accent-strong)',
});

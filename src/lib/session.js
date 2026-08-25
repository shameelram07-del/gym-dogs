// Building a session from a set of muscle groups.
//
// All pure — no React, no fetch — so the pairing rule can be checked without a
// browser. The Coach screen owns the UI and the one model call; everything that
// decides *what a valid session looks like* lives here, because the rule that
// two exercises in a block must not need the same station is far too easy for a
// model to ignore. We ask it to follow the rule, then verify in code.

import { exerciseLibrary } from '@/lib/exercises';

// ── The picker ────────────────────────────────────────────────────────────

// Day presets are shortcuts, nothing more. They fill the muscle-group row and
// then get out of the way — that row is the single source of truth.
export const DAY_PRESETS = [
  { id: 'push',  label: 'Push',      groups: ['CHEST', 'SHOULDERS', 'TRICEPS'] },
  { id: 'pull',  label: 'Pull',      groups: ['BACK', 'BICEPS'] },
  { id: 'legs',  label: 'Legs',      groups: ['LEGS'] },
  { id: 'upper', label: 'Upper',     groups: ['CHEST', 'BACK', 'SHOULDERS', 'BICEPS', 'TRICEPS'] },
  { id: 'full',  label: 'Full body', groups: ['CHEST', 'BACK', 'LEGS', 'SHOULDERS', 'CORE'] },
];

const sameSet = (a, b) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

/** The preset a selection exactly matches, or null once it's been edited. */
export function presetFor(groups) {
  const sel = Array.isArray(groups) ? groups : [];
  return DAY_PRESETS.find((p) => sameSet(p.groups, sel)) || null;
}

/**
 * Roughly ten minutes an exercise, held inside the 4–8 the stepper allows.
 * 45 min → 4, 60 → 6, 90 → 8. The coach can override it; this is the default.
 */
export function countForMinutes(minutes) {
  const n = Math.floor((Number(minutes) || 60) / 10);
  return Math.max(4, Math.min(8, n));
}

const title = (g) => String(g).charAt(0) + String(g).slice(1).toLowerCase();

/** "Push Day", "Back & Biceps", "Legs" — the name offered when the field is blank. */
export function suggestName(groups) {
  const sel = (Array.isArray(groups) ? groups : []).filter(Boolean);
  if (sel.length === 0) return '';
  const preset = presetFor(sel);
  if (preset) return preset.id === 'legs' ? 'Legs' : preset.id === 'full' ? 'Full Body' : `${preset.label} Day`;
  if (sel.length === 1) return title(sel[0]);
  if (sel.length <= 3) return sel.map(title).join(' & ');
  return 'Full Body';
}

// ── The pairing rule ──────────────────────────────────────────────────────

// Bodyweight is the one category that occupies no station, so it pairs with
// anything — including another bodyweight movement. Everything else clashes
// with itself: two plate-loaded machines mean one person stands and waits,
// which is the entire thing this feature exists to avoid.
const NO_STATION = new Set(['Bodyweight']);

/** Would these two exercises send both people to the same station? */
export function stationClash(a, b) {
  if (!a || !b) return false;
  if (NO_STATION.has(a.equipment) || NO_STATION.has(b.equipment)) return false;
  return a.equipment === b.equipment;
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Pair a flat list into blocks of two.
 *
 * Most constrained first, not front to back. Pairing greedily from the front
 * looks fine and quietly wastes partners: given three plate-loaded machines and
 * three other things, taking them in order burns two of the non-machines on
 * each other and leaves two plate-loaded exercises with nobody to pair with —
 * two people standing around, in a session whose whole point is that nobody
 * does. Placing the hardest exercise first finds the pairing that exists.
 */
function pairUp(list) {
  const rest = list.map((e, i) => ({ e, i }));
  const blocks = [];

  // How many of the others this one cannot share a block with.
  const blocked = (item, pool) => pool.filter((x) => x !== item && stationClash(item.e, x.e)).length;

  while (rest.length) {
    let a = rest[0];
    for (const c of rest) if (blocked(c, rest) > blocked(a, rest)) a = c;
    rest.splice(rest.indexOf(a), 1);

    const options = rest.filter((b) => !stationClash(a.e, b.e));
    if (options.length === 0) { blocks.push([a]); continue; }

    // Of the legal partners, take the one that is hardest to place later,
    // breaking ties towards a different muscle group so neither person works
    // the same muscle twice in a row.
    let b = options[0];
    const score = (x) => blocked(x, rest) * 2 + (x.e.muscleGroup !== a.e.muscleGroup ? 1 : 0);
    for (const c of options) if (score(c) > score(b)) b = c;
    rest.splice(rest.indexOf(b), 1);
    blocks.push([a, b]);
  }

  // Back into roughly the order they arrived in, so a compounds-first answer
  // still reads compounds-first after being re-paired.
  blocks.sort((x, y) => Math.min(...x.map((i) => i.i)) - Math.min(...y.map((i) => i.i)));
  return blocks.map((pair) => pair.map((it) => it.e));
}

/** The blocks the model asked for, or null if it didn't give usable ones. */
function blocksFromModel(list) {
  if (!list.some((e) => e && e.block)) return null;
  const order = [];
  const byLetter = new Map();
  for (const e of list) {
    const key = e.block ? String(e.block).toUpperCase() : `_${order.length}`;
    if (!byLetter.has(key)) { byLetter.set(key, []); order.push(key); }
    byLetter.get(key).push(e);
  }
  return order.map((k) => byLetter.get(k));
}

/**
 * Stamp `block` onto each exercise and reorder so pairs sit together.
 *
 * With one person training there are no blocks at all and the list renders
 * exactly as it always has. With two or more, the model's own pairing is used
 * when it is legal, and silently repaired when it isn't — a block of two
 * plate-loaded machines is worse than no pairing at all.
 */
export function applyBlocks(list, people) {
  const items = Array.isArray(list) ? list : [];
  if (!(Number(people) >= 2)) return items.map((e) => ({ ...e, block: null }));

  const asked = blocksFromModel(items);
  const legal = asked && asked.every((b) => b.length <= 2 && (b.length < 2 || !stationClash(b[0], b[1])));
  const blocks = legal ? asked : pairUp(items);

  const out = [];
  blocks.forEach((pair, i) => {
    const letter = LETTERS[i % LETTERS.length];
    pair.forEach((e) => out.push({ ...e, block: letter }));
  });
  return out;
}

/** How many blocks a stamped list ended up with. */
export const blockCount = (list) =>
  new Set((Array.isArray(list) ? list : []).map((e) => e && e.block).filter(Boolean)).size;

/**
 * The one-line "how this session runs" note that goes out with the plan.
 *
 * Derived rather than asked for: the model is already being held to "reply with
 * ONLY a JSON array", and the facts here — headcount, block count, whether
 * anyone is left over — are ones we know exactly. Asking for prose alongside
 * the array is how the parse starts failing.
 */
export function runNoteFor(people, list) {
  const n = Number(people) || 1;
  if (n < 2) return '';
  const blocks = blockCount(list);
  const singles = (Array.isArray(list) ? list : []).filter(
    (e, i, a) => e && e.block && a.filter((x) => x && x.block === e.block).length === 1
  );
  const parts = [
    `${n} people, ${blocks} block${blocks === 1 ? '' : 's'} — pair up and alternate: one starts the first movement while the other works the second, then swap.`,
  ];
  if (n % 2 === 1) {
    parts.push(
      singles.length
        ? `Odd number tonight, so take ${singles.map((e) => e.block).join(' and ')} in threes.`
        : 'Odd number tonight, so one group of three rotates through their block.'
    );
  }
  return parts.join(' ');
}

// ── The catalogue and the fallback ────────────────────────────────────────

/**
 * Just the chosen groups, with the equipment on every line. The equipment is
 * what makes "never two of the same station in one block" a rule the model can
 * actually follow — and the reason the old prompt couldn't was that it shipped
 * all 93 exercises with no station information at all.
 */
export function catalogueFor(groups) {
  return (Array.isArray(groups) ? groups : [])
    .filter((g) => exerciseLibrary[g])
    .map((g) => `${g}:\n${exerciseLibrary[g].map((e) => `  - ${e.name} [${e.equipment}]`).join('\n')}`)
    .join('\n');
}

const toRow = (e, group) => ({
  muscleGroup: group,
  name: e.name,
  equipment: e.equipment,
  sets: e.defaultSets,
  reps: e.defaultReps,
  cue: e.cue,
  equipFilter: 'All',
});

/**
 * Draw exercises from the selected groups until there are `count` of them,
 * keeping whatever is already in `already` and never repeating a name.
 *
 * When people are training together it deliberately alternates stations as it
 * picks, because a run of six plate-loaded machines leaves `applyBlocks`
 * nothing legal to pair and every block collapses to a single.
 */
function pickFrom(groups, count, people, already) {
  const pools = (Array.isArray(groups) ? groups : [])
    .filter((g) => exerciseLibrary[g])
    .map((g) => exerciseLibrary[g].map((e) => toRow(e, g)));
  const picked = [...already];
  if (pools.length === 0) return picked;

  const used = new Set(picked.map((e) => e && e.name));
  const paired = Number(people) >= 2;

  let gi = 0;
  let guard = 0;
  while (picked.length < count && guard++ < 500) {
    if (!pools.some((p) => p.some((e) => !used.has(e.name)))) break;
    const pool = pools[gi++ % pools.length];
    const prev = paired ? picked[picked.length - 1] : null;
    let next = pool.find((e) => !used.has(e.name) && !stationClash(prev, e));
    if (!next) next = pool.find((e) => !used.has(e.name));
    if (!next) continue;
    used.add(next.name);
    picked.push(next);
  }
  return picked;
}

/**
 * Hold the model to the number of exercises it was asked for.
 *
 * Asking firmly is not enough — 4o-mini returned six when asked for five, and a
 * short answer is the worse failure of the two: publishing four exercises for a
 * 60-minute session is a session that does not match what was asked for. Extras
 * are trimmed by the caller; this tops a short list back up from the same
 * groups.
 */
export function fillToCount(list, groups, count, people) {
  const start = (Array.isArray(list) ? list : []).filter(Boolean);
  const want = Math.max(1, Number(count) || 5);
  const filled = pickFrom(groups, want, people, start);
  // Topping up invalidates the model's own pairing — it covered its list, not
  // this one — so drop its letters and let applyBlocks re-pair the whole thing.
  const items = filled.length > start.length ? filled.map(({ block, ...e }) => e) : filled;
  return applyBlocks(items, people);
}

/**
 * The offline draft. Draws from the SELECTED groups — the old template was
 * keyed on the session tag and would hand back chest/back/legs after the coach
 * asked for arms.
 */
export function buildFromSelection(groups, count, people) {
  return fillToCount([], groups, count, people);
}

/**
 * Remove a previously merged run note from a notes field.
 *
 * The run note is stored in the plan's `notes` so clients see it, which means a
 * draft that is reopened and regenerated would otherwise collect one line per
 * generate. Matching on the shape it is written in is enough — nothing a coach
 * types by hand starts "6 people, 3 blocks —".
 */
export function stripRunNote(notes) {
  return String(notes || '')
    .replace(/^\d+ people, \d+ blocks? —.*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

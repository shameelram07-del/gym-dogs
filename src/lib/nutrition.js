// Nutrition engine for Gym Dogs — MacroFactor-style adaptive targets.
//
// Pure functions only (no React, no fetch) so every bit of this is unit-testable.
//
// THE IDEA
// A formula like Mifflin-St Jeor guesses your burn from height/weight/age. It is
// wrong for most individuals by up to ~15%, and it can't see your job, your NEAT,
// or what your metabolism does when you diet. So the formula is only the seed.
// Once you have weigh-ins AND food logs, we stop guessing and start measuring:
//
//     expenditure = average intake - (change in trend weight x 7700) / days
//
// That's just conservation of energy. If you ate 2,400 kcal/day for three weeks
// and your trend weight fell 0.9 kg, you burned about 2,730 kcal/day, whatever a
// formula claims. Targets are then set from YOUR measured burn plus the rate you
// asked for, and they follow you as your metabolism shifts.
//
// Everything here is still an estimate, and the UI says so.

// ── Constants ─────────────────────────────────────────────────────────────

// kcal per kg of bodyweight change. 7,700 is the classic figure for fat tissue.
const ENERGY_PER_KG = 7700;

// Smoothing constant for the weight trend, in days. Scale weight swings 1-2 kg
// on water alone; a ~10 day time constant kills that noise while still turning
// within a couple of weeks of a real change.
const TREND_TAU_DAYS = 10;

// How far back the expenditure calculation looks, and the minimum evidence it
// needs before it will say anything at all.
const WINDOW_DAYS = 28;
const MIN_SPAN_DAYS = 10;      // weigh-ins must span at least this long
const MIN_COVERAGE = 0.6;      // fraction of window days that need a food log
const MIN_LOGGED_KCAL = 800;   // below this it's an abandoned log, not a real day

// Sanity rails. A measured burn wildly outside the formula means bad data
// (untracked weekends, a bad scale), not a miraculous metabolism.
const MEASURED_MIN_RATIO = 0.65;
const MEASURED_MAX_RATIO = 1.6;

// Clinical floors — this app has no dietitian in the loop.
const CALORIE_FLOOR = { male: 1500, female: 1200, other: 1350 };

// Fastest weekly change we'll let someone aim for, as a share of bodyweight.
const MAX_RATE_FRACTION = 0.01; // 1% per week

// ── Options the UI renders ────────────────────────────────────────────────

export const SEXES = [
  { id: 'male', label: 'Male' },
  { id: 'female', label: 'Female' },
  { id: 'nonbinary', label: 'Non-binary' },
  { id: 'prefer_not', label: 'Prefer not to say' },
];

export const ACTIVITY_LEVELS = [
  { id: 'sedentary', label: 'Barely move',       hint: 'Desk job, no training',        factor: 1.2 },
  { id: 'light',     label: 'Lightly active',    hint: 'Train 1–3 days a week',        factor: 1.375 },
  { id: 'moderate',  label: 'Moderately active', hint: 'Train 3–5 days a week',        factor: 1.55 },
  { id: 'high',      label: 'Very active',       hint: 'Train 6–7 days a week',        factor: 1.725 },
  { id: 'athlete',   label: 'Athlete',           hint: 'Physical job + daily training', factor: 1.9 },
];

// Weekly rate of change, in kg/week. Negative loses weight.
export const RATE_OPTIONS = [
  { id: 'lose_fast', label: 'Lose faster',  hint: '~0.75 kg a week', rate: -0.75 },
  { id: 'lose',      label: 'Lose fat',     hint: '~0.5 kg a week',  rate: -0.5 },
  { id: 'lose_slow', label: 'Lose slowly',  hint: '~0.25 kg a week', rate: -0.25 },
  { id: 'maintain',  label: 'Stay the same', hint: 'Hold weight, train hard', rate: 0 },
  { id: 'gain_slow', label: 'Lean bulk',    hint: '~0.2 kg a week',  rate: 0.2 },
  { id: 'gain',      label: 'Build muscle', hint: '~0.4 kg a week',  rate: 0.4 },
];

// Protein targets by direction of travel. Protein goes up in a deficit because
// that's when lean mass is at risk.
const PROTEIN_PER_KG = { lose: 2.2, maintain: 1.8, gain: 2.0 };

const LIMITS = { weight: [35, 250], height: [120, 220], age: [14, 90] };

const inRange = (v, [lo, hi]) => typeof v === 'number' && isFinite(v) && v >= lo && v <= hi;
const round = (n, step) => Math.round(n / step) * step;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

export const findActivity = (id) => ACTIVITY_LEVELS.find((a) => a.id === id) || ACTIVITY_LEVELS[2];
export const findRate = (id) => RATE_OPTIONS.find((r) => r.id === id) || RATE_OPTIONS[3];

// ── Dates ─────────────────────────────────────────────────────────────────

const DAY_MS = 86400000;
// Local calendar date, not UTC — see lib/day.js for why that matters here.
export const toISODate = (d) => {
  const date = new Date(d);
  if (isNaN(date)) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
const dayNumber = (iso) => Math.floor(new Date(`${iso}T00:00:00Z`).getTime() / DAY_MS);
const daysBetween = (a, b) => dayNumber(b) - dayNumber(a);

// ── Step 1: the formula seed ──────────────────────────────────────────────

// Mifflin-St Jeor resting metabolic rate (kcal/day). Non-binary / prefer-not-to-say
// take the midpoint of the two published constants rather than getting no number.
export function bmr({ weight, height, age, sex }) {
  if (!inRange(weight, LIMITS.weight) || !inRange(height, LIMITS.height) || !inRange(age, LIMITS.age)) return null;
  const constant = sex === 'male' ? 5 : sex === 'female' ? -161 : -78;
  return 10 * weight + 6.25 * height - 5 * age + constant;
}

// Formula expenditure = resting burn x activity multiplier.
export function formulaExpenditure(setup) {
  const b = bmr(setup);
  if (b === null) return null;
  return b * findActivity(setup.activity).factor;
}

// ── Step 2: the weight trend ──────────────────────────────────────────────

/**
 * Time-aware exponentially weighted moving average of scale weight.
 * Gaps are handled properly: two weigh-ins a fortnight apart don't get the same
 * weighting as two on consecutive days.
 * @param {{date:string, kg:number}[]} weighIns
 * @returns {{date:string, kg:number, trend:number}[]}
 */
export function weightTrend(weighIns) {
  const points = (Array.isArray(weighIns) ? weighIns : [])
    .filter((w) => w && w.date && isFinite(Number(w.kg)) && Number(w.kg) > 0)
    .map((w) => ({ date: w.date, kg: Number(w.kg) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  let trend = null;
  return points.map((p, i) => {
    if (i === 0) {
      trend = p.kg;
    } else {
      const dt = Math.max(1, daysBetween(points[i - 1].date, p.date));
      const alpha = 1 - Math.exp(-dt / TREND_TAU_DAYS);
      trend = trend + alpha * (p.kg - trend);
    }
    return { ...p, trend: Math.round(trend * 100) / 100 };
  });
}

// ── Step 3: measured expenditure ──────────────────────────────────────────

/**
 * Work out what someone actually burns, from energy balance.
 * @param {{date:string,kcal:number}[]} nutritionLog daily calorie rollups
 * @param {{date:string,kg:number}[]} weighIns
 * @param {string} [today] ISO date, for testability
 * @returns {{ok:boolean, reason?:string, expenditure?:number, meanIntake?:number,
 *            weightChange?:number, spanDays?:number, coverage?:number, loggedDays?:number}}
 */
export function measuredExpenditure(nutritionLog, weighIns, today) {
  const end = today || toISODate(new Date());
  const startDay = dayNumber(end) - WINDOW_DAYS;

  const trend = weightTrend(weighIns).filter((p) => dayNumber(p.date) >= startDay);
  if (trend.length < 2) return { ok: false, reason: 'need at least two weigh-ins in the last month' };

  const first = trend[0];
  const last = trend[trend.length - 1];
  const spanDays = daysBetween(first.date, last.date);
  if (spanDays < MIN_SPAN_DAYS) return { ok: false, reason: `weigh-ins only span ${spanDays} days` };

  // Only intake between the two weigh-ins counts — that's the period the weight
  // change actually describes.
  const inSpan = (Array.isArray(nutritionLog) ? nutritionLog : []).filter(
    (r) => r && r.date && r.date >= first.date && r.date <= last.date && Number(r.kcal) >= MIN_LOGGED_KCAL
  );
  const coverage = inSpan.length / spanDays;
  if (coverage < MIN_COVERAGE) {
    return { ok: false, reason: `only ${inSpan.length} of ${spanDays} days logged`, coverage };
  }

  const meanIntake = inSpan.reduce((s, r) => s + Number(r.kcal), 0) / inSpan.length;
  const weightChange = last.trend - first.trend;
  const expenditure = meanIntake - (weightChange * ENERGY_PER_KG) / spanDays;

  return {
    ok: true,
    expenditure,
    meanIntake,
    weightChange: Math.round(weightChange * 100) / 100,
    spanDays,
    coverage,
    loggedDays: inSpan.length,
  };
}

// ── Step 4: blend formula and measurement ─────────────────────────────────

/**
 * Early on we trust the formula; as evidence accumulates we hand over to the
 * measurement. This avoids the jarring "your target moved 400 kcal" that a hard
 * switch would cause on day 11.
 */
export function blendedExpenditure(setup, nutritionLog, weighIns, today) {
  const formula = formulaExpenditure(setup);
  const measured = measuredExpenditure(nutritionLog, weighIns, today);

  if (formula === null) return null;
  if (!measured.ok) {
    return { value: formula, source: 'formula', confidence: 0, formula, measured: null, reason: measured.reason };
  }

  // Guard against bad data producing an absurd burn.
  const capped = clamp(measured.expenditure, formula * MEASURED_MIN_RATIO, formula * MEASURED_MAX_RATIO);
  const wasCapped = Math.abs(capped - measured.expenditure) > 1;

  // Confidence grows with how long the window is and how completely it's logged.
  const spanWeight = clamp((measured.spanDays - MIN_SPAN_DAYS) / (WINDOW_DAYS - MIN_SPAN_DAYS), 0, 1);
  const coverWeight = clamp((measured.coverage - MIN_COVERAGE) / (0.95 - MIN_COVERAGE), 0, 1);
  const confidence = clamp(0.25 + 0.75 * spanWeight * coverWeight, 0, 1);

  return {
    value: formula * (1 - confidence) + capped * confidence,
    source: confidence > 0.5 ? 'measured' : 'blended',
    confidence,
    formula,
    measured: capped,
    rawMeasured: measured.expenditure,
    wasCapped,
    stats: measured,
  };
}

// ── Step 5: the daily targets ─────────────────────────────────────────────

/**
 * The number the app actually shows.
 * @param {object} setup {sex, age, height, weight, activity, rate}
 * @param {Array} nutritionLog
 * @param {Array} weighIns
 */
export function calculateTargets(setup, nutritionLog, weighIns, today) {
  const exp = blendedExpenditure(setup, nutritionLog, weighIns, today);
  if (!exp) return null;

  const rateOption = findRate(setup.rate);
  // Latest trend weight beats the number typed at setup — it's more current.
  const trend = weightTrend(weighIns);
  const currentWeight = trend.length ? trend[trend.length - 1].trend : setup.weight;

  // Cap the requested rate at 1% of bodyweight per week.
  const maxRate = currentWeight * MAX_RATE_FRACTION;
  const rate = clamp(rateOption.rate, -maxRate, maxRate);
  const rateCapped = Math.abs(rate - rateOption.rate) > 0.01;

  let calories = exp.value + (rate * ENERGY_PER_KG) / 7;

  const floor = CALORIE_FLOOR[setup.sex === 'male' || setup.sex === 'female' ? setup.sex : 'other'];
  const floored = calories < floor;
  if (floored) calories = floor;

  const direction = rate < -0.05 ? 'lose' : rate > 0.05 ? 'gain' : 'maintain';
  const protein = Math.min(PROTEIN_PER_KG[direction] * currentWeight, 250);
  const fat = Math.max((calories * 0.25) / 9, 0.6 * currentWeight);
  const carbs = Math.max((calories - protein * 4 - fat * 9) / 4, 0);
  // ~35 ml per kg, rounded to a friendly quarter-litre, held between 1.5 and 4 L.
  const waterMl = clamp(Math.round((currentWeight * 35) / 250) * 250, 1500, 4000);

  return {
    calories: round(calories, 10),
    protein: round(protein, 5),
    carbs: round(carbs, 5),
    fat: round(fat, 5),
    waterMl,
    expenditure: Math.round(exp.value),
    expenditureSource: exp.source,
    confidence: exp.confidence,
    formulaExpenditure: Math.round(exp.formula),
    measuredExpenditure: exp.measured === null ? null : Math.round(exp.measured),
    weeklyRate: Math.round(rate * 100) / 100,
    rateCapped,
    floored,
    currentWeight: Math.round(currentWeight * 10) / 10,
    reason: exp.reason || null,
    stats: exp.stats || null,
  };
}

// What the app shows before anyone has set anything up.
export const DEFAULT_TARGETS = { calories: 2200, protein: 160, carbs: 220, fat: 70, waterMl: 2500 };

// ── Daily log helpers ─────────────────────────────────────────────────────

/**
 * Which macros a set of logged items leaves genuinely unknown.
 *
 * A null macro means the food database had energy but no breakdown. It sums as
 * 0 because there's nothing else to add, but a day carrying one is NOT a
 * measured low-protein day and mustn't be read as one.
 */
export function unknownMacros(items) {
  const list = flattenEntries(items);
  return ['protein', 'carbs', 'fat'].filter((k) =>
    list.some((i) => i && (i[k] === null || i[k] === undefined))
  );
}

/** Roll a day's meals into the compact row stored in profile.nutritionLog. */
export function summariseDay(entry, date) {
  const items = flattenEntries(entry);
  const t = items.reduce(
    (a, i) => ({
      kcal: a.kcal + (Number(i.calories) || 0),
      p: a.p + (Number(i.protein) || 0),
      c: a.c + (Number(i.carbs) || 0),
      f: a.f + (Number(i.fat) || 0),
    }),
    { kcal: 0, p: 0, c: 0, f: 0 }
  );
  const row = { date, kcal: Math.round(t.kcal), p: Math.round(t.p), c: Math.round(t.c), f: Math.round(t.f) };
  // Only carried when there's actually a gap — these rows are kept for 180 days
  // inside one Cosmos document, so an always-present empty array is dead weight.
  const unknown = unknownMacros(items);
  if (unknown.length) row.unknown = unknown;
  return row;
}

/**
 * Accepts either the current flat array of items or the old
 * { breakfast: [], lunch: [], ... } shape, so days logged before the
 * meal buckets were dropped still read correctly.
 */
export function flattenEntries(entry) {
  if (Array.isArray(entry)) return entry;
  if (entry && typeof entry === 'object') return Object.values(entry).flat();
  return [];
}

/** Old logs counted glasses; one glass was 250 ml. */
export function migrateWater(nutrition) {
  if (!nutrition) return 0;
  if (typeof nutrition.waterMl === 'number') return nutrition.waterMl;
  if (typeof nutrition.water === 'number') return nutrition.water * 250;
  return 0;
}

/** Insert or replace today's row without disturbing history. */
export function upsertDay(log, row) {
  const rest = (Array.isArray(log) ? log : []).filter((r) => r && r.date !== row.date);
  return [...rest, row].sort((a, b) => String(a.date).localeCompare(String(b.date))).slice(-180);
}

/** How consistently someone has logged — drives the "log more" nudge. */
export function loggingStreak(log, today) {
  const end = today || toISODate(new Date());
  const dates = new Set((Array.isArray(log) ? log : []).filter((r) => Number(r.kcal) >= MIN_LOGGED_KCAL).map((r) => r.date));
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = toISODate(new Date((dayNumber(end) - i) * DAY_MS));
    if (dates.has(d)) streak++;
    else if (i > 0) break; // today not being logged yet shouldn't break the streak
  }
  const last14 = [...Array(14)].filter((_, i) => dates.has(toISODate(new Date((dayNumber(end) - i) * DAY_MS)))).length;
  return { streak, last14 };
}

// ── Coach note ────────────────────────────────────────────────────────────
// Both of these are pure and take the clock as an argument, so the note can be
// tested at 08:00 and 22:00 without touching the system time.

const MEAL_PHASES = [
  { until: 11, phase: 'morning' },
  { until: 15, phase: 'midday' },
  { until: 18, phase: 'afternoon' },
  { until: 22, phase: 'evening' },
];
export const phaseOfDay = (hour) => (MEAL_PHASES.find((p) => hour < p.until) || { phase: 'late night' }).phase;

// ── Slots ─────────────────────────────────────────────────────────────────
// Gym Daddy speaks at set moments rather than every time the day changes, so a
// note reads like a moment in the day instead of another running total. Three
// in-app slots, one note each, at most three model calls a day.
const SLOTS = [
  { from: 5,  until: 11, slot: 'morning' },
  { from: 11, until: 17, slot: 'midday' },
  { from: 17, until: 24, slot: 'evening' },
];
export const SLOT_ORDER = SLOTS.map((s) => s.slot);

/**
 * Which slot a local hour falls in, or null before 05:00 — those hours belong
 * to the evening that just finished, and generating a fourth note there would
 * describe yesterday's eating against today's blank day.
 * @param {number} hour local hour, 0-23
 * @returns {'morning'|'midday'|'evening'|null}
 */
export function slotFor(hour) {
  const h = Number(hour);
  if (!Number.isFinite(h)) return null;
  const found = SLOTS.find((s) => h >= s.from && h < s.until);
  return found ? found.slot : null;
}

/**
 * Today's cached slot notes, read tolerantly.
 *
 * Days cached before the slots existed stored one `coachNote` object for the
 * whole day. That is filed under the slot it was generated in rather than
 * thrown away, so nobody pays for a fresh call on their first load after this
 * ships.
 */
export function readCoachNotes(nutrition, today) {
  const n = nutrition || {};
  const notes = n.coachNotes;
  if (notes && notes.date === today && notes.slots && typeof notes.slots === 'object') {
    return { date: today, slots: { ...notes.slots } };
  }
  const single = n.coachNote;
  if (single && single.date === today) {
    const at = new Date(single.generatedAt || `${today}T12:00:00`);
    const slot = (!isNaN(at) && slotFor(at.getHours())) || 'evening';
    return { date: today, slots: { [slot]: { ...single, slot } } };
  }
  return { date: today, slots: {} };
}

/**
 * The most recent slot recorded today. A slot whose call failed is still a
 * recorded slot with empty text — the card then renders the deterministic
 * fallback for right now, which beats re-showing this morning's note at 8pm.
 */
export function latestSlotNote(notes) {
  const slots = (notes && notes.slots) || {};
  for (let i = SLOT_ORDER.length - 1; i >= 0; i--) {
    if (slots[SLOT_ORDER[i]]) return slots[SLOT_ORDER[i]];
  }
  return null;
}

// One line each, not three prompt builders. The slot changes the angle; the
// numbers, the history and the rules underneath it are identical.
const SLOT_BRIEF = {
  morning: 'THIS IS THE MORNING NOTE. The day has barely started, so look forward, not back: what the targets leave them to play with and what a good first move is. Do not summarise the day or judge it — there is not a day yet.',
  midday: 'THIS IS THE MIDDAY NOTE. A mid-course check: where they stand against the target with the afternoon and evening still to come, and whether anything needs steering now rather than at 9pm.',
  evening: 'THIS IS THE EVENING NOTE. The day is nearly done: what is left, and what would finish it well. If the numbers are already met, say the day is done and point at tomorrow instead of suggesting more food.',
};

// A day this far under target is worth flagging kindly, not celebrating.
const UNDEREATING_RATIO = 0.6;

/**
 * The deterministic read of the day. Used whenever the model is unavailable,
 * so the card is never empty and never shows an error.
 * @param {{calories:number,protein:number,carbs:number,fat:number}} eaten
 * @param {{calories:number,protein:number}} targets
 * @param {number} hour local hour, 0-23
 * @param {string[]} unknown macros the day has no figure for
 * @param {'morning'|'midday'|'evening'|null} [slot] defaults to the slot `hour` falls in
 * @returns {string}
 */
export function coachFallback(eaten, targets, hour, unknown = [], slot) {
  const kcal = Math.round(Number(eaten?.calories) || 0);
  const goal = Math.round(Number(targets?.calories) || 0);
  const p = Math.round(Number(eaten?.protein) || 0);
  const pGoal = Math.round(Number(targets?.protein) || 0);
  // Before 05:00 there is no slot; the evening wording is the closest fit.
  const moment = slot || slotFor(hour) || 'evening';

  if (kcal <= 0) return "Nothing logged yet. Add breakfast and I'll tell you how the day's shaping up.";

  const left = goal - kcal;
  const parts = [];

  // Same numbers, framed for the moment they're being read in.
  if (left < 0) parts.push(`${kcal} in — that's ${Math.abs(left)} over today's ${goal}.`);
  else if (moment === 'morning') parts.push(`${kcal} in, ${left} of ${goal} still to play with today.`);
  else if (moment === 'evening') parts.push(`${kcal} in, ${left} left of ${goal} to finish the day.`);
  else parts.push(`${kcal} in, ${left} left of ${goal}.`);

  // Protein is the macro worth naming; the others follow it around.
  // Unless something logged has no protein figure at all — then ${p} is a floor,
  // and calling it "the one to watch" would be inventing a shortfall.
  const proteinUnknown = (Array.isArray(unknown) ? unknown : []).includes('protein');
  if (pGoal > 0 && proteinUnknown) {
    parts.push(`Protein's at least ${p}g of ${pGoal}g — something you logged has no protein figure, so fill that in for a real read.`);
  } else if (pGoal > 0) {
    if (p >= pGoal) parts.push(`Protein's already there at ${p}g.`);
    else if (p < pGoal * 0.7) parts.push(`Protein's the one to watch: ${p}g of ${pGoal}g.`);
    else parts.push(`Protein's close — ${p}g of ${pGoal}g.`);
  }

  // Reassurance goes last, so it's the thought the sentence ends on rather than
  // something buried before a macro count.
  if (left < 0) parts.push('One day barely moves the weekly average, so carry on as normal tomorrow.');

  // Late and well short is undereating, not discipline.
  if (left > 0 && goal > 0 && kcal < goal * UNDEREATING_RATIO && hour >= 18) {
    parts.push("That's a fair way under for this time of day — worth eating a bit more tonight.");
  }

  return parts.join(' ');
}

/**
 * The prompt sent to the existing aiCoach endpoint. Kept pure and here rather
 * than in the page so the wording is reviewable in one place and the token
 * budget is easy to see: the item list is capped and history is daily totals
 * only, never raw items.
 */
export function buildCoachPrompt({ items, targets, expenditure, weeklyRate, expenditureSource, log, goalWeight, latestWeighIn, hour, today, slot }) {
  const eaten = summariseDay(items || [], today);
  const t = targets || {};
  const time = `${String(hour).padStart(2, '0')}:00`;

  // A macro the food database doesn't have goes to the model as '?', never 0.
  // Printing it as 0 is how the coach ended up calling a day low on protein
  // when the truth was that one food's protein was simply unknown.
  const m = (v) => (v === null || v === undefined ? '?' : Math.round(Number(v) || 0));
  const lines = (items || []).slice(0, 12).map((i) => {
    const at = i.at ? new Date(i.at) : null;
    const clock = at && !isNaN(at) ? `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}` : '—';
    return `  - ${i.name}, ${clock}, ${Math.round(Number(i.calories) || 0)} kcal, P${m(i.protein)} C${m(i.carbs)} F${m(i.fat)}`;
  });
  const gaps = unknownMacros(items || []);
  const more = (items || []).length > 12 ? `  - …and ${items.length - 12} more` : null;

  // Daily rollups only — a week of raw item lists would blow the token budget.
  const recent = (Array.isArray(log) ? log : [])
    .filter((r) => r && r.date && r.date < today)
    .slice(-7)
    .map((r) => `${r.date.slice(5)} ${Math.round(r.kcal)}kcal/${Math.round(r.p || 0)}g`)
    .join(', ');

  const sourceLabel = expenditureSource === 'formula'
    ? 'still a starting estimate from height/weight/age'
    : expenditureSource === 'blended' ? 'part measured, still learning' : 'measured from real intake and weight change';

  return [
    'You are Gym Daddy, the AI coach in a fitness app. Write 2 to 3 short sentences to the user about their eating today. Conversational, second person. No greeting, no sign-off, no markdown, no bullet points.',
    '',
    SLOT_BRIEF[slot || slotFor(hour) || 'evening'],
    '',
    `LOCAL TIME: ${time} (${phaseOfDay(hour)})`,
    `TODAY'S TARGET: ${t.calories} kcal, P${t.protein} C${t.carbs} F${t.fat}`,
    `EATEN SO FAR: ${eaten.kcal} kcal, P${eaten.p} C${eaten.c} F${eaten.f}`,
    ...lines,
    ...(more ? [more] : []),
    gaps.length
      ? `NOTE: a '?' above means the food database has no figure for that macro, so the ${gaps.join('/')} total is a floor, not a measurement. Do not tell the user they are short on something you cannot actually see — say the figure is missing and suggest filling it in.`
      : null,
    `DAILY BURN: ${expenditure} kcal (${sourceLabel}); aiming for ${weeklyRate > 0 ? '+' : ''}${weeklyRate} kg per week`,
    // "Logged", not "calendar" — a gap in logging shouldn't be presented as a
    // run of consecutive days.
    recent ? `LAST 7 LOGGED DAYS (kcal/protein): ${recent}` : 'LAST 7 LOGGED DAYS: not enough logged yet',
    goalWeight ? `GOAL WEIGHT: ${goalWeight} kg${latestWeighIn ? `, latest weigh-in ${latestWeighIn} kg` : ''}` : null,
    '',
    'What to cover, in this order:',
    '1. Read today against the target — what is on track, what is short, what is over. Protein is usually the interesting one.',
    '2. Put it in context of the last 7 days: a normal day, a light day, or a big one.',
    '3. Say one concrete, small thing that would help. "A yoghurt and you\'re there", not a lecture.',
    '',
    'Rules you must follow:',
    '- Never invent or prescribe calorie or macro targets beyond the ones given above. Describe what the numbers already say.',
    '- No moralising about food. Never use the words good, bad, clean or cheat about what they ate. No guilt for going over — one day does not matter, the seven-day average does.',
    '- Do not comment on their body or their weight beyond the goal they set themselves.',
    '- If today is very low on calories, say so kindly and suggest eating more. Never congratulate a large deficit.',
    // Only drop absent optional lines — '' entries are deliberate blank lines
    // separating the sections, and filter(Boolean) would eat them.
  ].filter((l) => l !== null && l !== undefined).join('\n');
}

// ── Setup form plumbing ───────────────────────────────────────────────────

// Pre-fill the setup form from what the profile already knows, so nobody is
// asked twice for something onboarding captured.
export function seedFromProfile(profile) {
  const p = profile || {};
  const saved = p.nutritionGoals || {};
  const days = p.onboarding && p.onboarding.days;
  const goals = (p.onboarding && p.onboarding.goals) || [];
  const trend = weightTrend(p.weighIns);
  const latestWeight = trend.length ? trend[trend.length - 1].kg : p.weight;

  const guessActivity = days === '5' ? 'high' : days === '4' ? 'moderate' : days === '3' ? 'moderate' : days === '2' ? 'light' : 'moderate';
  const guessRate = goals.includes('lose_fat') ? 'lose' : goals.includes('build_muscle') ? 'gain_slow' : 'maintain';

  const str = (v) => (v === null || v === undefined || v === '' ? '' : String(v));
  return {
    sex: saved.sex || (p.onboarding && p.onboarding.gender) || '',
    age: str(saved.age ?? p.age),
    height: str(saved.height ?? p.height),
    weight: str(saved.weight ?? latestWeight),
    activity: saved.activity || guessActivity,
    rate: saved.rate || guessRate,
  };
}

/** Turn string-y form state into numbers, or null if it isn't valid yet. */
export function parseSetupForm(form) {
  const n = (v) => {
    const x = parseFloat(v);
    return isFinite(x) ? x : null;
  };
  const out = {
    sex: form.sex || 'prefer_not',
    age: n(form.age),
    height: n(form.height),
    weight: n(form.weight),
    activity: form.activity,
    rate: form.rate,
  };
  if (!inRange(out.age, LIMITS.age) || !inRange(out.height, LIMITS.height) || !inRange(out.weight, LIMITS.weight)) return null;
  return out;
}

export const INPUT_LIMITS = LIMITS;
export const CONSTANTS = { ENERGY_PER_KG, TREND_TAU_DAYS, WINDOW_DAYS, MIN_SPAN_DAYS, MIN_COVERAGE, MIN_LOGGED_KCAL };

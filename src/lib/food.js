// Client helpers for the food database and the AI estimator.
//
// The API functions live behind function keys. If NEXT_PUBLIC_PROFILES_API_KEY
// happens to be a HOST key it already opens these too; otherwise set
// NEXT_PUBLIC_FOOD_API_KEY to a host key and this picks it up.
import { captureError } from '@/lib/monitoring';

const BASE = 'https://gymdogs-api-g9d0gve4angygdcj.newzealandnorth-01.azurewebsites.net/api';
const KEY = process.env.NEXT_PUBLIC_FOOD_API_KEY || process.env.NEXT_PUBLIC_PROFILES_API_KEY;

const headers = { 'Content-Type': 'application/json', 'x-functions-key': KEY };

async function getJson(url) {
  const res = await fetch(url, { headers: { 'x-functions-key': KEY } });
  if (!res.ok) throw new Error(`Lookup failed (${res.status})`);
  return res.json();
}

export async function lookupBarcode(barcode) {
  return getJson(`${BASE}/foodLookup?barcode=${encodeURIComponent(barcode)}`);
}

export async function searchFoods(q) {
  return getJson(`${BASE}/foodLookup?q=${encodeURIComponent(q)}`);
}

// A reasoning model can think for minutes, and the Function App gives up at five.
// Nobody stands in a kitchen that long — cut it off and say so plainly.
const AI_TIMEOUT_MS = 45000;

async function postAI(body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(`${BASE}/foodAI`, { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal });
  } catch (e) {
    if (e.name === 'AbortError') {
      // Deliberate: our own 45s cut-off firing, not a fault. The user is told
      // plainly and the timeout rate is a backend concern, not a frontend crash.
      throw new Error('That took too long — the AI model is being slow. Try again, or add it by hand.');
    }
    captureError(e, { screen: 'food', action: 'ai-request', endpoint: 'foodAI', mode: body.mode });
    throw new Error('Could not reach the AI. Check your connection.');
  } finally {
    clearTimeout(timer);
  }
  // Check the status BEFORE parsing. A timed-out or cold-starting Function App
  // returns a non-JSON body, and res.json() on that throws "Unexpected end of
  // JSON input" — hiding the real status behind a useless SyntaxError.
  if (!res.ok) {
    let detail = '';
    // Deliberate: an error body often isn't JSON at all. There's nothing to
    // report here — the status below is the real signal.
    try { detail = (await res.json()).error || ''; } catch (e) {}
    const err = new Error(detail || `AI failed (${res.status})`);
    captureError(err, { screen: 'food', action: 'ai-request', endpoint: 'foodAI', mode: body.mode, status: res.status });
    throw err;
  }
  try {
    return await res.json();
  } catch (e) {
    captureError(e, { screen: 'food', action: 'ai-parse', endpoint: 'foodAI', mode: body.mode, status: res.status });
    throw new Error('The AI sent back something unreadable. Try again.');
  }
}

// `userId` is not optional in spirit, only in signature: the backend costs an
// unattributed call to a shared "_anon" bucket, so leaving it off means the
// whole gym competes for one person's daily allowance. Pass it from wherever
// you have it.
export const aiFromText = (description, userId) => postAI({ mode: 'text', description, userId });
export const aiFromPhoto = (image, hint, userId) => postAI({ mode: 'photo', image, hint, userId });

// Reads a nutrition information panel and returns a per-100g item, same shape as
// a barcode hit — so it flows into the identical portion editor.
export const aiFromLabel = (image, userId) => postAI({ mode: 'label', image, userId });

// ── Portions ──────────────────────────────────────────────────────────────

export const MACROS = ['protein', 'carbs', 'fat'];

/**
 * Which macros this database entry genuinely doesn't have.
 *
 * The API sends a `missing` array, but the per-100g nulls are the underlying
 * truth and predate it — deriving from them as a fallback means this works
 * against an API that hasn't been redeployed yet.
 */
export function missingMacros(dbItem) {
  if (!dbItem) return [];
  if (Array.isArray(dbItem.missing)) return dbItem.missing.filter((k) => MACROS.includes(k));
  const p = dbItem.per100g || {};
  return MACROS.filter((k) => p[k] === null || p[k] === undefined);
}

/**
 * Database entries are per 100g. Turn one into an actual logged item.
 *
 * A macro the database doesn't have stays **null**, not 0 — `(x || 0) * f` was
 * turning "we don't know" into a confident zero that the day then summed and
 * the adaptive engine read as a measured low-protein day.
 *
 * `overrides` holds per-100g figures the user typed for the macros we're missing
 * (per 100g, not per portion, so they rescale with the portion like everything
 * else here). Blank entries are ignored and stay unknown.
 */
export function scaleToGrams(dbItem, grams, overrides = {}) {
  const g = Number(grams) || 0;
  const f = g / 100;
  const p = dbItem.per100g || {};
  // null/undefined in -> null out. A real 0 in the database is still a real 0.
  const scale = (v) => (v === null || v === undefined ? null : Math.round(Number(v) * f));
  const macro = (k) => {
    const typed = overrides[k];
    if (typed === '' || typed === null || typed === undefined) return scale(p[k]);
    const n = Number(typed);
    return isFinite(n) && n >= 0 ? Math.round(n * f) : scale(p[k]);
  };
  return {
    id: Date.now() + Math.random(),
    name: dbItem.brand ? `${dbItem.name} (${dbItem.brand})` : dbItem.name,
    grams: Math.round(g),
    barcode: dbItem.barcode || null,
    calories: scale(p.kcal) ?? 0,
    protein: macro('protein'),
    carbs: macro('carbs'),
    fat: macro('fat'),
  };
}

// A sensible default portion: the pack's stated serving if it has one, else 100g.
export const defaultGrams = (dbItem) => (dbItem && dbItem.servingGrams) || 100;

// ── Photos ────────────────────────────────────────────────────────────────

/**
 * Shrink a camera photo before it goes anywhere near the network.
 * Phone cameras produce 3-5MB files; the model only needs ~800px, and this
 * keeps the request small enough to survive a gym wifi connection.
 */
export function fileToCompressedDataUrl(file, maxDim = 800, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that image'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not decode that image'));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// ── Meals ─────────────────────────────────────────────────────────────────
// Cereal and milk is one thing you ate, not two. A meal entry carries its
// itemised breakdown in `components` so the day can show "Cereal & whole milk"
// on one line and still explain itself — and so a correction has something to
// work from. It rides inside the existing nutritionLog JSON: no new API field.

/**
 * A macro field as a NUMBER — exported because the sheets need it too.
 *
 * Never parseInt: `parseInt('0.5')` is 0, so half a gram of fat logged as
 * nothing and 12.5 kcal logged as 12. Round at the call site, after this.
 */
export const num = (v) => (isFinite(Number(v)) ? Number(v) : 0);

/** Totals for a list of AI items. Summed raw, rounded once at the end. */
export function sumItems(items) {
  const list = Array.isArray(items) ? items : [];
  const t = list.reduce(
    (a, i) => ({
      calories: a.calories + num(i.calories),
      protein: a.protein + num(i.protein),
      carbs: a.carbs + num(i.carbs),
      fat: a.fat + num(i.fat),
      grams: a.grams + num(i.grams),
      anyGrams: a.anyGrams || i.grams != null,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, grams: 0, anyGrams: false }
  );
  const out = {
    calories: Math.round(t.calories),
    protein: Math.round(t.protein),
    carbs: Math.round(t.carbs),
    fat: Math.round(t.fat),
  };
  // Only claim a weight if at least one component actually had one — a partial
  // sum would read as the weight of the whole meal, which it isn't.
  if (t.anyGrams) out.grams = Math.round(t.grams);
  return out;
}

/** 'Cereal & whole milk', or 'Cereal, whole milk +1' once there are three. */
export function mealNameFrom(items) {
  const names = (Array.isArray(items) ? items : []).map((i) => String(i.name || '').trim()).filter(Boolean);
  if (names.length === 0) return 'Meal';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  return `${names[0]}, ${names[1]} +${names.length - 2}`;
}

/**
 * Plain English for the model: what's currently logged, plus what the user says
 * was wrong with it. Goes through the existing text mode — no new API mode.
 */
export function describeMealCorrection(components, correction) {
  const parts = (Array.isArray(components) ? components : []).map((i) => {
    const portion = i.portion || (i.grams != null ? `${i.grams} g` : null);
    const bits = [portion, `${Math.round(num(i.calories))} kcal`, `P${Math.round(num(i.protein))} C${Math.round(num(i.carbs))} F${Math.round(num(i.fat))}`]
      .filter(Boolean).join(', ');
    return `${i.name} (${bits})`;
  });
  return [
    `A meal of: ${parts.join('; ')}.`,
    `Correction from the user: ${String(correction).trim()}`,
    'Return the corrected items.',
  ].join('\n');
}

// ── Your own foods ────────────────────────────────────────────────────────
// A correction the user made becomes a first-class database entry for them. It
// outranks anything from Open Food Facts, because they measured it and we didn't.

export function toCustomFood(item) {
  const g = Number(item.grams);
  if (!isFinite(g) || g <= 0) return null;
  // An unknown macro stays unknown when it becomes one of your own foods —
  // baking it in as 0 would make the gap permanent and invisible.
  const per = (v) => (v === null || v === undefined ? null : Math.round(((Number(v) || 0) / g) * 100 * 10) / 10);
  return {
    id: `mine-${String(item.name).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    barcode: item.barcode || null,
    name: item.name,
    brand: null,
    image: null,
    servingGrams: Math.round(g),
    servingLabel: null,
    per100g: { kcal: Math.round(per(item.calories)), protein: per(item.protein), carbs: per(item.carbs), fat: per(item.fat) },
    source: 'Yours',
    mine: true,
  };
}

export function upsertCustomFood(list, food) {
  if (!food) return Array.isArray(list) ? list : [];
  const rest = (Array.isArray(list) ? list : []).filter((f) => f.id !== food.id);
  return [...rest, food].slice(-120);
}

/** Your foods first, matched loosely — this runs on every keystroke. */
export function searchCustomFoods(list, q) {
  const needle = String(q || '').trim().toLowerCase();
  if (!needle) return [];
  return (Array.isArray(list) ? list : []).filter((f) => String(f.name).toLowerCase().includes(needle)).slice(0, 6);
}

// ── Favourites ────────────────────────────────────────────────────────────

const sameFood = (a, b) => (a.barcode && b.barcode ? a.barcode === b.barcode : a.name === b.name);

export function toggleFavourite(list, item) {
  const arr = Array.isArray(list) ? list : [];
  const hit = arr.find((x) => sameFood(x, item));
  if (hit) return arr.filter((x) => !sameFood(x, item));
  // Store the per-100g source plus the portion actually used, so tapping a
  // favourite logs the same thing it logged last time.
  return [...arr, item].slice(-24);
}

export const isFavourite = (list, item) => (Array.isArray(list) ? list : []).some((x) => sameFood(x, item));

/** Most-used foods first — the app's own "smart history". */
export function recentFoods(list, limit = 12) {
  return (Array.isArray(list) ? list : []).slice(-limit).reverse();
}

export function pushRecent(list, item) {
  const arr = (Array.isArray(list) ? list : []).filter((x) => !sameFood(x, item));
  return [...arr, item].slice(-40);
}

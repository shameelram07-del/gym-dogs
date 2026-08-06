// Client helpers for the food database and the AI estimator.
//
// The API functions live behind function keys. If NEXT_PUBLIC_PROFILES_API_KEY
// happens to be a HOST key it already opens these too; otherwise set
// NEXT_PUBLIC_FOOD_API_KEY to a host key and this picks it up.
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
      throw new Error('That took too long — the AI model is being slow. Try again, or add it by hand.');
    }
    throw new Error('Could not reach the AI. Check your connection.');
  } finally {
    clearTimeout(timer);
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `AI failed (${res.status})`);
  return data;
}

export const aiFromText = (description) => postAI({ mode: 'text', description });
export const aiFromPhoto = (image, hint) => postAI({ mode: 'photo', image, hint });

// Reads a nutrition information panel and returns a per-100g item, same shape as
// a barcode hit — so it flows into the identical portion editor.
export const aiFromLabel = (image) => postAI({ mode: 'label', image });

// ── Portions ──────────────────────────────────────────────────────────────

// Database entries are per 100g. Turn one into an actual logged item.
export function scaleToGrams(dbItem, grams) {
  const g = Number(grams) || 0;
  const f = g / 100;
  const p = dbItem.per100g || {};
  return {
    id: Date.now() + Math.random(),
    name: dbItem.brand ? `${dbItem.name} (${dbItem.brand})` : dbItem.name,
    grams: Math.round(g),
    barcode: dbItem.barcode || null,
    calories: Math.round((p.kcal || 0) * f),
    protein: Math.round((p.protein || 0) * f),
    carbs: Math.round((p.carbs || 0) * f),
    fat: Math.round((p.fat || 0) * f),
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

// ── Your own foods ────────────────────────────────────────────────────────
// A correction the user made becomes a first-class database entry for them. It
// outranks anything from Open Food Facts, because they measured it and we didn't.

export function toCustomFood(item) {
  const g = Number(item.grams);
  if (!isFinite(g) || g <= 0) return null;
  const per = (v) => Math.round(((Number(v) || 0) / g) * 100 * 10) / 10;
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

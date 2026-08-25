'use client';

// The add-food sheet: Scan | Search | AI | Quick Add, with favourites on top.
//
// Logging food is the thing people do several times a day, so every path here is
// built to end in as few taps as possible: a favourite is one tap, a barcode is
// scan-and-confirm, and the AI paths drop straight into an editable list rather
// than committing numbers nobody checked.

import { useState, useEffect, useRef } from 'react';
import BarcodeScanner from './BarcodeScanner';
import {
  lookupBarcode, searchFoods, aiFromText, aiFromPhoto, aiFromLabel,
  scaleToGrams, defaultGrams, fileToCompressedDataUrl, missingMacros,
  toggleFavourite, isFavourite, recentFoods, searchCustomFoods,
  sumItems, mealNameFrom,
} from '@/lib/food';
import { captureError } from '@/lib/monitoring';

const TABS = [
  { id: 'search', label: 'Search', icon: '🔍' },
  { id: 'scan',   label: 'Scan',   icon: '▊▍' },
  { id: 'ai',     label: 'AI',     icon: '✨' },
  { id: 'quick',  label: 'Quick',  icon: '⚡' },
];

const eyebrow = { fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', color: 'var(--ink-3)', textTransform: 'uppercase', margin: 0 };
const field = {
  width: '100%', background: 'var(--soft)', border: '1px solid var(--line)', borderRadius: 12,
  padding: '13px 14px', color: 'var(--ink)', fontSize: 15, fontWeight: 600, outline: 'none', boxSizing: 'border-box',
};
const primaryBtn = (on = true) => ({
  padding: '14px 18px', borderRadius: 14, border: 'none',
  background: on ? 'var(--accent)' : 'var(--soft)', color: on ? 'var(--on-accent)' : 'var(--ink-3)',
  fontSize: 15, fontWeight: 800, cursor: on ? 'pointer' : 'not-allowed',
});

// An unknown macro reads as an em dash. Printing "P0" for something the food
// database simply doesn't carry is the whole bug this guards against.
const macroNum = (v) => (v === null || v === undefined ? '—' : v);
const macroLine = (i) => `${i.calories} kcal · P${macroNum(i.protein)} C${macroNum(i.carbs)} F${macroNum(i.fat)}`;

const MACRO_LABELS = { protein: 'Protein', carbs: 'Carbs', fat: 'Fat' };

/** 'protein and fat', 'protein, carbs and fat' — for a sentence, not a list. */
const macroWords = (keys) => {
  const w = keys.map((k) => MACRO_LABELS[k].toLowerCase());
  if (w.length <= 1) return w[0] || '';
  return `${w.slice(0, -1).join(', ')} and ${w[w.length - 1]}`;
};

// Shown after any AI call. Keeps model choice an observation rather than a belief.
function Perf({ perf }) {
  if (!perf || !perf.model) return null;
  return (
    <p style={{ margin: '10px 0 0', fontSize: 11.5, color: 'var(--ink-3)', letterSpacing: '0.02em' }}>
      {perf.model} &middot; {(perf.ms / 1000).toFixed(1)}s
    </p>
  );
}

function Spinner({ label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 2px', color: 'var(--ink-3)', fontSize: 14 }}>
      <span style={{ width: 16, height: 16, border: '2px solid var(--line)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'gdSpin .8s linear infinite', display: 'inline-block' }} />
      {label}
    </div>
  );
}

// An AI estimate can take most of a minute on a cold Function App. A bar that
// is visibly moving says "still working" in a way a static spinner doesn't.
function EstimateBar() {
  return (
    <div style={{ height: 6, background: 'var(--soft)', borderRadius: 999, overflow: 'hidden', marginTop: 4 }}>
      <div className="gd-shimbar" style={{ height: '100%', width: '100%', background: 'var(--grad-soft)', borderRadius: 999 }} />
    </div>
  );
}

// Row for a database result — tap to choose a portion.
function FoodRow({ item, onPick }) {
  const p = item.per100g || {};
  const gaps = missingMacros(item);
  return (
    <button onClick={() => onPick(item)} style={{
      display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', cursor: 'pointer',
      background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: '12px 14px',
    }}>
      {item.image
        ? <img src={item.image} alt="" style={{ width: 38, height: 38, borderRadius: 10, objectFit: 'cover', flexShrink: 0, background: 'var(--soft)' }} />
        : <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--soft)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🍽️</div>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {item.mine ? '★ Yours · ' : item.brand ? `${item.brand} · ` : ''}{Math.round(p.kcal)} kcal / 100g
        </div>
        {gaps.length > 0 && (
          <div style={{ fontSize: 11.5, color: 'var(--ember)', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            No {macroWords(gaps)} on record
          </div>
        )}
      </div>
      <span style={{ fontSize: 20, color: 'var(--accent-strong)', flexShrink: 0 }}>+</span>
    </button>
  );
}

export default function AddFoodSheet({ profile, userId, onAdd, onSaveFavourites, onClose }) {
  const [tab, setTab] = useState('search');
  const [scanning, setScanning] = useState(false);

  // search
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef();

  // portion editor
  const [picked, setPicked] = useState(null);
  const [grams, setGrams] = useState('100');
  // Per-100g figures the user types for macros the database is missing.
  const [macroEdits, setMacroEdits] = useState({});

  // ai
  const [aiText, setAiText] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiError, setAiError] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [fromPhoto, setFromPhoto] = useState(false); // did this result come from an image?
  const [mealName, setMealName] = useState(''); // editable name for "log as one meal"
  const [perf, setPerf] = useState(null);       // which model answered, and how fast
  const fileRef = useRef();
  const labelRef = useRef();

  // quick add
  const [quick, setQuick] = useState({ name: '', calories: '', protein: '', carbs: '', fat: '' });

  // Feedback. The sheet deliberately stays open so you can log a whole meal in
  // one visit — which means every add MUST confirm itself, or it reads as broken.
  const [added, setAdded] = useState([]);          // names, most recent last
  const [toast, setToast] = useState(null);
  const toastTimer = useRef();
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  function commit(item, { close } = {}) {
    onAdd(item);
    setAdded((a) => [...a, item.name]);
    setToast(item.name);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1800);
    if (navigator.vibrate) navigator.vibrate(18);
    // Drop the photo once it has produced something logged, so it can't quietly
    // attach itself to the next, unrelated estimate.
    setPhotoPreview(null);
    if (close) onClose();
  }

  // Pre-fill the meal name from whatever came back, but stop overwriting it the
  // moment the user starts typing their own.
  useEffect(() => {
    setMealName(aiResult && aiResult.items ? mealNameFrom(aiResult.items) : '');
  }, [aiResult]);

  const favourites = (profile && profile.foodFavourites) || [];
  const myFoods = searchCustomFoods((profile && profile.foodCustom) || [], q);

  // Debounced search — Open Food Facts rate-limits search hard, so don't fire per keystroke.
  useEffect(() => {
    clearTimeout(searchTimer.current);
    if (q.trim().length < 2) { setResults(null); setSearching(false); return; }
    setSearching(true);
    // The cleanup cancels the timer, but not a request already in flight. Without
    // this flag a slow response for an earlier query lands after a newer one and
    // replaces the right results with stale ones.
    let cancelled = false;
    searchTimer.current = setTimeout(async () => {
      try {
        const data = await searchFoods(q.trim());
        if (cancelled) return;
        setResults(data.items || []);
      } catch (e) {
        if (cancelled) return;
        // Shows as "nothing found", which is a lie when the lookup broke.
        // The query is the user's own words, so it stays out of the report.
        setResults([]);
        captureError(e, { screen: 'food', action: 'search', endpoint: 'foodLookup' });
      } finally { if (!cancelled) setSearching(false); }
    }, 450);
    return () => { cancelled = true; clearTimeout(searchTimer.current); };
  }, [q]);

  function pick(item) {
    setPicked(item);
    setGrams(String(defaultGrams(item)));
    setMacroEdits({});   // last product's typed macros must not leak into this one
  }

  function confirmPortion() {
    commit(scaleToGrams(picked, grams, macroEdits));
    setPicked(null);
    setMacroEdits({});
  }

  async function onBarcode(code) {
    setScanning(false);
    if (!code) return;
    setTab('scan');
    setAiError(null);
    setAiBusy(true);
    try {
      const data = await lookupBarcode(code);
      setAiBusy(false);
      if (data.found) { pick(data.item); return; }
      // Not in the database is the COMMON case for NZ products, not an error —
      // so say so plainly and point at the label scanner sitting right there.
      setAiError(`Barcode ${code} isn't in the food database. Photograph the nutrition panel instead — that works for anything.`);
    } catch (e) {
      setAiBusy(false);
      setAiError(`Couldn't reach the food database. Photograph the nutrition panel instead, or add it by hand.`);
      // A barcode simply not being in the database is handled above and is not
      // an error — this branch is the lookup itself failing.
      captureError(e, { screen: 'food', action: 'barcode-lookup', endpoint: 'foodLookup' });
    }
  }

  // The scanner handed us a frame of the nutrition panel. Read it, then drop the
  // result into the exact same portion editor a barcode hit would use.
  async function onLabelShot(dataUrl) {
    setScanning(false);
    setTab('search');
    setAiError(null);
    setSearching(true);
    try {
      const data = await aiFromLabel(dataUrl, userId);
      setSearching(false);
      setPerf(data.item ? { model: data.item.model, ms: data.item.ms } : null);
      if (data.found) {
        pick(data.item);
        if (data.confidence === 'low') setAiError('That was hard to read — check the numbers before you add it.');
      } else {
        setAiError(data.note || 'Could not read a nutrition panel there. Try filling the frame with just the panel.');
      }
    } catch (e) {
      setSearching(false);
      setAiError(e.message);
      captureError(e, { screen: 'food', action: 'label-scan', endpoint: 'foodAI' });
    }
  }

  // One button, one action. If a photo is attached it IS the subject, and the
  // typed text becomes the hint ("30g of this") rather than being sent alone —
  // sending the text by itself is what produced "no specific food item was
  // provided" while the photo sat on screen.
  async function runAiText() {
    const hint = aiText.trim();
    if (!hint && !photoPreview) return;
    setAiBusy(true); setAiError(null); setAiResult(null);
    setFromPhoto(!!photoPreview);
    try {
      const r = photoPreview
        ? await aiFromPhoto(photoPreview, hint || undefined, userId)
        : await aiFromText(hint, userId);
      setAiResult(r);
      setPerf({ model: r.model, ms: r.ms });
    }
    catch (e) {
      setAiError(e.message);
      // Which path was taken matters; what they typed or photographed does not.
      captureError(e, { screen: 'food', action: 'ai-estimate', endpoint: 'foodAI', fromPhoto: !!photoPreview });
    }
    finally { setAiBusy(false); }
  }

  async function onLabelFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setAiBusy(true); setAiError(null);
    try {
      // Bigger than a meal photo: nutrition print is small and needs the pixels.
      const dataUrl = await fileToCompressedDataUrl(file, 1100, 0.8);
      const data = await aiFromLabel(dataUrl, userId);
      setPerf(data.item ? { model: data.item.model, ms: data.item.ms } : null);
      if (data.found) {
        pick(data.item);
        if (data.confidence === 'low') setAiError('That was hard to read — check the numbers before you add it.');
      } else {
        setAiError(data.note || 'Could not read a nutrition panel there.');
      }
    } catch (err) {
      setAiError(err.message);
      captureError(err, { screen: 'food', action: 'label-photo', endpoint: 'foodAI' });
    } finally {
      setAiBusy(false);
      e.target.value = '';
    }
  }

  // Picking a photo only attaches it. Estimate is what sends it — otherwise
  // there are two ways to start a call and the typed hint gets left behind.
  async function onPhoto(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setAiBusy(true); setAiError(null); setAiResult(null);
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      setPhotoPreview(dataUrl);
    } catch (err) {
      setAiError(err.message);
      // The image never leaves the device — only the fact it wouldn't decode.
      captureError(err, { screen: 'food', action: 'compress-photo' });
    } finally {
      setAiBusy(false);
      e.target.value = ''; // let the same file be picked again
    }
  }

  const quickValid = quick.name.trim() && quick.calories !== '';

  // Worked out once per render rather than four times inside the JSX, so the
  // preview, the favourite button and what actually gets logged can't disagree.
  const pickedGaps = picked ? missingMacros(picked) : [];
  const preview = picked ? scaleToGrams(picked, grams, macroEdits) : null;

  return (
    <>
      {scanning && <BarcodeScanner onDetected={onBarcode} onLabel={onLabelShot} onClose={() => setScanning(false)} />}

      <div style={{ position: 'fixed', inset: 0, zIndex: 320, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
           onClick={onClose}>
        <div onClick={(e) => e.stopPropagation()} style={{
          background: 'var(--card)', borderTopLeftRadius: 26, borderTopRightRadius: 26,
          width: '100%', maxWidth: 480, height: '88vh', display: 'flex', flexDirection: 'column', position: 'relative',
        }}>
          {/* Handle + title */}
          <div style={{ padding: '12px 20px 0', flexShrink: 0 }}>
            <div style={{ width: 38, height: 4, background: 'var(--line)', borderRadius: 999, margin: '0 auto 14px' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <h3 className="gd-disp" style={{ fontSize: 19, fontWeight: 800, margin: 0 }}>Add food</h3>
                {added.length > 0 && (
                  <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--accent-strong)', fontWeight: 600 }}>
                    {added.length} added &mdash; keep going or tap Done
                  </p>
                )}
              </div>
              {added.length > 0
                ? <button onClick={onClose} style={{ background: 'var(--accent)', border: 'none', color: 'var(--on-accent)', padding: '9px 16px', borderRadius: 999, fontSize: 14, fontWeight: 800, cursor: 'pointer', flexShrink: 0 }}>Done</button>
                : <button onClick={onClose} aria-label="Close" style={{ background: 'var(--soft)', border: 'none', color: 'var(--ink-2)', width: 32, height: 32, borderRadius: '50%', fontSize: 18, cursor: 'pointer', flexShrink: 0 }}>×</button>}
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, padding: '14px 20px 0', flexShrink: 0 }}>
            {TABS.map((t) => {
              const on = tab === t.id;
              return (
                <button key={t.id} onClick={() => { setTab(t.id); if (t.id === 'scan') setScanning(true); }} style={{
                  flex: 1, padding: '10px 4px', borderRadius: 12, cursor: 'pointer', border: 'none',
                  background: on ? 'var(--accent-tint)' : 'transparent',
                  color: on ? 'var(--accent-strong)' : 'var(--ink-3)', fontSize: 12.5, fontWeight: 700,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                }}>
                  <span style={{ fontSize: 14 }}>{t.icon}</span>{t.label}
                </button>
              );
            })}
          </div>

          {/* Confirmation — sits above the body so it's visible from any tab */}
          {toast && (
            <div style={{
              position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: 'calc(24px + env(safe-area-inset-bottom))',
              background: 'var(--accent)', color: 'var(--on-accent)', padding: '11px 18px', borderRadius: 999,
              fontSize: 14, fontWeight: 700, boxShadow: '0 12px 30px -10px rgba(0,0,0,0.5)', zIndex: 5,
              maxWidth: '84%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              animation: 'gdRise .25s ease',
            }}>
              ✓ {toast}
            </div>
          )}

          {/* Body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px calc(20px + env(safe-area-inset-bottom))' }}>

            {/* Favourites — always visible, one tap to log */}
            {favourites.length > 0 && !picked && (
              <div style={{ marginBottom: 18 }}>
                <p style={{ ...eyebrow, marginBottom: 9 }}>Favourites</p>
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                  {favourites.map((fav, i) => (
                    <button key={i} onClick={() => commit({ ...fav, id: Date.now() + Math.random() })} style={{
                      flexShrink: 0, background: 'var(--soft)', border: '1px solid var(--line)', borderRadius: 14,
                      padding: '9px 13px', cursor: 'pointer', textAlign: 'left', maxWidth: 160,
                    }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fav.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 1 }}>{fav.calories} kcal</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── PORTION EDITOR ── */}
            {picked && (
              <div>
                <button onClick={() => setPicked(null)} style={{ background: 'none', border: 'none', color: 'var(--ink-3)', fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: 0, marginBottom: 12 }}>← Back</button>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
                  {picked.image && <img src={picked.image} alt="" style={{ width: 52, height: 52, borderRadius: 12, objectFit: 'cover', background: 'var(--soft)' }} />}
                  <div style={{ minWidth: 0 }}>
                    <div className="gd-disp" style={{ fontSize: 17, fontWeight: 800 }}>{picked.name}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2 }}>
                      {picked.brand ? `${picked.brand} · ` : ''}{picked.source}
                    </div>
                  </div>
                </div>

                <p style={{ ...eyebrow, marginBottom: 7 }}>How much?</p>
                <div style={{ position: 'relative', marginBottom: 10 }}>
                  <input type="number" inputMode="decimal" value={grams} onChange={(e) => setGrams(e.target.value)} autoFocus
                    style={{ ...field, fontSize: 22, fontWeight: 800, padding: '16px 44px 16px 14px', fontFamily: 'var(--font-display), inherit' }} />
                  <span style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 13, fontWeight: 700, color: 'var(--ink-3)' }}>g</span>
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
                  {[picked.servingGrams, 30, 50, 100, 150, 200].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).map((g) => (
                    <button key={g} onClick={() => setGrams(String(g))} style={{
                      padding: '7px 12px', borderRadius: 999, cursor: 'pointer', fontSize: 12.5, fontWeight: 700,
                      border: `1px solid ${String(g) === grams ? 'var(--accent)' : 'var(--line)'}`,
                      background: String(g) === grams ? 'var(--accent-tint)' : 'var(--soft)',
                      color: String(g) === grams ? 'var(--accent-strong)' : 'var(--ink-2)',
                    }}>{g}g{picked.servingGrams === g ? ' · serving' : ''}</button>
                  ))}
                </div>

                {/* Macros Open Food Facts doesn't carry. Editable, per 100g so
                    they rescale with the portion, and left unknown if blank. */}
                {pickedGaps.length > 0 && (
                  <div style={{ border: '1px solid var(--line)', borderRadius: 16, padding: 14, marginBottom: 18 }}>
                    <p style={{ ...eyebrow, color: 'var(--ember)', marginBottom: 4 }}>Not in the database</p>
                    <p style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.45 }}>
                      This product has no {macroWords(pickedGaps)} on record. Read it off the pack if you can &mdash;
                      leave it blank and it stays unknown rather than counting as zero.
                    </p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {pickedGaps.map((k) => (
                        <div key={k} style={{ flex: 1, minWidth: 0 }}>
                          <label htmlFor={`macro-${k}`} style={{ ...eyebrow, display: 'block', marginBottom: 5 }}>{MACRO_LABELS[k]}</label>
                          <input
                            id={`macro-${k}`}
                            type="number"
                            inputMode="decimal"
                            placeholder="—"
                            value={macroEdits[k] ?? ''}
                            onChange={(e) => setMacroEdits((m) => ({ ...m, [k]: e.target.value }))}
                            style={{ ...field, padding: '11px 12px', fontSize: 15 }}
                          />
                          <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>g per 100g</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ background: 'var(--soft)', borderRadius: 16, padding: 16, marginBottom: 18, textAlign: 'center' }}>
                  <div className="gd-disp" style={{ fontSize: 28, fontWeight: 800 }}>{preview.calories}<span style={{ fontSize: 13, color: 'var(--ink-3)', marginLeft: 4 }}>kcal</span></div>
                  <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 4 }}>{macroLine(preview)}</div>
                </div>

                <Perf perf={perf} />

                <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                  <button onClick={() => onSaveFavourites(toggleFavourite(favourites, preview))} style={{
                    padding: '14px 16px', borderRadius: 14, border: '1px solid var(--line)', background: 'var(--soft)',
                    color: isFavourite(favourites, preview) ? 'var(--gold)' : 'var(--ink-2)',
                    fontSize: 18, cursor: 'pointer',
                  }}>★</button>
                  <button onClick={confirmPortion} style={{ ...primaryBtn(true), flex: 1 }}>Add it</button>
                </div>
              </div>
            )}

            {/* ── SEARCH ── */}
            {!picked && tab === 'search' && (
              <div>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search foods…" autoFocus style={field} />
                {aiError && <p style={{ margin: '12px 0 0', fontSize: 13.5, color: 'var(--orange-ink)', lineHeight: 1.5 }}>{aiError}</p>}
                {searching && <Spinner label="Searching…" />}
                {!searching && results && results.length === 0 && (
                  <p style={{ margin: '18px 0 0', fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.6 }}>
                    Nothing found. Try the <strong>AI</strong> tab and just describe it &mdash; that works for home cooking and takeaways.
                  </p>
                )}
                {myFoods.length > 0 && (
                  <>
                    <p style={{ ...eyebrow, margin: '18px 0 9px' }}>Your foods</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {myFoods.map((item) => <FoodRow key={item.id} item={item} onPick={pick} />)}
                    </div>
                  </>
                )}
                {results && results.length > 0 && myFoods.length > 0 && (
                  <p style={{ ...eyebrow, margin: '18px 0 9px' }}>Food database</p>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: myFoods.length ? 0 : 12 }}>
                  {(results || []).map((item) => <FoodRow key={item.id} item={item} onPick={pick} />)}
                </div>
                {!results && !searching && recentFoods(profile && profile.foodRecent).length > 0 && (
                  <>
                    <p style={{ ...eyebrow, margin: '20px 0 9px' }}>Recent</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {recentFoods(profile && profile.foodRecent).map((r, i) => (
                        <button key={i} onClick={() => commit({ ...r, id: Date.now() + Math.random() })} style={{
                          display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', cursor: 'pointer',
                          background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: '12px 14px',
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
                            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{macroLine(r)}</div>
                          </div>
                          <span style={{ fontSize: 20, color: 'var(--accent-strong)' }}>+</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── SCAN (the camera itself is an overlay) ── */}
            {!picked && tab === 'scan' && !scanning && (
              <div style={{ padding: '10px 0' }}>
                <button onClick={() => setScanning(true)} style={{
                  width: '100%', textAlign: 'left', cursor: 'pointer', background: 'var(--card)',
                  border: '1px solid var(--line)', borderRadius: 18, padding: 18, display: 'flex', gap: 14, alignItems: 'center',
                }}>
                  <span style={{ fontSize: 26 }}>▊▍▊</span>
                  <span>
                    <span style={{ display: 'block', fontSize: 15.5, fontWeight: 700 }}>Scan the barcode</span>
                    <span style={{ display: 'block', fontSize: 12.5, color: 'var(--ink-3)', marginTop: 3, lineHeight: 1.5 }}>
                      Fastest when the product is in the database.
                    </span>
                  </span>
                </button>

                <button onClick={() => labelRef.current && labelRef.current.click()} style={{
                  width: '100%', textAlign: 'left', cursor: 'pointer', background: 'var(--card)',
                  border: '1px solid var(--line)', borderRadius: 18, padding: 18, display: 'flex', gap: 14, alignItems: 'center', marginTop: 10,
                }}>
                  <span style={{ fontSize: 26 }}>📄</span>
                  <span>
                    <span style={{ display: 'block', fontSize: 15.5, fontWeight: 700 }}>Photograph the label</span>
                    <span style={{ display: 'block', fontSize: 12.5, color: 'var(--ink-3)', marginTop: 3, lineHeight: 1.5 }}>
                      Reads the nutrition panel directly. Works for anything, even if it&rsquo;s not in the database.
                    </span>
                  </span>
                </button>
                <input ref={labelRef} type="file" accept="image/*" onChange={onLabelFile} style={{ display: 'none' }} />

                {aiBusy && <Spinner label="Looking it up…" />}
                {aiError && (
                  <div style={{ marginTop: 14, background: 'var(--soft)', border: '1px solid var(--line)', borderRadius: 14, padding: 14 }}>
                    <p style={{ margin: 0, fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.55 }}>{aiError}</p>
                  </div>
                )}

                <p style={{ margin: '18px 0 0', fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.6 }}>
                  Barcode not found? Photograph the panel on the back instead &mdash; get it square on and filling the frame.
                </p>
              </div>
            )}

            {/* ── AI ── */}
            {!picked && tab === 'ai' && (
              <div>
                <input value={aiText} onChange={(e) => setAiText(e.target.value)}
                  placeholder="e.g. chicken rice bowl and a flat white" style={field} />
                <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                  <button onClick={runAiText} disabled={(!aiText.trim() && !photoPreview) || aiBusy}
                    style={{ ...primaryBtn((!!aiText.trim() || !!photoPreview) && !aiBusy), flex: 1 }}>
                    {photoPreview ? 'Estimate photo' : 'Estimate'}
                  </button>
                  <button onClick={() => fileRef.current && fileRef.current.click()} disabled={aiBusy} style={{
                    padding: '14px 18px', borderRadius: 14, border: '1px solid var(--line)', background: 'var(--soft)',
                    color: 'var(--ink-2)', fontSize: 15, fontWeight: 700, cursor: 'pointer',
                  }}>📷 Photo</button>
                </div>
                <input ref={fileRef} type="file" accept="image/*" onChange={onPhoto} style={{ display: 'none' }} />

                {photoPreview && (
                  <div style={{ position: 'relative', marginTop: 14 }}>
                    <img src={photoPreview} alt="" style={{ width: '100%', borderRadius: 16, maxHeight: 200, objectFit: 'cover', display: 'block' }} />
                    <button onClick={() => setPhotoPreview(null)} aria-label="Remove photo" style={{
                      position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: '50%', border: 'none',
                      background: 'rgba(0,0,0,0.62)', color: '#fff', fontSize: 17, lineHeight: 1, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>×</button>
                  </div>
                )}
                {aiBusy && <><Spinner label="Working it out…" /><EstimateBar /></>}
                {aiError && <p style={{ margin: '14px 0 0', fontSize: 13.5, color: 'var(--orange-ink)', lineHeight: 1.5 }}>{aiError}</p>}

                {aiResult && (
                  <div style={{ marginTop: 16 }}>
                    {aiResult.items.length === 0 ? (
                      <p style={{ fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.6 }}>{aiResult.note || 'Could not spot any food there.'}</p>
                    ) : (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
                          <p style={eyebrow}>Estimate</p>
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999,
                            background: aiResult.confidence === 'high' ? 'var(--accent-tint)' : 'var(--soft)',
                            color: aiResult.confidence === 'high' ? 'var(--accent-strong)' : 'var(--ink-3)',
                          }}>{aiResult.confidence} confidence</span>
                        </div>
                        {/* What the model saw, as a read-only breakdown. It gets
                            logged as ONE entry — the ingredients ride inside it
                            in `components`, so the day stays one line per meal
                            and a correction still has something to work from. */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {aiResult.items.map((it, i) => (
                            <div key={i} style={{
                              display: 'flex', alignItems: 'center', gap: 12, borderRadius: 14, padding: '12px 14px',
                              background: 'var(--card)', border: '1px solid var(--line)',
                            }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 14.5, fontWeight: 700 }}>{it.name}</div>
                                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
                                  {it.portion ? `${it.portion} · ` : ''}{macroLine(it)}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {aiResult.items.length >= 2 && (
                          <div style={{ marginTop: 14 }}>
                            <p style={{ ...eyebrow, marginBottom: 7 }}>Call this meal</p>
                            <input value={mealName} onChange={(e) => setMealName(e.target.value)}
                              placeholder={mealNameFrom(aiResult.items)} style={field} />
                          </div>
                        )}

                        <button onClick={() => {
                          const totals = sumItems(aiResult.items);
                          const single = aiResult.items.length === 1;
                          commit({
                            // A single item is already one line — it doesn't need
                            // wrapping in a components array to say so.
                            ...(single ? aiResult.items[0] : null),
                            id: Date.now() + Math.random(),
                            name: single
                              ? aiResult.items[0].name
                              : (mealName.trim() || mealNameFrom(aiResult.items)),
                            ...totals,
                            ...(single ? {} : { components: aiResult.items }),
                          }, { close: true });
                        }} style={{ ...primaryBtn(true), width: '100%', marginTop: aiResult.items.length >= 2 ? 10 : 12 }}>
                          {aiResult.items.length >= 2 ? 'Log as one meal' : 'Log it'} &middot; {sumItems(aiResult.items).calories} kcal
                        </button>
                        {/* A photo the model struggled with is often a nutrition
                            panel, which has a far better path. Point at it —
                            don't reroute, the guess might be right. */}
                        {fromPhoto && aiResult.confidence === 'low' && (
                          <p style={{ margin: '12px 0 0', fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>
                            Was that a nutrition label? <strong>Scan &rarr; Photograph the label</strong> reads the panel properly.
                          </p>
                        )}
                        <p style={{ margin: '12px 0 0', fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5 }}>
                          {aiResult.note ? `${aiResult.note} ` : ''}These are estimates &mdash; tap anything in your day to correct it, and I&rsquo;ll remember.
                          {aiResult.reconciled > 0 && ` I corrected the calorie figure on ${aiResult.reconciled} of these to match their own macros.`}
                        </p>
                        <Perf perf={perf} />
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── QUICK ADD ── */}
            {!picked && tab === 'quick' && (
              <div>
                <p style={{ margin: '0 0 12px', fontSize: 13.5, color: 'var(--ink-3)', lineHeight: 1.5 }}>
                  Already know the numbers? Punch them straight in.
                </p>
                <input value={quick.name} onChange={(e) => setQuick((s) => ({ ...s, name: e.target.value }))} placeholder="What was it?" style={{ ...field, marginBottom: 12 }} />
                <p style={{ ...eyebrow, marginBottom: 6 }}>Calories</p>
                <input type="number" inputMode="numeric" value={quick.calories} onChange={(e) => setQuick((s) => ({ ...s, calories: e.target.value }))} placeholder="kcal" style={{ ...field, marginBottom: 12 }} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 18 }}>
                  {[['protein', 'Protein'], ['carbs', 'Carbs'], ['fat', 'Fat']].map(([k, label]) => (
                    <div key={k}>
                      <p style={{ ...eyebrow, marginBottom: 6 }}>{label}</p>
                      <input type="number" inputMode="numeric" value={quick[k]} onChange={(e) => setQuick((s) => ({ ...s, [k]: e.target.value }))} placeholder="g" style={{ ...field, textAlign: 'center' }} />
                    </div>
                  ))}
                </div>
                <button disabled={!quickValid} onClick={() => {
                  commit({
                    id: Date.now(), name: quick.name.trim(),
                    calories: parseInt(quick.calories) || 0, protein: parseInt(quick.protein) || 0,
                    carbs: parseInt(quick.carbs) || 0, fat: parseInt(quick.fat) || 0,
                  });
                  setQuick({ name: '', calories: '', protein: '', carbs: '', fat: '' });
                }} style={{ ...primaryBtn(quickValid), width: '100%' }}>Add it</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

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
  scaleToGrams, defaultGrams, fileToCompressedDataUrl,
  toggleFavourite, isFavourite, recentFoods,
} from '@/lib/food';

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

const macroLine = (i) => `${i.calories} kcal · P${i.protein} C${i.carbs} F${i.fat}`;

function Spinner({ label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 2px', color: 'var(--ink-3)', fontSize: 14 }}>
      <span style={{ width: 16, height: 16, border: '2px solid var(--line)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'gdSpin .8s linear infinite', display: 'inline-block' }} />
      {label}
    </div>
  );
}

// Row for a database result — tap to choose a portion.
function FoodRow({ item, onPick }) {
  const p = item.per100g || {};
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
          {item.brand ? `${item.brand} · ` : ''}{Math.round(p.kcal)} kcal / 100g
        </div>
      </div>
      <span style={{ fontSize: 20, color: 'var(--accent-strong)', flexShrink: 0 }}>+</span>
    </button>
  );
}

export default function AddFoodSheet({ mealLabel, profile, onAdd, onSaveFavourites, onClose }) {
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

  // ai
  const [aiText, setAiText] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiError, setAiError] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const fileRef = useRef();
  const labelRef = useRef();

  // quick add
  const [quick, setQuick] = useState({ name: '', calories: '', protein: '', carbs: '', fat: '' });

  const favourites = (profile && profile.foodFavourites) || [];

  // Debounced search — Open Food Facts rate-limits search hard, so don't fire per keystroke.
  useEffect(() => {
    clearTimeout(searchTimer.current);
    if (q.trim().length < 2) { setResults(null); setSearching(false); return; }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const data = await searchFoods(q.trim());
        setResults(data.items || []);
      } catch (e) {
        setResults([]);
      } finally { setSearching(false); }
    }, 450);
    return () => clearTimeout(searchTimer.current);
  }, [q]);

  function pick(item) {
    setPicked(item);
    setGrams(String(defaultGrams(item)));
  }

  function confirmPortion() {
    const item = scaleToGrams(picked, grams);
    onAdd(item);
    setPicked(null);
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
      const data = await aiFromLabel(dataUrl);
      setSearching(false);
      if (data.found) {
        pick(data.item);
        if (data.confidence === 'low') setAiError('That was hard to read — check the numbers before you add it.');
      } else {
        setAiError(data.note || 'Could not read a nutrition panel there. Try filling the frame with just the panel.');
      }
    } catch (e) {
      setSearching(false);
      setAiError(e.message);
    }
  }

  async function runAiText() {
    if (!aiText.trim()) return;
    setAiBusy(true); setAiError(null); setAiResult(null);
    try { setAiResult(await aiFromText(aiText.trim())); }
    catch (e) { setAiError(e.message); }
    finally { setAiBusy(false); }
  }

  async function onLabelFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setAiBusy(true); setAiError(null);
    try {
      // Bigger than a meal photo: nutrition print is small and needs the pixels.
      const dataUrl = await fileToCompressedDataUrl(file, 1100, 0.8);
      const data = await aiFromLabel(dataUrl);
      if (data.found) {
        pick(data.item);
        if (data.confidence === 'low') setAiError('That was hard to read — check the numbers before you add it.');
      } else {
        setAiError(data.note || 'Could not read a nutrition panel there.');
      }
    } catch (err) {
      setAiError(err.message);
    } finally {
      setAiBusy(false);
      e.target.value = '';
    }
  }

  async function onPhoto(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setAiBusy(true); setAiError(null); setAiResult(null);
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      setPhotoPreview(dataUrl);
      setAiResult(await aiFromPhoto(dataUrl, aiText.trim() || undefined));
    } catch (err) {
      setAiError(err.message);
    } finally {
      setAiBusy(false);
      e.target.value = ''; // let the same file be picked again
    }
  }

  const quickValid = quick.name.trim() && quick.calories !== '';

  return (
    <>
      {scanning && <BarcodeScanner onDetected={onBarcode} onLabel={onLabelShot} onClose={() => setScanning(false)} />}

      <div style={{ position: 'fixed', inset: 0, zIndex: 320, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
           onClick={onClose}>
        <div onClick={(e) => e.stopPropagation()} style={{
          background: 'var(--card)', borderTopLeftRadius: 26, borderTopRightRadius: 26,
          width: '100%', maxWidth: 480, height: '88vh', display: 'flex', flexDirection: 'column',
        }}>
          {/* Handle + title */}
          <div style={{ padding: '12px 20px 0', flexShrink: 0 }}>
            <div style={{ width: 38, height: 4, background: 'var(--line)', borderRadius: 999, margin: '0 auto 14px' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 className="gd-disp" style={{ fontSize: 19, fontWeight: 800, margin: 0 }}>Add to {mealLabel}</h3>
              <button onClick={onClose} aria-label="Close" style={{ background: 'var(--soft)', border: 'none', color: 'var(--ink-2)', width: 32, height: 32, borderRadius: '50%', fontSize: 18, cursor: 'pointer' }}>×</button>
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

          {/* Body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px calc(20px + env(safe-area-inset-bottom))' }}>

            {/* Favourites — always visible, one tap to log */}
            {favourites.length > 0 && !picked && (
              <div style={{ marginBottom: 18 }}>
                <p style={{ ...eyebrow, marginBottom: 9 }}>Favourites</p>
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                  {favourites.map((fav, i) => (
                    <button key={i} onClick={() => onAdd({ ...fav, id: Date.now() + Math.random() })} style={{
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

                <div style={{ background: 'var(--soft)', borderRadius: 16, padding: 16, marginBottom: 18, textAlign: 'center' }}>
                  <div className="gd-disp" style={{ fontSize: 28, fontWeight: 800 }}>{scaleToGrams(picked, grams).calories}<span style={{ fontSize: 13, color: 'var(--ink-3)', marginLeft: 4 }}>kcal</span></div>
                  <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 4 }}>{macroLine(scaleToGrams(picked, grams))}</div>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => onSaveFavourites(toggleFavourite(favourites, scaleToGrams(picked, grams)))} style={{
                    padding: '14px 16px', borderRadius: 14, border: '1px solid var(--line)', background: 'var(--soft)',
                    color: isFavourite(favourites, scaleToGrams(picked, grams)) ? 'var(--gold)' : 'var(--ink-2)',
                    fontSize: 18, cursor: 'pointer',
                  }}>★</button>
                  <button onClick={confirmPortion} style={{ ...primaryBtn(true), flex: 1 }}>Add to {mealLabel}</button>
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                  {(results || []).map((item) => <FoodRow key={item.id} item={item} onPick={pick} />)}
                </div>
                {!results && !searching && recentFoods(profile && profile.foodRecent).length > 0 && (
                  <>
                    <p style={{ ...eyebrow, margin: '20px 0 9px' }}>Recent</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {recentFoods(profile && profile.foodRecent).map((r, i) => (
                        <button key={i} onClick={() => onAdd({ ...r, id: Date.now() + Math.random() })} style={{
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
                <input ref={labelRef} type="file" accept="image/*" capture="environment" onChange={onLabelFile} style={{ display: 'none' }} />

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
                  <button onClick={runAiText} disabled={!aiText.trim() || aiBusy} style={{ ...primaryBtn(!!aiText.trim() && !aiBusy), flex: 1 }}>Estimate</button>
                  <button onClick={() => fileRef.current && fileRef.current.click()} disabled={aiBusy} style={{
                    padding: '14px 18px', borderRadius: 14, border: '1px solid var(--line)', background: 'var(--soft)',
                    color: 'var(--ink-2)', fontSize: 15, fontWeight: 700, cursor: 'pointer',
                  }}>📷 Photo</button>
                </div>
                <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onPhoto} style={{ display: 'none' }} />

                {photoPreview && <img src={photoPreview} alt="" style={{ width: '100%', borderRadius: 16, marginTop: 14, maxHeight: 200, objectFit: 'cover' }} />}
                {aiBusy && <Spinner label="Working it out…" />}
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {aiResult.items.map((it, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: '12px 14px' }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 14.5, fontWeight: 700 }}>{it.name}</div>
                                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
                                  {it.portion ? `${it.portion} · ` : ''}{macroLine(it)}
                                </div>
                              </div>
                              <button onClick={() => onAdd({ ...it, id: Date.now() + Math.random() })} style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--accent-strong)', cursor: 'pointer' }}>+</button>
                            </div>
                          ))}
                        </div>
                        <button onClick={() => { aiResult.items.forEach((it, i) => onAdd({ ...it, id: Date.now() + i })); }} style={{ ...primaryBtn(true), width: '100%', marginTop: 12 }}>
                          Add all {aiResult.items.length}
                        </button>
                        <p style={{ margin: '12px 0 0', fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5 }}>
                          {aiResult.note ? `${aiResult.note} ` : ''}These are estimates &mdash; tap a number to fix it after adding if you know better.
                        </p>
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
                <button disabled={!quickValid} onClick={() => onAdd({
                  id: Date.now(), name: quick.name.trim(),
                  calories: parseInt(quick.calories) || 0, protein: parseInt(quick.protein) || 0,
                  carbs: parseInt(quick.carbs) || 0, fat: parseInt(quick.fat) || 0,
                })} style={{ ...primaryBtn(quickValid), width: '100%' }}>Add to {mealLabel}</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

'use client';

// Fix a logged item's numbers — and, if you want, teach the app so it never gets
// that food wrong again.
//
// This is the honest answer to AI estimates: the model gets you close in one tap,
// and the one time you know better, your correction becomes the new truth.

import { useState, useEffect, useRef } from 'react';
import { aiFromText, sumItems, mealNameFrom, describeMealCorrection } from '@/lib/food';
import { captureError } from '@/lib/monitoring';

const eyebrow = { fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', color: 'var(--ink-3)', textTransform: 'uppercase', margin: 0 };
const field = {
  width: '100%', background: 'var(--soft)', border: '1px solid var(--line)', borderRadius: 12,
  padding: '13px 14px', color: 'var(--ink)', fontSize: 15, fontWeight: 600, outline: 'none', boxSizing: 'border-box',
};

const n = (v) => { const x = parseFloat(v); return isFinite(x) && x >= 0 ? x : 0; };

export default function EditItemSheet({ item, onSave, onDelete, onClose }) {
  const [f, setF] = useState({
    name: item.name || '',
    grams: item.grams != null ? String(item.grams) : '',
    calories: String(item.calories ?? ''),
    protein: String(item.protein ?? ''),
    carbs: String(item.carbs ?? ''),
    fat: String(item.fat ?? ''),
  });
  const [remember, setRemember] = useState(true);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  // ── Meal correction ──
  // An entry logged as one meal carries its ingredients. Rather than editing
  // five numbers, say what was wrong and let the model redo the arithmetic.
  const [components, setComponents] = useState(
    Array.isArray(item.components) ? item.components : null
  );
  const [correction, setCorrection] = useState('');
  const [fixBusy, setFixBusy] = useState(false);
  const [fixError, setFixError] = useState(null);
  const [wasKcal, setWasKcal] = useState(null); // old total, shown struck through
  const wasTimer = useRef();
  useEffect(() => () => clearTimeout(wasTimer.current), []);

  async function runCorrection() {
    const text = correction.trim();
    if (!text || fixBusy) return;
    setFixBusy(true); setFixError(null);
    const before = Math.round(n(f.calories));
    try {
      const r = await aiFromText(describeMealCorrection(components, text));
      const next = (r && Array.isArray(r.items)) ? r.items : [];
      if (next.length === 0) throw new Error(r && r.note ? r.note : 'I could not work that out — try wording it differently.');
      const totals = sumItems(next);
      // Only re-derive the name if it was still the auto-generated one. If he
      // typed his own name for this meal, his correction was about the food.
      const autoNamed = f.name.trim() === mealNameFrom(components);
      setComponents(next);
      setF((s) => ({
        ...s,
        name: autoNamed ? mealNameFrom(next) : s.name,
        grams: totals.grams != null ? String(totals.grams) : '',
        calories: String(totals.calories),
        protein: String(totals.protein),
        carbs: String(totals.carbs),
        fat: String(totals.fat),
      }));
      setCorrection('');
      setWasKcal(before);
      clearTimeout(wasTimer.current);
      wasTimer.current = setTimeout(() => setWasKcal(null), 6000);
    } catch (e) {
      // Never wipe a logged meal on a failed call — leave it exactly as it was.
      setFixError(e.message || 'That did not work. Try again.');
      // The correction text is the user's own words about their food — the
      // number of components is all the context this needs.
      captureError(e, {
        screen: 'nutrition', action: 'meal-correction', endpoint: 'foodAI',
        components: Array.isArray(components) ? components.length : 0,
      });
    } finally {
      setFixBusy(false);
    }
  }

  // While a correction is running, every field below is about to be replaced by
  // the model's answer. Typing into them looked like it worked and was then
  // silently overwritten when the reply landed, so they're held until it does.
  const busyStyle = fixBusy ? { opacity: 0.55, cursor: 'not-allowed' } : null;

  const fromMacros = Math.round(n(f.protein) * 4 + n(f.carbs) * 4 + n(f.fat) * 9);
  const stated = Math.round(n(f.calories));
  const drift = stated && fromMacros ? Math.abs(stated - fromMacros) / Math.max(stated, fromMacros) : 0;

  function save() {
    const grams = f.grams === '' ? null : Math.round(n(f.grams));
    const next = {
      ...item,
      name: f.name.trim() || item.name,
      grams,
      calories: Math.round(n(f.calories)),
      protein: Math.round(n(f.protein)),
      carbs: Math.round(n(f.carbs)),
      fat: Math.round(n(f.fat)),
      corrected: true,   // stops the estimate badge reappearing
    };
    // id and at come through the spread untouched, so a corrected meal keeps
    // its place in the day rather than jumping to the end.
    if (components) next.components = components;
    // Only worth remembering as a reusable food if we know what it weighed —
    // without grams there's nothing to scale a future portion from.
    onSave(next, remember && grams > 0);
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 340, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: 'var(--card)', borderTopLeftRadius: 26, borderTopRightRadius: 26,
        width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto',
        padding: '12px 20px calc(24px + env(safe-area-inset-bottom))',
      }}>
        <div style={{ width: 38, height: 4, background: 'var(--line)', borderRadius: 999, margin: '0 auto 16px' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <h3 className="gd-disp" style={{ fontSize: 19, fontWeight: 800, margin: 0 }}>Fix the numbers</h3>
          <button onClick={onClose} aria-label="Close" style={{ background: 'var(--soft)', border: 'none', color: 'var(--ink-2)', width: 32, height: 32, borderRadius: '50%', fontSize: 18, cursor: 'pointer' }}>×</button>
        </div>

        <p style={{ ...eyebrow, marginBottom: 7 }}>What was it?</p>
        <input value={f.name} onChange={set('name')} disabled={fixBusy} style={{ ...field, marginBottom: 14, ...busyStyle }} />

        {/* ── TELL ME WHAT TO CHANGE (meals only) ── */}
        {components && components.length > 0 && (
          <div style={{ background: 'var(--soft)', borderRadius: 16, padding: 14, marginBottom: 16 }}>
            <p style={{ ...eyebrow, marginBottom: 7 }}>Tell me what to change</p>
            <p style={{ margin: '0 0 10px', fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.5 }}>
              {components.map((c) => c.name).join(' · ')}
            </p>
            <input
              value={correction}
              onChange={(e) => setCorrection(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') runCorrection(); }}
              placeholder="it was 3 handfuls of cereal, no milk"
              disabled={fixBusy}
              style={{ ...field, background: 'var(--card)' }}
            />
            <button onClick={runCorrection} disabled={!correction.trim() || fixBusy} style={{
              width: '100%', marginTop: 10, padding: '12px 16px', borderRadius: 12, border: 'none',
              background: correction.trim() && !fixBusy ? 'var(--accent)' : 'var(--line)',
              color: correction.trim() && !fixBusy ? 'var(--on-accent)' : 'var(--ink-3)',
              fontSize: 14, fontWeight: 800, cursor: correction.trim() && !fixBusy ? 'pointer' : 'not-allowed',
            }}>{fixBusy ? 'Working it out…' : 'Redo the numbers'}</button>
            {fixError && (
              <p style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--orange-ink)', lineHeight: 1.5 }}>
                {fixError} Your meal is unchanged.
              </p>
            )}
            {wasKcal != null && (
              <p style={{ margin: '10px 0 0', fontSize: 13.5, color: 'var(--ink-2)', fontWeight: 600 }}>
                <span style={{ textDecoration: 'line-through', color: 'var(--ink-3)' }}>{wasKcal} kcal</span>
                {' → '}
                <span style={{ color: 'var(--accent-strong)', fontWeight: 800 }}>{Math.round(n(f.calories))} kcal</span>
                <span style={{ color: 'var(--ink-3)', fontWeight: 600 }}> · tap Save to keep it</span>
              </p>
            )}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <p style={{ ...eyebrow, marginBottom: 7 }}>Weight</p>
            <input type="number" inputMode="decimal" value={f.grams} onChange={set('grams')} disabled={fixBusy} placeholder="g" style={{ ...field, ...busyStyle }} />
          </div>
          <div>
            <p style={{ ...eyebrow, marginBottom: 7 }}>Calories</p>
            <input type="number" inputMode="numeric" value={f.calories} onChange={set('calories')} disabled={fixBusy} placeholder="kcal" style={{ ...field, ...busyStyle }} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
          {[['protein', 'Protein'], ['carbs', 'Carbs'], ['fat', 'Fat']].map(([k, label]) => (
            <div key={k}>
              <p style={{ ...eyebrow, marginBottom: 7 }}>{label}</p>
              <input type="number" inputMode="decimal" value={f[k]} onChange={set(k)} disabled={fixBusy} placeholder="g" style={{ ...field, textAlign: 'center', ...busyStyle }} />
            </div>
          ))}
        </div>

        {/* The same arithmetic check the API runs — shown, not hidden */}
        {drift > 0.12 && (
          <div style={{ background: 'var(--soft)', borderRadius: 12, padding: 13, marginBottom: 14 }}>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>
              Those macros work out to <strong>{fromMacros} kcal</strong>, not {stated}.
              <button onClick={() => setF((s) => ({ ...s, calories: String(fromMacros) }))} disabled={fixBusy} style={{
                marginLeft: 6, background: 'none', border: 'none', padding: 0, color: 'var(--accent-strong)', fontSize: 13, fontWeight: 700,
                cursor: fixBusy ? 'not-allowed' : 'pointer', ...busyStyle,
              }}>Use {fromMacros}</button>
            </p>
          </div>
        )}

        <button onClick={() => setRemember(!remember)} style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', cursor: 'pointer',
          background: remember ? 'var(--accent-tint)' : 'var(--soft)',
          border: `1.5px solid ${remember ? 'var(--accent)' : 'var(--line)'}`,
          borderRadius: 14, padding: '13px 15px', marginBottom: 16,
        }}>
          <span style={{
            width: 22, height: 22, borderRadius: 7, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: remember ? 'var(--accent)' : 'transparent', border: remember ? 'none' : '1.5px solid var(--line)',
            color: 'var(--on-accent)', fontSize: 13,
          }}>{remember ? '✓' : ''}</span>
          <span>
            <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Remember this food</span>
            <span style={{ display: 'block', fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2, lineHeight: 1.45 }}>
              Saves it as yours, so next time it&rsquo;s exact instead of estimated.
            </span>
          </span>
        </button>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => onDelete(item.id)} style={{
            padding: '15px 18px', borderRadius: 14, border: '1px solid var(--line)', background: 'var(--soft)',
            color: 'var(--orange-ink)', fontSize: 15, fontWeight: 700, cursor: 'pointer',
          }}>Delete</button>
          <button onClick={save} style={{
            flex: 1, padding: 15, borderRadius: 14, border: 'none', background: 'var(--accent)',
            color: 'var(--on-accent)', fontSize: 15, fontWeight: 800, cursor: 'pointer',
          }}>Save</button>
        </div>
      </div>
    </div>
  );
}

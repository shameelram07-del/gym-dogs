'use client';

// Fix a logged item's numbers — and, if you want, teach the app so it never gets
// that food wrong again.
//
// This is the honest answer to AI estimates: the model gets you close in one tap,
// and the one time you know better, your correction becomes the new truth.

import { useState } from 'react';

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
        <input value={f.name} onChange={set('name')} style={{ ...field, marginBottom: 14 }} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <p style={{ ...eyebrow, marginBottom: 7 }}>Weight</p>
            <input type="number" inputMode="decimal" value={f.grams} onChange={set('grams')} placeholder="g" style={field} />
          </div>
          <div>
            <p style={{ ...eyebrow, marginBottom: 7 }}>Calories</p>
            <input type="number" inputMode="numeric" value={f.calories} onChange={set('calories')} placeholder="kcal" style={field} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
          {[['protein', 'Protein'], ['carbs', 'Carbs'], ['fat', 'Fat']].map(([k, label]) => (
            <div key={k}>
              <p style={{ ...eyebrow, marginBottom: 7 }}>{label}</p>
              <input type="number" inputMode="decimal" value={f[k]} onChange={set(k)} placeholder="g" style={{ ...field, textAlign: 'center' }} />
            </div>
          ))}
        </div>

        {/* The same arithmetic check the API runs — shown, not hidden */}
        {drift > 0.12 && (
          <div style={{ background: 'var(--soft)', borderRadius: 12, padding: 13, marginBottom: 14 }}>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>
              Those macros work out to <strong>{fromMacros} kcal</strong>, not {stated}.
              <button onClick={() => setF((s) => ({ ...s, calories: String(fromMacros) }))} style={{
                marginLeft: 6, background: 'none', border: 'none', padding: 0, color: 'var(--accent-strong)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
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

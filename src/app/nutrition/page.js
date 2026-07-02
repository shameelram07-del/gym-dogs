'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMsal } from '@azure/msal-react';
import BottomNav from '@/components/BottomNav';

const PROFILES_URL = 'https://gymdogs-api-g9d0gve4angygdcj.newzealandnorth-01.azurewebsites.net/api/userProfiles';
const PROFILES_KEY = process.env.NEXT_PUBLIC_PROFILES_API_KEY;
const TODAY = new Date().toISOString().split('T')[0];

// Goals default here; wire to the user's profile later.
const GOALS = { calories: 2200, protein: 160, carbs: 220, fat: 70 };
const WATER_GOAL = 8; // glasses

const MEAL_ORDER = [
  { key: 'breakfast', label: 'Breakfast', icon: '🌅' },
  { key: 'lunch',     label: 'Lunch',     icon: '🥗' },
  { key: 'dinner',    label: 'Dinner',    icon: '🍽️' },
  { key: 'snacks',    label: 'Snacks',    icon: '🍎' },
];

const eyebrow = { fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', color: 'var(--ink-3)', textTransform: 'uppercase', margin: 0 };
const cardStyle = { background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 22, padding: 18 };
const numInput = { width: '100%', background: 'var(--soft)', border: '1px solid var(--line)', borderRadius: 12, padding: '11px 12px', color: 'var(--ink)', fontSize: 15, fontWeight: 600, outline: 'none', boxSizing: 'border-box', textAlign: 'center' };

function MacroBar({ label, value, goal, color }) {
  const pct = goal ? Math.min(Math.round((value / goal) * 100), 100) : 0;
  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: 12, color: 'var(--ink-2)', fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{Math.round(value)}/{goal}g</span>
      </div>
      <div style={{ height: 6, background: 'var(--soft)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 999, transition: 'width 0.3s' }} />
      </div>
    </div>
  );
}

export default function NutritionPage() {
  const router = useRouter();
  const { accounts, inProgress } = useMsal();
  const [userId, setUserId] = useState(null);
  const [profileRef, setProfileRef] = useState(null);
  const [meals, setMeals] = useState({ breakfast: [], lunch: [], dinner: [], snacks: [] });
  const [water, setWater] = useState(0);
  const [adding, setAdding] = useState(null); // meal key being added to
  const [form, setForm] = useState({ name: '', calories: '', protein: '', carbs: '', fat: '' });

  useEffect(() => {
    if (inProgress !== 'none') return;
    if (accounts.length === 0) { router.push('/login'); return; }
    const uid = accounts[0].localAccountId;
    setUserId(uid);
    (async () => {
      try {
        const res = await fetch(`${PROFILES_URL}?userId=${uid}`, { headers: { 'x-functions-key': PROFILES_KEY } });
        if (res.ok) {
          const data = await res.json();
          // Find THIS user's profile — [0] could be someone else's once more users exist.
          const p = Array.isArray(data) ? data.find((x) => x.userId === uid) : data;
          if (p && !p.error) {
            setProfileRef(p);
            if (p.nutrition && p.nutrition.date === TODAY) {
              if (p.nutrition.meals) setMeals(p.nutrition.meals);
              if (typeof p.nutrition.water === 'number') setWater(p.nutrition.water);
            }
          }
        }
      } catch (e) {}
    })();
  }, [accounts, inProgress, router]);

  async function saveNutrition(mealsArg, waterArg) {
    if (!userId) return;
    try {
      await fetch(PROFILES_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-functions-key': PROFILES_KEY },
        body: JSON.stringify({ ...(profileRef || {}), userId, nutrition: { date: TODAY, meals: mealsArg, water: waterArg } }),
      });
    } catch (e) {}
  }

  if (!userId) return null;

  const allItems = Object.values(meals).flat();
  const total = allItems.reduce((a, i) => ({
    calories: a.calories + (i.calories || 0),
    protein: a.protein + (i.protein || 0),
    carbs: a.carbs + (i.carbs || 0),
    fat: a.fat + (i.fat || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  const remaining = Math.max(GOALS.calories - total.calories, 0);
  const calPct = Math.min(total.calories / GOALS.calories, 1);
  const R = 52, CIRC = 2 * Math.PI * R;

  const openAdd = (mealKey) => { setForm({ name: '', calories: '', protein: '', carbs: '', fat: '' }); setAdding(mealKey); };
  const saveItem = () => {
    if (!form.name.trim()) return;
    const item = {
      id: Date.now(), name: form.name.trim(),
      calories: parseInt(form.calories) || 0,
      protein: parseInt(form.protein) || 0,
      carbs: parseInt(form.carbs) || 0,
      fat: parseInt(form.fat) || 0,
    };
    const next = { ...meals, [adding]: [...meals[adding], item] };
    setMeals(next);
    saveNutrition(next, water);
    setAdding(null);
  };
  const removeItem = (mealKey, id) => {
    const next = { ...meals, [mealKey]: meals[mealKey].filter(i => i.id !== id) };
    setMeals(next);
    saveNutrition(next, water);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)', paddingBottom: 100 }}>

      {/* ── HEADER ── */}
      <div style={{ padding: '52px 20px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.push('/dashboard')} aria-label="Back" style={{ width: 38, height: 38, borderRadius: 12, background: 'var(--soft)', border: '1px solid var(--line)', color: 'var(--ink)', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>‹</button>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>Nutrition</h1>
          <p style={{ margin: '1px 0 0', fontSize: 13, color: 'var(--ink-3)' }}>Today</p>
        </div>
      </div>

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* ── CALORIE SUMMARY ── */}
        <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ position: 'relative', width: 100, height: 100, flexShrink: 0 }}>
            <svg width="100" height="100" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r={R} fill="none" stroke="var(--soft)" strokeWidth="11" />
              <circle cx="60" cy="60" r={R} fill="none" stroke="var(--accent)" strokeWidth="11" strokeLinecap="round"
                strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - calPct)} transform="rotate(-90 60 60)" />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 24, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.02em' }}>{Math.round(total.calories)}</span>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--ink-3)', marginTop: 3 }}>KCAL</span>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 16 }}>{remaining} kcal left</p>
            <p style={{ margin: '3px 0 12px', fontSize: 13, color: 'var(--ink-2)' }}>of {GOALS.calories} goal</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <MacroBar label="Protein" value={total.protein} goal={GOALS.protein} color="var(--accent)" />
              <MacroBar label="Carbs" value={total.carbs} goal={GOALS.carbs} color="var(--blue)" />
              <MacroBar label="Fat" value={total.fat} goal={GOALS.fat} color="var(--orange)" />
            </div>
          </div>
        </div>

        {/* ── WATER ── */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <p style={eyebrow}>Water</p>
            <span style={{ fontSize: 13, color: 'var(--ink-2)', fontWeight: 600 }}>{water} / {WATER_GOAL} glasses</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {Array.from({ length: WATER_GOAL }).map((_, i) => (
              <button key={i} onClick={() => { const nw = i + 1 === water ? i : i + 1; setWater(nw); saveNutrition(meals, nw); }} aria-label={`${i + 1} glasses`} style={{
                flex: 1, height: 40, borderRadius: 10, cursor: 'pointer', border: 'none',
                background: i < water ? 'var(--blue-tint)' : 'var(--soft)',
                color: i < water ? 'var(--blue-ink)' : 'var(--ink-3)', fontSize: 16,
              }}>💧</button>
            ))}
          </div>
        </div>

        {/* ── MEALS ── */}
        {MEAL_ORDER.map(meal => {
          const items = meals[meal.key];
          const kcal = items.reduce((a, i) => a + (i.calories || 0), 0);
          return (
            <div key={meal.key} style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 18 }}>{meal.icon}</span>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{meal.label}</span>
                </div>
                <span style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 600 }}>{kcal} kcal</span>
              </div>
              {items.map(item => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', borderTop: '1px solid var(--line-2)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</p>
                    <p style={{ margin: '1px 0 0', fontSize: 12, color: 'var(--ink-3)' }}>{item.calories} kcal · P{item.protein} C{item.carbs} F{item.fat}</p>
                  </div>
                  <button onClick={() => removeItem(meal.key, item.id)} aria-label="Remove" style={{ background: 'none', border: 'none', color: 'var(--ink-3)', fontSize: 18, cursor: 'pointer', flexShrink: 0 }}>×</button>
                </div>
              ))}
              <button onClick={() => openAdd(meal.key)} style={{ width: '100%', padding: '13px', background: 'var(--soft)', border: 'none', borderTop: '1px solid var(--line-2)', color: 'var(--accent-strong)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                + Add food
              </button>
            </div>
          );
        })}

      </div>

      {/* ── ADD MODAL ── */}
      {adding && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px', background: 'rgba(0,0,0,0.5)' }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 24, padding: 22, width: '100%', maxWidth: 380 }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 16px', color: 'var(--ink)' }}>Add food</h3>
            <input type="text" placeholder="Food name" value={form.name} autoFocus
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              style={{ ...numInput, textAlign: 'left', marginBottom: 12 }} />
            <div style={{ marginBottom: 12 }}>
              <p style={{ ...eyebrow, marginBottom: 6 }}>Calories</p>
              <input type="number" inputMode="numeric" placeholder="kcal" value={form.calories}
                onChange={e => setForm(f => ({ ...f, calories: e.target.value }))} style={numInput} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 18 }}>
              {[['protein', 'Protein'], ['carbs', 'Carbs'], ['fat', 'Fat']].map(([key, label]) => (
                <div key={key}>
                  <p style={{ ...eyebrow, marginBottom: 6 }}>{label}</p>
                  <input type="number" inputMode="numeric" placeholder="g" value={form[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} style={numInput} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setAdding(null)} style={{ flex: 1, padding: 14, borderRadius: 12, border: '1px solid var(--line)', background: 'none', color: 'var(--ink-2)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              <button onClick={saveItem} disabled={!form.name.trim()} style={{ flex: 1, padding: 14, borderRadius: 12, border: 'none', background: 'var(--accent)', color: 'var(--on-accent)', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: form.name.trim() ? 1 : 0.5 }}>Add</button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}

'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useMsal } from '@azure/msal-react';
import BottomNav from '@/components/BottomNav';
import TargetsSetup from '@/components/TargetsSetup';
import AddFoodSheet from '@/components/AddFoodSheet';
import { pushRecent } from '@/lib/food';
import {
  calculateTargets, DEFAULT_TARGETS, seedFromProfile,
  summariseDay, upsertDay, flattenEntries, migrateWater,
} from '@/lib/nutrition';

const PROFILES_URL = 'https://gymdogs-api-g9d0gve4angygdcj.newzealandnorth-01.azurewebsites.net/api/userProfiles';
const PROFILES_KEY = process.env.NEXT_PUBLIC_PROFILES_API_KEY;
const TODAY = new Date().toISOString().split('T')[0];

const eyebrow = { fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', color: 'var(--ink-3)', textTransform: 'uppercase', margin: 0 };
const cardStyle = { background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 22, padding: 18 };
const pillBase = { padding: '9px 12px', borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: '1px solid var(--line)', background: 'var(--soft)', color: 'var(--ink-2)' };
const pillOn = { ...pillBase, background: 'var(--accent-tint)', borderColor: 'var(--accent)', color: 'var(--accent-strong)' };

const timeOf = (iso) => {
  const d = new Date(iso);
  return isNaN(d) ? '' : d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

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
  const [items, setItems] = useState([]);   // flat, in the order they were eaten
  const [waterMl, setWaterMl] = useState(0);
  const [adding, setAdding] = useState(false);
  const [editingWater, setEditingWater] = useState(false);

  // Targets setup
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupForm, setSetupForm] = useState(null);
  const [showMaths, setShowMaths] = useState(false);

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
          const p = Array.isArray(data) ? data.find((x) => x.userId === uid) : data;
          if (p && !p.error) {
            setProfileRef(p);
            if (p.nutrition && p.nutrition.date === TODAY) {
              // flattenEntries covers days saved before meal buckets were dropped
              setItems(flattenEntries(p.nutrition.items || p.nutrition.meals));
              setWaterMl(migrateWater(p.nutrition));
            }
          }
        }
      } catch (e) {}
    })();
  }, [accounts, inProgress, router]);

  // ── Targets ──────────────────────────────────────────────────────────
  // Recomputed from the saved setup + real weigh-in and intake history, so they
  // track the user instead of sitting frozen at whatever was worked out on day 1.
  const saved = profileRef && profileRef.nutritionGoals;
  const targets = useMemo(() => {
    if (!saved) return null;
    return calculateTargets(saved, (profileRef && profileRef.nutritionLog) || [], (profileRef && profileRef.weighIns) || []);
  }, [saved, profileRef]);

  const T = targets || DEFAULT_TARGETS;
  // Explicit override wins; otherwise the bodyweight-derived suggestion.
  const waterGoalMl = (profileRef && profileRef.waterGoalMl) || T.waterMl || 2500;

  async function saveProfile(patch) {
    if (!userId) return;
    const next = { ...(profileRef || {}), userId, ...patch };
    setProfileRef(next);
    try {
      await fetch(PROFILES_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-functions-key': PROFILES_KEY },
        body: JSON.stringify(next),
      });
    } catch (e) {}
  }

  // Saving a meal also files the day's totals into nutritionLog — that history
  // is what the adaptive expenditure model reads from.
  function saveNutrition(itemsArg, waterArg) {
    saveProfile({
      nutrition: { date: TODAY, items: itemsArg, waterMl: waterArg },
      nutritionLog: upsertDay((profileRef && profileRef.nutritionLog) || [], summariseDay(itemsArg, TODAY)),
    });
  }

  function openSetup() {
    setSetupForm(seedFromProfile(profileRef));
    setSetupOpen(true);
  }

  function saveSetup(parsed) {
    if (!parsed) return;
    saveProfile({ nutritionGoals: { ...parsed, setAt: TODAY }, weight: parsed.weight, height: parsed.height, age: parsed.age });
    setSetupOpen(false);
  }

  if (!userId) return null;

  const total = items.reduce((a, i) => ({
    calories: a.calories + (i.calories || 0),
    protein: a.protein + (i.protein || 0),
    carbs: a.carbs + (i.carbs || 0),
    fat: a.fat + (i.fat || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  const remaining = Math.max(T.calories - total.calories, 0);
  const calPct = Math.min(total.calories / T.calories, 1);
  const R = 52, CIRC = 2 * Math.PI * R;

  // The sheet stays open after an add, so a whole meal goes in without reopening.
  const addItem = (item) => {
    const stamped = { ...item, at: new Date().toISOString() };
    const next = [...items, stamped];
    setItems(next);
    saveProfile({
      nutrition: { date: TODAY, items: next, waterMl },
      nutritionLog: upsertDay((profileRef && profileRef.nutritionLog) || [], summariseDay(next, TODAY)),
      foodRecent: pushRecent((profileRef && profileRef.foodRecent) || [], item),
    });
  };

  const removeItem = (id) => {
    const next = items.filter((i) => i.id !== id);
    setItems(next);
    saveNutrition(next, waterMl);
  };

  const setWater = (ml) => {
    const v = Math.max(0, Math.min(ml, 6000));
    setWaterMl(v);
    saveNutrition(items, v);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)', paddingBottom: 100 }}>

      {/* ── HEADER ── */}
      <div style={{ padding: '52px 20px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <h1 className="gd-disp" style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>Nutrition</h1>
          <p style={{ margin: '1px 0 0', fontSize: 13, color: 'var(--ink-3)' }}>Today</p>
        </div>
        {targets && (
          <button onClick={openSetup} style={{ ...pillBase, padding: '7px 12px', fontSize: 12 }}>Targets</button>
        )}
      </div>

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* ── SET UP YOUR TARGETS ── */}
        {!targets && (
          <div style={{ ...cardStyle, background: 'var(--ai-card-1)', borderColor: 'transparent' }}>
            <p style={{ ...eyebrow, color: 'rgba(255,255,255,0.6)' }}>Set up</p>
            <h2 className="gd-disp" style={{ margin: '8px 0 6px', fontSize: 19, fontWeight: 800, color: '#fff' }}>
              These numbers aren&rsquo;t yours yet
            </h2>
            <p style={{ margin: '0 0 14px', fontSize: 14, lineHeight: 1.5, color: 'rgba(255,255,255,0.72)' }}>
              You&rsquo;re looking at a generic {DEFAULT_TARGETS.calories} kcal. Answer four questions and I&rsquo;ll work out your real
              targets &mdash; then keep adjusting them as your weigh-ins come in.
            </p>
            <button onClick={openSetup} style={{ width: '100%', padding: 14, borderRadius: 14, border: 'none', background: 'var(--grad, var(--accent))', color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}>
              Work out my targets
            </button>
          </div>
        )}

        {/* ── CALORIE SUMMARY ── */}
        <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ position: 'relative', width: 100, height: 100, flexShrink: 0 }}>
            <svg width="100" height="100" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r={R} fill="none" stroke="var(--soft)" strokeWidth="11" />
              <circle cx="60" cy="60" r={R} fill="none" stroke="var(--accent)" strokeWidth="11" strokeLinecap="round"
                strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - calPct)} transform="rotate(-90 60 60)" />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span className="gd-disp" style={{ fontSize: 24, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.02em' }}>{Math.round(total.calories)}</span>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--ink-3)', marginTop: 3 }}>KCAL</span>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 16 }}>{remaining} kcal left</p>
            <p style={{ margin: '3px 0 12px', fontSize: 13, color: 'var(--ink-2)' }}>
              of {T.calories} goal{!targets && ' (generic)'}
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <MacroBar label="Protein" value={total.protein} goal={T.protein} color="var(--accent)" />
              <MacroBar label="Carbs" value={total.carbs} goal={T.carbs} color="var(--blue)" />
              <MacroBar label="Fat" value={total.fat} goal={T.fat} color="var(--orange)" />
            </div>
          </div>
        </div>

        {/* ── EXPENDITURE / HOW THESE NUMBERS ARE SET ── */}
        {targets && (
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={eyebrow}>Your daily burn</p>
                <p className="gd-disp" style={{ margin: '6px 0 0', fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em' }}>
                  {targets.expenditure}<span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-3)', marginLeft: 4 }}>kcal</span>
                </p>
              </div>
              <span style={{
                ...pillBase, padding: '5px 10px', fontSize: 11, cursor: 'default',
                ...(targets.expenditureSource === 'measured' ? { background: 'var(--accent-tint)', borderColor: 'var(--accent)', color: 'var(--accent-strong)' } : {}),
              }}>
                {targets.expenditureSource === 'measured' ? 'Measured' : targets.expenditureSource === 'blended' ? 'Learning' : 'Estimated'}
              </span>
            </div>

            <p style={{ margin: '10px 0 0', fontSize: 13, lineHeight: 1.5, color: 'var(--ink-2)' }}>
              {targets.expenditureSource === 'formula'
                ? <>Starting estimate from your height, weight, age and training. Log your food and weigh in weekly and I&rsquo;ll replace this with your <strong>actual</strong> burn.</>
                : <>Worked out from what you really ate and how your weight actually moved &mdash; not a formula. {targets.stats && `${targets.stats.loggedDays} days logged over ${targets.stats.spanDays}.`}</>}
            </p>

            {targets.weeklyRate !== 0 && (
              <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--ink-2)' }}>
                Aiming for <strong>{targets.weeklyRate > 0 ? '+' : ''}{targets.weeklyRate} kg</strong> a week
                {targets.rateCapped && <span style={{ color: 'var(--orange-ink)' }}> (capped to a safe pace)</span>}.
              </p>
            )}
            {targets.floored && (
              <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--orange-ink)' }}>
                Held at a safe minimum &mdash; going lower isn&rsquo;t worth it.
              </p>
            )}

            <button onClick={() => setShowMaths(!showMaths)} style={{ marginTop: 12, background: 'none', border: 'none', padding: 0, color: 'var(--accent-strong)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              {showMaths ? 'Hide the maths' : 'Show the maths'}
            </button>
            {showMaths && (
              <div style={{ marginTop: 10, padding: 12, background: 'var(--soft)', borderRadius: 12, fontSize: 12.5, lineHeight: 1.6, color: 'var(--ink-2)' }}>
                <div>Formula estimate: <strong>{targets.formulaExpenditure} kcal</strong></div>
                {targets.measuredExpenditure !== null
                  ? <>
                      <div>Measured from your data: <strong>{targets.measuredExpenditure} kcal</strong></div>
                      <div>Confidence in the measurement: <strong>{Math.round(targets.confidence * 100)}%</strong></div>
                      <div style={{ marginTop: 6 }}>Trend weight: <strong>{targets.currentWeight} kg</strong></div>
                    </>
                  : <div style={{ marginTop: 6 }}>No measurement yet &mdash; {targets.reason}.</div>}
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--line)', color: 'var(--ink-3)' }}>
                  Estimates, not medical advice. Adjust if the scale disagrees for a fortnight.
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── WATER ── */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <p style={eyebrow}>Water</p>
            <button onClick={() => setEditingWater(!editingWater)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 13, color: 'var(--ink-2)', fontWeight: 600 }}>
              <strong className="gd-disp" style={{ fontSize: 17, color: 'var(--ink)' }}>{(waterMl / 1000).toFixed(2).replace(/\.?0+$/, '')}</strong>
              {' / '}{(waterGoalMl / 1000).toFixed(1)} L
            </button>
          </div>

          <div style={{ height: 10, background: 'var(--soft)', borderRadius: 999, overflow: 'hidden', marginBottom: 12 }}>
            <div style={{ width: `${Math.min((waterMl / waterGoalMl) * 100, 100)}%`, height: '100%', background: 'var(--blue)', borderRadius: 999, transition: 'width .3s ease' }} />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {[250, 500, 1000].map((ml) => (
              <button key={ml} onClick={() => setWater(waterMl + ml)} style={{
                flex: 1, padding: '11px 6px', borderRadius: 12, cursor: 'pointer', border: '1px solid var(--line)',
                background: 'var(--soft)', color: 'var(--ink-2)', fontSize: 13.5, fontWeight: 700,
              }}>+{ml < 1000 ? `${ml}ml` : '1L'}</button>
            ))}
            <button onClick={() => setWater(waterMl - 250)} disabled={waterMl <= 0} aria-label="Undo a glass" style={{
              padding: '11px 15px', borderRadius: 12, cursor: waterMl > 0 ? 'pointer' : 'not-allowed', border: '1px solid var(--line)',
              background: 'var(--soft)', color: 'var(--ink-3)', fontSize: 15, fontWeight: 700,
            }}>&minus;</button>
          </div>

          {editingWater && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line-2)' }}>
              <p style={{ ...eyebrow, marginBottom: 9 }}>Daily goal</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[1500, 2000, 2500, 3000, 3500, 4000].map((g) => (
                  <button key={g} onClick={() => { saveProfile({ waterGoalMl: g }); setEditingWater(false); }} style={{
                    padding: '8px 13px', borderRadius: 999, cursor: 'pointer', fontSize: 13, fontWeight: 700,
                    border: `1px solid ${g === waterGoalMl ? 'var(--accent)' : 'var(--line)'}`,
                    background: g === waterGoalMl ? 'var(--accent-tint)' : 'var(--soft)',
                    color: g === waterGoalMl ? 'var(--accent-strong)' : 'var(--ink-2)',
                  }}>{(g / 1000).toFixed(1)} L</button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── TODAY'S FOOD — one list, in the order it was eaten ── */}
        <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px 12px' }}>
            <p style={eyebrow}>What you&rsquo;ve eaten</p>
            {items.length > 0 && <span style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 600 }}>{items.length} item{items.length === 1 ? '' : 's'}</span>}
          </div>

          {items.length === 0 && (
            <p style={{ margin: 0, padding: '0 18px 16px', fontSize: 13.5, color: 'var(--ink-3)', lineHeight: 1.55 }}>
              Nothing yet. Add things as you eat them &mdash; scan a barcode, photograph the label, or just describe it.
            </p>
          )}

          {items.map((item) => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 18px', borderTop: '1px solid var(--line-2)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 14.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--ink-3)' }}>
                  {item.at ? `${timeOf(item.at)} · ` : ''}{item.calories} kcal · P{item.protein} C{item.carbs} F{item.fat}
                </p>
              </div>
              <button onClick={() => removeItem(item.id)} aria-label="Remove" style={{ background: 'none', border: 'none', color: 'var(--ink-3)', fontSize: 19, cursor: 'pointer', flexShrink: 0, padding: '0 2px' }}>×</button>
            </div>
          ))}

          <button onClick={() => setAdding(true)} style={{
            width: '100%', padding: 15, background: 'var(--soft)', border: 'none', borderTop: '1px solid var(--line-2)',
            color: 'var(--accent-strong)', fontSize: 15, fontWeight: 800, cursor: 'pointer',
          }}>
            + Add food
          </button>
        </div>

      </div>

      {/* ── TARGETS SETUP (full-screen stepped flow) ── */}
      {setupOpen && setupForm && (
        <TargetsSetup
          initial={setupForm}
          profile={profileRef}
          onSave={saveSetup}
          onCancel={() => setSetupOpen(false)}
        />
      )}

      {/* ── ADD FOOD ── */}
      {adding && (
        <AddFoodSheet
          profile={profileRef}
          onAdd={addItem}
          onSaveFavourites={(favs) => saveProfile({ foodFavourites: favs })}
          onClose={() => setAdding(false)}
        />
      )}

      <BottomNav />
    </div>
  );
}

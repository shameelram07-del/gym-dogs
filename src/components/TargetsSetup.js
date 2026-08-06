'use client';

// Full-screen stepped flow for working out someone's calorie + macro targets.
//
// Mirrors src/app/onboarding/page.js (progress bar, accent-tail heading,
// card-with-tick options, fixed action bar) so it reads as part of the app —
// then pushes harder on the final step, because "here are your numbers" is the
// payoff moment and should feel like one.

import { useState, useMemo, useEffect, useRef } from 'react';
import {
  SEXES, ACTIVITY_LEVELS, RATE_OPTIONS,
  calculateTargets, parseSetupForm, INPUT_LIMITS,
} from '@/lib/nutrition';

const STEP_COUNT = 4;

const card = (on) => ({
  display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', width: '100%',
  textAlign: 'left', cursor: 'pointer', borderRadius: 16,
  background: on ? 'var(--accent-tint)' : 'var(--card)',
  border: `1.5px solid ${on ? 'var(--accent)' : 'var(--line)'}`,
  boxShadow: on ? '0 6px 20px -12px var(--accent)' : 'none',
  transition: 'background .18s ease, border-color .18s ease, box-shadow .18s ease',
});

const tick = {
  width: 22, height: 22, borderRadius: '50%', background: 'var(--accent)', color: 'var(--on-accent)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0,
  animation: 'gdPop .28s ease',
};

const eyebrow = { fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', color: 'var(--ink-3)', textTransform: 'uppercase', margin: 0 };

// Numbers that land rather than appear. Used on the reveal.
function CountUp({ to, duration = 900, className, style }) {
  const [n, setN] = useState(0);
  const raf = useRef();
  useEffect(() => {
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      setN(Math.round(to * eased));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [to, duration]);
  return <span className={className} style={style}>{n}</span>;
}

function Heading({ head, tail, sub }) {
  return (
    <div style={{ marginTop: 22, marginBottom: 26, animation: 'gdRise .45s ease both' }}>
      <h1 className="gd-disp" style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.15, margin: 0, letterSpacing: '-0.03em' }}>
        {head}{head ? ' ' : ''}<span style={{ color: 'var(--accent-strong)' }}>{tail}</span>
      </h1>
      <p style={{ fontSize: 14.5, color: 'var(--ink-2)', marginTop: 8, marginBottom: 0, lineHeight: 1.5 }}>{sub}</p>
    </div>
  );
}

function NumField({ label, unit, value, onChange, placeholder, autoFocus, bad }) {
  return (
    <div>
      <p style={{ ...eyebrow, marginBottom: 7 }}>{label}</p>
      <div style={{ position: 'relative' }}>
        <input
          type="number" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder} autoFocus={autoFocus}
          style={{
            width: '100%', background: 'var(--card)',
            border: `1.5px solid ${bad ? 'var(--orange)' : 'var(--line)'}`, borderRadius: 16,
            padding: '20px 46px 20px 18px', color: 'var(--ink)', fontSize: 24, fontWeight: 800,
            letterSpacing: '-0.03em', outline: 'none', boxSizing: 'border-box',
            fontFamily: 'var(--font-display), inherit', transition: 'border-color .18s ease',
          }}
        />
        <span style={{ position: 'absolute', right: 18, top: '50%', transform: 'translateY(-50%)', fontSize: 13, fontWeight: 700, color: 'var(--ink-3)', pointerEvents: 'none' }}>
          {unit}
        </span>
      </div>
    </div>
  );
}

export default function TargetsSetup({ initial, profile, onSave, onCancel }) {
  const [step, setStep] = useState(0);
  const [f, setF] = useState(initial);
  const set = (k) => (v) => setF((prev) => ({ ...prev, [k]: v }));

  const parsed = useMemo(() => parseSetupForm(f), [f]);
  const preview = useMemo(
    () => (parsed ? calculateTargets(parsed, (profile && profile.nutritionLog) || [], (profile && profile.weighIns) || []) : null),
    [parsed, profile]
  );

  const numOf = (v) => { const n = parseFloat(v); return isFinite(n) ? n : null; };
  const bad = (k, [lo, hi]) => f[k] !== '' && (numOf(f[k]) === null || numOf(f[k]) < lo || numOf(f[k]) > hi);
  const badAge = bad('age', INPUT_LIMITS.age);
  const badHeight = bad('height', INPUT_LIMITS.height);
  const badWeight = bad('weight', INPUT_LIMITS.weight);

  const canNext =
    step === 0 ? !!parsed && !!f.sex :
    step === 1 ? !!f.activity :
    step === 2 ? !!f.rate : true;

  const next = () => { if (step < STEP_COUNT - 1) setStep((s) => s + 1); else onSave(parsed); };
  const rate = RATE_OPTIONS.find((r) => r.id === f.rate);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'var(--bg)', color: 'var(--ink)', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 20px 140px', minHeight: '100%' }}>

        {/* Progress — segmented, so each step feels like ground gained */}
        <div style={{ paddingTop: 52 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {Array.from({ length: STEP_COUNT }).map((_, i) => (
              <div key={i} style={{ flex: 1, height: 4, borderRadius: 999, background: 'var(--soft)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 999,
                  width: i <= step ? '100%' : '0%',
                  background: i === step ? 'var(--accent-strong)' : 'var(--accent)',
                  transition: 'width .45s cubic-bezier(.4,0,.2,1)',
                }} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 9 }}>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.09em', fontWeight: 700 }}>
              STEP {step + 1} OF {STEP_COUNT}
            </div>
            <button onClick={onCancel} style={{ background: 'none', border: 'none', color: 'var(--ink-3)', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0 }}>Cancel</button>
          </div>
        </div>

        {/* ── STEP 1 — you ── */}
        {step === 0 && (
          <div key="s0">
            <Heading head="First," tail="about you" sub="These four numbers are all I need to work out what you burn. Nobody else in the pack sees them." />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, animation: 'gdRise .5s .05s ease both' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <NumField label="Height" unit="cm" value={f.height} onChange={set('height')} placeholder="180" bad={badHeight} autoFocus />
                <NumField label="Weight" unit="kg" value={f.weight} onChange={set('weight')} placeholder="85" bad={badWeight} />
              </div>
              <div style={{ width: 'calc(50% - 6px)' }}>
                <NumField label="Age" unit="yrs" value={f.age} onChange={set('age')} placeholder="32" bad={badAge} />
              </div>
              {(badHeight || badWeight || badAge) && (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--orange-ink)' }}>
                  {badHeight ? 'Height in cm (120–220). ' : ''}
                  {badWeight ? 'Weight in kg (35–250). ' : ''}
                  {badAge ? 'Age 14–90.' : ''}
                </p>
              )}
            </div>

            <p style={{ ...eyebrow, margin: '24px 0 10px' }}>Sex</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, animation: 'gdRise .5s .1s ease both' }}>
              {SEXES.map((s) => {
                const on = f.sex === s.id;
                return (
                  <button key={s.id} onClick={() => set('sex')(s.id)} style={{ ...card(on), justifyContent: 'center', textAlign: 'center', padding: '17px 10px', minHeight: 58, position: 'relative' }}>
                    {on && <span style={{ ...tick, position: 'absolute', top: 8, right: 8, width: 18, height: 18, fontSize: 10 }}>✓</span>}
                    <span style={{ fontSize: 14.5, fontWeight: 700, color: on ? 'var(--ink)' : 'var(--ink-2)' }}>{s.label}</span>
                  </button>
                );
              })}
            </div>
            <p style={{ margin: '12px 0 0', fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.55 }}>
              Male and female bodies burn slightly differently at rest &mdash; that&rsquo;s the only reason I ask.
            </p>
          </div>
        )}

        {/* ── STEP 2 — activity ── */}
        {step === 1 && (
          <div key="s1">
            <Heading head="How much do you" tail="actually move?" sub="Everything outside the gym counts too. Be honest — you can change it any time." />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {ACTIVITY_LEVELS.map((a, i) => {
                const on = f.activity === a.id;
                return (
                  <button key={a.id} onClick={() => set('activity')(a.id)} style={{ ...card(on), animation: `gdRise .45s ${0.04 * i}s ease both` }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15.5, fontWeight: 700, color: on ? 'var(--ink)' : 'var(--ink-2)' }}>{a.label}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2 }}>{a.hint}</div>
                    </div>
                    {on && <span style={tick}>✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── STEP 3 — goal ── */}
        {step === 2 && (
          <div key="s2">
            <Heading head="What are you" tail="chasing?" sub="Pick a pace you can live with. Slower always sticks better." />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {RATE_OPTIONS.map((r, i) => {
                const on = f.rate === r.id;
                return (
                  <button key={r.id} onClick={() => set('rate')(r.id)} style={{ ...card(on), animation: `gdRise .45s ${0.035 * i}s ease both` }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15.5, fontWeight: 700, color: on ? 'var(--ink)' : 'var(--ink-2)' }}>{r.label}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2 }}>{r.hint}</div>
                    </div>
                    {on && <span style={tick}>✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── STEP 4 — the reveal ── */}
        {step === 3 && preview && (
          <div key="s3">
            <Heading head="Here are" tail="your numbers" sub="Hit these most days and the rest takes care of itself." />

            {/* Hero */}
            <div className="gd-shine" style={{
              position: 'relative', borderRadius: 26, padding: '30px 20px 26px', textAlign: 'center',
              background: 'linear-gradient(160deg, var(--card) 0%, var(--soft) 100%)',
              border: '1px solid var(--line)',
              boxShadow: '0 24px 60px -30px var(--accent)',
              animation: 'gdRise .5s .05s ease both',
            }}>
              <p style={{ ...eyebrow, marginBottom: 10 }}>Your daily calories</p>
              <div className="gd-disp gd-grad-text" style={{ fontSize: 62, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.045em' }}>
                <CountUp to={preview.calories} />
              </div>
              <p style={{ margin: '12px 0 0', fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>
                You burn about <strong style={{ color: 'var(--ink)' }}>{preview.expenditure}</strong> a day
                {preview.weeklyRate !== 0 && <><br />aiming for <strong style={{ color: 'var(--ink)' }}>{preview.weeklyRate > 0 ? '+' : ''}{preview.weeklyRate} kg</strong> a week</>}
              </p>
            </div>

            {/* Macros */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 12 }}>
              {[
                { label: 'Protein', v: preview.protein, c: 'var(--accent)' },
                { label: 'Carbs', v: preview.carbs, c: 'var(--blue)' },
                { label: 'Fat', v: preview.fat, c: 'var(--orange)' },
              ].map((m, i) => (
                <div key={m.label} style={{
                  background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 18,
                  padding: '16px 10px', textAlign: 'center', animation: `gdRise .45s ${0.15 + 0.07 * i}s ease both`,
                }}>
                  <div style={{ height: 3, width: 28, background: m.c, borderRadius: 999, margin: '0 auto 10px' }} />
                  <div className="gd-disp" style={{ fontSize: 23, fontWeight: 800, letterSpacing: '-0.03em' }}>
                    <CountUp to={m.v} duration={700} /><span style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 700 }}>g</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 3, fontWeight: 600 }}>{m.label}</div>
                </div>
              ))}
            </div>

            {/* The bit that makes this more than a calculator */}
            <div style={{
              marginTop: 14, background: `linear-gradient(135deg, var(--ai-card-1), var(--ai-card-2))`,
              borderRadius: 20, padding: 18, display: 'flex', gap: 12,
              animation: 'gdRise .45s .38s ease both',
            }}>
              <span style={{ fontSize: 18, animation: 'gdFloat 4s ease-in-out infinite' }}>✨</span>
              <div>
                <div style={{ fontSize: 11, color: '#C9C5FF', fontWeight: 700, letterSpacing: '0.06em', marginBottom: 6 }}>GYM DADDY</div>
                <div style={{ fontSize: 13.5, color: '#D9D9E3', lineHeight: 1.6 }}>
                  {preview.floored
                    ? <>That&rsquo;s the lowest I&rsquo;ll take you. Under it you lose muscle, not fat.</>
                    : preview.rateCapped
                      ? <>I&rsquo;ve eased that back to a safe pace &mdash; faster isn&rsquo;t better, it&rsquo;s just harder to keep.</>
                      : rate && rate.rate < 0
                        ? <>Protein&rsquo;s deliberately high at {preview.protein}g. That&rsquo;s what protects your lifts while the weight comes off.</>
                        : rate && rate.rate > 0
                          ? <>Small surplus on purpose. Grow slowly and you stay lean doing it.</>
                          : <>Right on maintenance. Train hard and let the scale sit still.</>}
                  {' '}Right now this is an estimate. Log your food and weigh in weekly, and I&rsquo;ll replace it with what you <em>actually</em> burn.
                </div>
              </div>
            </div>

            <p style={{ margin: '16px 0 0', fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5, textAlign: 'center' }}>
              Estimates, not medical advice. Change any of it whenever you like.
            </p>
          </div>
        )}

        {/* Fixed action bar */}
        <div style={{
          position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480,
          padding: '16px 20px 32px', background: 'linear-gradient(to top, var(--bg) 68%, transparent)',
          display: 'flex', gap: 12,
        }}>
          {step > 0 && (
            <button onClick={() => setStep((s) => s - 1)} aria-label="Back" style={{
              padding: '17px 22px', borderRadius: 16, border: '1px solid var(--line)', background: 'var(--card)',
              color: 'var(--ink-2)', fontSize: 16, fontWeight: 700, cursor: 'pointer',
            }}>←</button>
          )}
          <button onClick={next} disabled={!canNext} className={canNext ? 'gd-shimbar' : undefined} style={{
            flex: 1, padding: 18, border: 'none', borderRadius: 16, fontSize: 16, fontWeight: 800,
            cursor: canNext ? 'pointer' : 'not-allowed',
            background: canNext ? 'var(--accent)' : 'var(--soft)',
            color: canNext ? 'var(--on-accent)' : 'var(--ink-3)',
            boxShadow: canNext ? '0 12px 30px -14px var(--accent)' : 'none',
            transition: 'background .2s ease, box-shadow .2s ease',
          }}>
            {step === STEP_COUNT - 1 ? 'Save my targets' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  );
}

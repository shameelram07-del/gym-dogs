'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMsal } from '@azure/msal-react';
import BottomNav from '@/components/BottomNav';
import Reveal from '@/components/Reveal';
import { eyebrow } from '@/lib/ui';

const exercises = [
  {
    id: 1,
    name: 'Incline Dumbbell Press',
    muscle: 'Chest · Anterior Deltoid',
    category: 'Push',
    safe: true,
    difficulty: 'Intermediate',
    steps: [
      { title: 'Set the bench', desc: 'Set bench to 45 degrees. No higher — protects your rotator cuff.' },
      { title: 'Grip and position', desc: 'Hold dumbbells at chest height, palms facing forward. Retract shoulder blades into the pad before lifting.' },
      { title: 'Lower slowly', desc: 'Lower the dumbbells slowly over 3 seconds. Feel the stretch in your chest at the bottom.' },
      { title: 'Drive up', desc: 'Drive up explosively. Exhale on the push. Dumbbells should travel up and slightly inward.' },
      { title: 'Squeeze at the top', desc: 'Squeeze your chest hard at the top for 1 second before lowering again.' },
    ],
    cues: [
      'Keep elbows at 45 degrees — not flared out wide',
      'Drive through your chest, not your shoulders',
      'Control the descent — 3 seconds down',
      'Keep lower back pressed to the bench throughout',
      'Squeeze hard at the top of every rep',
    ],
    warning: 'Stop if you feel any lower back discomfort. Keep feet flat on the floor.',
    muscles_primary: ['Pectoralis Major', 'Anterior Deltoid'],
    muscles_secondary: ['Triceps', 'Serratus Anterior'],
  },
  {
    id: 2,
    name: 'Cable Lateral Raise',
    muscle: 'Lateral Deltoid',
    category: 'Shoulders',
    safe: true,
    difficulty: 'Beginner',
    steps: [
      { title: 'Set up the cable', desc: 'Set the cable to the lowest position. Stand side-on to the machine.' },
      { title: 'Grip and stance', desc: 'Hold the handle with the hand furthest from the machine. Stand tall, slight bend in elbow.' },
      { title: 'Raise to shoulder height', desc: 'Raise your arm out to the side until it reaches shoulder height. Lead with your elbow.' },
      { title: 'Control the return', desc: 'Lower slowly back to start over 2-3 seconds. Resist the cable pulling you down.' },
    ],
    cues: [
      'Lead with your elbow, not your wrist',
      'Stop at shoulder height — going higher shifts load to traps',
      'Keep a slight bend in the elbow throughout',
      'Stand tall — no leaning to generate momentum',
    ],
    warning: null,
    muscles_primary: ['Lateral Deltoid'],
    muscles_secondary: ['Supraspinatus', 'Trapezius'],
  },
];

const cardStyle = { background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 26 };

// Chip vocabulary, shared with the rest of the app: ice for neutral facts,
// ember for anything the lifter should be careful about.
const chipBase = { fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 999, border: '1px solid' };
const chipIce = { ...chipBase, background: 'var(--blue-tint)', color: 'var(--blue-ink)', borderColor: 'var(--blue-tint)' };
const chipEmber = { ...chipBase, background: 'var(--orange-tint)', color: 'var(--orange-ink)', borderColor: 'var(--orange-tint)' };
const chipQuiet = { ...chipBase, background: 'var(--soft)', color: 'var(--ink-2)', borderColor: 'var(--line)' };

export default function ExercisePage() {
  const router = useRouter();
  const { accounts, inProgress } = useMsal();
  const [userId, setUserId] = useState(null);
  const [selected, setSelected] = useState(exercises[0]);
  const [activeStep, setActiveStep] = useState(0);
  const [activeCue, setActiveCue] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (inProgress !== 'none') return;
    if (accounts.length === 0) { router.push('/login'); return; }
    setUserId(accounts[0].localAccountId);
  }, [accounts, inProgress, router]);

  if (!userId) return null;

  const cycleExercise = (ex) => { setSelected(ex); setActiveStep(0); setActiveCue(0); };
  const nextStep = () => { if (activeStep < selected.steps.length - 1) setActiveStep(p => p + 1); };
  const prevStep = () => { if (activeStep > 0) setActiveStep(p => p - 1); };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)', paddingBottom: 100 }}>

      {/* ── HEADER ── */}
      <div style={{ padding: '52px 20px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.push('/workout')} aria-label="Back" style={{ width: 38, height: 38, borderRadius: 12, background: 'var(--soft)', border: '1px solid var(--line)', color: 'var(--ink)', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>‹</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className="gd-disp" style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{selected.name}</h1>
          <p style={{ margin: '1px 0 0', fontSize: 12, color: 'var(--ink-3)' }}>{selected.muscle}</p>
        </div>
        {selected.safe && (
          <span style={{ ...chipIce, flexShrink: 0 }}>Safe</span>
        )}
      </div>

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* ── SELECTOR ── */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
          {exercises.map((ex) => {
            const on = selected.id === ex.id;
            return (
              <button key={ex.id} onClick={() => cycleExercise(ex)} style={{
                flexShrink: 0, padding: '9px 14px', borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                background: on ? 'var(--accent-tint)' : 'var(--soft)',
                color: on ? 'var(--accent-strong)' : 'var(--ink-2)',
                border: 'none',
              }}>
                {ex.name.split(' ').slice(0, 2).join(' ')}
              </button>
            );
          })}
        </div>

        {/* ── ANIMATION STAGE ── */}
        <Reveal delay={0} style={{ ...cardStyle, overflow: 'hidden', position: 'relative' }}>
          <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 2 }}>
            <span style={{ ...chipBase, background: 'var(--grad)', color: 'var(--on-accent)', borderColor: 'transparent' }}>{selected.category}</span>
          </div>
          <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 2 }}>
            <span style={chipQuiet}>{selected.difficulty}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '36px 0 16px', background: 'var(--soft)' }}>
            {/* gdBounce lives in globals.css. It loops while playing because the
                user drives it with the button below; prefers-reduced-motion
                stops it at one cycle. */}
            <div style={{ fontSize: 84, marginBottom: 8, display: 'inline-block', animation: playing ? 'gdBounce 1.5s ease-in-out infinite' : 'none' }}>🏋️</div>
            <button onClick={() => setPlaying(!playing)} style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 999, padding: '7px 16px', fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', cursor: 'pointer' }}>
              {playing ? '⏸ Pause' : '▶ Play'}
            </button>
          </div>

          {/* Live cue */}
          <div style={{ margin: 14, background: 'var(--blue-tint)', borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--blue)', flexShrink: 0 }} />
            <p style={{ margin: 0, fontSize: 13, color: 'var(--blue-ink)', fontWeight: 500, lineHeight: 1.4 }}>{selected.cues[activeCue]}</p>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, paddingBottom: 16 }}>
            {selected.cues.map((_, i) => (
              <button key={i} onClick={() => setActiveCue(i)} aria-label={`Cue ${i + 1}`} style={{
                border: 'none', cursor: 'pointer', padding: 0, borderRadius: 999,
                width: i === activeCue ? 16 : 6, height: 6,
                background: i === activeCue ? 'var(--accent)' : 'var(--line)',
                transition: 'all 0.2s',
              }} />
            ))}
          </div>
        </Reveal>

        {/* ── FORM STEPS ── */}
        <Reveal delay={90} style={{ ...cardStyle, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--line-2)' }}>
            <p style={eyebrow}>Form steps</p>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-3)' }}>{activeStep + 1} of {selected.steps.length}</p>
          </div>
          <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {selected.steps.map((step, i) => {
              const on = i === activeStep;
              const done = i < activeStep;
              return (
                <button key={i} onClick={() => setActiveStep(i)} style={{
                  display: 'flex', gap: 12, alignItems: 'flex-start', textAlign: 'left', padding: 12, borderRadius: 14,
                  background: on ? 'var(--accent-tint)' : 'transparent', border: 'none', cursor: 'pointer',
                  opacity: done ? 0.55 : 1,
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, flexShrink: 0,
                    background: on ? 'var(--accent)' : 'var(--soft)',
                    color: on ? 'var(--on-accent)' : done ? 'var(--accent-strong)' : 'var(--ink-3)',
                  }}>
                    {done ? '✓' : i + 1}
                  </div>
                  <div style={{ paddingTop: 2 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: on ? 'var(--ink)' : 'var(--ink-2)' }}>{step.title}</p>
                    {on && <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>{step.desc}</p>}
                  </div>
                </button>
              );
            })}
          </div>
          <div style={{ padding: '0 12px 14px', display: 'flex', gap: 10 }}>
            <button onClick={prevStep} disabled={activeStep === 0} style={{ flex: 1, padding: 12, borderRadius: 14, background: 'var(--soft)', border: 'none', fontSize: 14, fontWeight: 700, color: 'var(--ink-2)', cursor: 'pointer', opacity: activeStep === 0 ? 0.4 : 1 }}>‹ Previous</button>
            <button onClick={nextStep} disabled={activeStep === selected.steps.length - 1} style={{ flex: 1, padding: 12, borderRadius: 14, background: 'var(--grad)', border: 'none', fontSize: 14, fontWeight: 700, color: 'var(--on-accent)', cursor: 'pointer', opacity: activeStep === selected.steps.length - 1 ? 0.4 : 1 }}>Next ›</button>
          </div>
        </Reveal>

        {/* ── MUSCLES ── */}
        <Reveal delay={180} style={{ ...cardStyle, padding: 18 }}>
          <p style={{ ...eyebrow, marginBottom: 12 }}>Muscles targeted</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {selected.muscles_primary.map((m) => (
              <span key={m} style={{ background: 'var(--accent-tint)', color: 'var(--accent-strong)', fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 999 }}>{m}</span>
            ))}
            {selected.muscles_secondary.map((m) => (
              <span key={m} style={{ background: 'var(--soft)', color: 'var(--ink-2)', fontSize: 12, fontWeight: 500, padding: '6px 12px', borderRadius: 999 }}>{m}</span>
            ))}
          </div>
        </Reveal>

        {/* ── WARNING ── */}
        {selected.warning && (
          <div style={{ background: 'var(--orange-tint)', borderRadius: 26, padding: 16, display: 'flex', gap: 12 }}>
            <span style={{ fontSize: 20 }}>⚠️</span>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--orange-ink)', lineHeight: 1.5 }}>{selected.warning}</p>
          </div>
        )}

      </div>

      <BottomNav />
    </div>
  );
}

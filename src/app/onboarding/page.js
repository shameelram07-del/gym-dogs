'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMsal } from '@azure/msal-react';
import QuoteCard from '@/components/QuoteCard';
import Reveal from '@/components/Reveal';

const PROFILES_URL = 'https://gymdogs-api-g9d0gve4angygdcj.newzealandnorth-01.azurewebsites.net/api/userProfiles';
const PROFILES_KEY = process.env.NEXT_PUBLIC_PROFILES_API_KEY;

const eyebrow = { fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', color: 'var(--ink-3)', textTransform: 'uppercase', margin: 0 };
const CARD_R = 26;

const STEPS = [
  {
    id: 'gender', label: 'First things first.', sublabel: 'What is your gender?', type: 'single', layout: 'list',
    options: [
      { id: 'male', label: 'Male' }, { id: 'female', label: 'Female' },
      { id: 'nonbinary', label: 'Non-binary' }, { id: 'prefer_not', label: 'Prefer not to say' },
    ],
  },
  {
    id: 'goals', label: 'What are you chasing?', sublabel: 'Pick all that apply.', type: 'multi', layout: 'grid2',
    options: [
      { id: 'build_muscle', label: 'Build muscle' }, { id: 'lose_fat', label: 'Lose body fat' },
      { id: 'get_stronger', label: 'Get stronger' }, { id: 'improve_fitness', label: 'Improve fitness' },
      { id: 'athletic', label: 'Athletic performance' }, { id: 'general_health', label: 'General health' },
    ],
  },
  {
    id: 'equipment', label: 'What do you have access to?', sublabel: 'Pick all that apply.', type: 'multi', layout: 'grid2',
    options: [
      { id: 'full_gym', label: 'Full gym' }, { id: 'home_gym', label: 'Home gym' },
      { id: 'dumbbells', label: 'Dumbbells only' }, { id: 'resistance', label: 'Resistance bands' },
      { id: 'bodyweight', label: 'Bodyweight only' }, { id: 'outdoor', label: 'Outdoor / park' },
    ],
  },
  {
    id: 'days', label: 'How many days can you train?', sublabel: 'Per week, realistically.', type: 'single', layout: 'list',
    options: [
      { id: '2', label: '2 days' }, { id: '3', label: '3 days' }, { id: '4', label: '4 days' }, { id: '5', label: '5+ days' },
    ],
  },
  {
    id: 'duration', label: 'How long per session?', sublabel: 'We will fit the plan to your schedule.', type: 'single', layout: 'list',
    options: [
      { id: '30', label: '30 minutes' }, { id: '45', label: '45 minutes' }, { id: '60', label: '60 minutes' }, { id: '75', label: '75+ minutes' },
    ],
  },
  {
    id: 'injuries', label: 'Any injuries or limitations?', sublabel: 'Pick all that apply. We will work around them.', type: 'multi', layout: 'grid2',
    options: [
      { id: 'lower_back', label: 'Lower back' }, { id: 'knees', label: 'Knees' }, { id: 'shoulders', label: 'Shoulders' },
      { id: 'wrists', label: 'Wrists' }, { id: 'neck', label: 'Neck' }, { id: 'none', label: 'None' },
    ],
  },
  {
    id: 'notes', label: 'Anything else we should know?', sublabel: 'Optional, but helpful.', type: 'text',
    placeholder: 'e.g. old shoulder injury, prefer morning workouts, travel often…',
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { accounts } = useMsal();
  const [userId, setUserId] = useState(null);
  const [profileRef, setProfileRef] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [finished, setFinished] = useState(false);
  const [buildProgress, setBuildProgress] = useState(0);

  useEffect(() => {
    if (!accounts || accounts.length === 0) return;
    const uid = accounts[0].localAccountId;
    setUserId(uid);
    (async () => {
      try {
        const res = await fetch(`${PROFILES_URL}?userId=${uid}`, { headers: { 'x-functions-key': PROFILES_KEY } });
        if (res.ok) {
          const data = await res.json();
          // Find THIS user's profile — data[0] could be someone else's document.
          const p = Array.isArray(data) ? data.find((x) => x.userId === uid) : data;
          if (p && !p.error) setProfileRef(p);
        }
      } catch (e) {}
    })();
  }, [accounts]);

  async function saveOnboarding() {
    if (!userId) return;
    let savedOk = false;
    try {
      const res = await fetch(PROFILES_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-functions-key': PROFILES_KEY },
        body: JSON.stringify({ ...(profileRef || {}), userId, onboarding: answers, onboardingComplete: true }),
      });
      savedOk = res.ok;
      if (!res.ok) console.error(`Onboarding: answers not saved (${res.status})`);
    } catch (e) {
      console.error('Onboarding: answers not saved', e);
    }
    // Remember on this device so login never loops back to onboarding, even if
    // the profile READ is flaky. Only after a confirmed write, though — setting
    // it on a failed save buries the answers with no way back to re-enter them.
    if (savedOk) {
      try { localStorage.setItem('gd-onboarded', userId); } catch (e) {}
    }
  }

  const step = STEPS[currentStep];
  const totalSteps = STEPS.length;

  function toggleOption(stepId, optionId, type) {
    setAnswers(prev => {
      const current = prev[stepId] || (type === 'multi' ? [] : null);
      if (type === 'multi') {
        if (optionId === 'none') return { ...prev, [stepId]: ['none'] };
        const withoutNone = current.filter(x => x !== 'none');
        return {
          ...prev,
          [stepId]: withoutNone.includes(optionId) ? withoutNone.filter(x => x !== optionId) : [...withoutNone, optionId],
        };
      }
      return { ...prev, [stepId]: optionId };
    });
  }

  function canNext() {
    if (step.type === 'text') return true;
    const val = answers[step.id];
    if (step.type === 'single') return !!val;
    if (step.type === 'multi') return val && val.length > 0;
    return false;
  }

  async function handleNext() {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(s => s + 1);
    } else {
      setFinished(true);
      saveOnboarding();
      let p = 0;
      const interval = setInterval(() => {
        p += Math.random() * 8 + 3;
        if (p >= 100) {
          p = 100;
          clearInterval(interval);
          setTimeout(() => router.push('/dashboard'), 800);
        }
        setBuildProgress(Math.min(p, 100));
      }, 200);
    }
  }

  // ─── FINISHED ───────────────────────────────────────────────
  if (finished) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 20px 40px' }}>
        <Reveal delay={0} style={{ textAlign: 'center' }}>
          <div className="gd-disp gd-grad-text" style={{ fontSize: 44, fontWeight: 700 }}>You are in.</div>
          <p style={{ fontSize: 15, color: 'var(--ink-2)', marginTop: 8 }}>Your plan is being built by Coach Shameel + AI.</p>
        </Reveal>

        <Reveal delay={90} style={{ marginTop: 28, width: '100%', maxWidth: 360, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: CARD_R, padding: 18 }}>
          <p style={{ ...eyebrow, marginBottom: 8 }}>Your plan preview</p>
          {[
            { day: 'Monday', label: 'Push', color: 'var(--accent)' },
            { day: 'Wednesday', label: 'Pull', color: 'var(--blue)' },
            { day: 'Friday', label: 'Legs', color: 'var(--violet)' },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderTop: i === 0 ? 'none' : '1px solid var(--line-2)' }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: item.color, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{item.label}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 1 }}>{item.day}</div>
              </div>
            </div>
          ))}
        </Reveal>

        <Reveal delay={180} style={{ marginTop: 24, width: '100%', maxWidth: 360 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--ink-2)', fontWeight: 600 }}>Building your plan…</span>
            <span style={{ fontSize: 12, color: 'var(--accent-strong)', fontWeight: 700 }}>{Math.round(buildProgress)}%</span>
          </div>
          <div style={{ height: 8, background: 'var(--soft)', borderRadius: 999, overflow: 'hidden' }}>
            <div className="gd-shimbar" style={{ height: '100%', width: `${buildProgress}%`, background: 'var(--grad)', borderRadius: 999, transition: 'width 0.2s ease' }} />
          </div>
        </Reveal>

        <Reveal delay={270} style={{ marginTop: 36, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, width: '100%', maxWidth: 360 }}>
          {[
            { icon: '🎯', title: 'Personalised', sub: 'Tailored to your goals and experience.' },
            { icon: '⚡', title: 'Smart adaptive', sub: 'Adjusts to your schedule, gear and recovery.' },
            { icon: '🧠', title: 'AI powered', sub: 'Built with advanced coaching AI.' },
            { icon: '🛡️', title: 'Built for you', sub: 'Your results, your way, every step.' },
          ].map((b, i) => (
            <div key={i} style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: CARD_R, padding: 16 }}>
              <div style={{ fontSize: 20, marginBottom: 6 }}>{b.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-strong)', marginBottom: 4 }}>{b.title}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.4 }}>{b.sub}</div>
            </div>
          ))}
        </Reveal>

        <Reveal delay={360} style={{ marginTop: 28, maxWidth: 320 }}>
          <QuoteCard mode="random" plain />
        </Reveal>
      </div>
    );
  }

  // ─── STEPS ───────────────────────────────────────────────
  const selectedVal = answers[step.id] || (step.type === 'multi' ? [] : null);
  const labelWords = step.label.split(' ');
  const labelHead = labelWords.slice(0, -2).join(' ');
  const labelTail = labelWords.slice(-2).join(' ');

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)', display: 'flex', flexDirection: 'column', padding: '0 20px 110px', maxWidth: 480, margin: '0 auto' }}>

      {/* Progress — deliberately outside the per-step Reveal so the bar slides
          between steps instead of fading out and back in. */}
      <div style={{ paddingTop: 52 }}>
        <div style={{ height: 6, background: 'var(--soft)', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${((currentStep + 1) / totalSteps) * 100}%`, background: 'var(--grad)', borderRadius: 999, transition: 'width 0.4s ease' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <div style={eyebrow}>
            Step {currentStep + 1} of {totalSteps}
          </div>
          <button onClick={async () => { await saveOnboarding(); router.push('/dashboard'); }} style={{
            background: 'none', border: 'none', color: 'var(--ink-3)', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0,
          }}>
            Skip for now
          </button>
        </div>
      </div>

      {/* Header — keyed on the step so the stagger replays as you advance */}
      <Reveal key={`h-${currentStep}`} delay={0} style={{ marginTop: 20, marginBottom: 24 }}>
        <h1 className="gd-disp" style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.2, margin: 0 }}>
          {labelHead}{labelHead ? ' ' : ''}<span className="gd-grad-text">{labelTail}</span>
        </h1>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', marginTop: 6, marginBottom: 0 }}>{step.sublabel}</p>
      </Reveal>

      {/* TEXT */}
      {step.type === 'text' && (
        <Reveal key={`t-${currentStep}`} delay={90}>
          <textarea
            placeholder={step.placeholder}
            value={answers[step.id] || ''}
            onChange={e => setAnswers(prev => ({ ...prev, [step.id]: e.target.value }))}
            style={{ width: '100%', minHeight: 120, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 16, color: 'var(--ink)', fontSize: 15, lineHeight: 1.5, resize: 'none', outline: 'none', boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', gap: 12, marginTop: 18, background: `linear-gradient(135deg, var(--ai-card-1), var(--ai-card-2))`, borderRadius: CARD_R, padding: 16 }}>
            <span style={{ fontSize: 18 }}>✨</span>
            <div>
              <div style={{ ...eyebrow, color: 'var(--on-dark-2)', marginBottom: 4 }}>Coach Shameel</div>
              <div style={{ fontSize: 13, color: 'var(--on-dark)', lineHeight: 1.5 }}>Thanks — this helps me build the perfect plan for you.</div>
            </div>
          </div>
        </Reveal>
      )}

      {/* LIST */}
      {step.type !== 'text' && step.layout === 'list' && (
        <Reveal key={`l-${currentStep}`} delay={90} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {step.options.map(opt => {
            const on = step.type === 'single' ? selectedVal === opt.id : selectedVal.includes(opt.id);
            return (
              <button key={opt.id} onClick={() => toggleOption(step.id, opt.id, step.type)} style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', width: '100%', textAlign: 'left', cursor: 'pointer',
                background: on ? 'var(--accent-tint)' : 'var(--card)',
                border: `1.5px solid ${on ? 'var(--accent)' : 'var(--line)'}`, borderRadius: 14,
              }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: on ? 'var(--ink)' : 'var(--ink-2)', flex: 1 }}>{opt.label}</span>
                {on && (
                  <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--accent)', color: 'var(--on-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>✓</span>
                )}
              </button>
            );
          })}
        </Reveal>
      )}

      {/* GRID2 */}
      {step.type !== 'text' && step.layout === 'grid2' && (
        <Reveal key={`g-${currentStep}`} delay={90} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {step.options.map(opt => {
            const on = step.type === 'single' ? selectedVal === opt.id : selectedVal.includes(opt.id);
            return (
              <button key={opt.id} onClick={() => toggleOption(step.id, opt.id, step.type)} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '22px 12px', cursor: 'pointer', position: 'relative', textAlign: 'center', minHeight: 78,
                background: on ? 'var(--accent-tint)' : 'var(--card)',
                border: `1.5px solid ${on ? 'var(--accent)' : 'var(--line)'}`, borderRadius: 16,
              }}>
                {on && (
                  <span style={{ position: 'absolute', top: 8, right: 8, width: 20, height: 20, borderRadius: '50%', background: 'var(--accent)', color: 'var(--on-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>✓</span>
                )}
                <span style={{ fontSize: 14, fontWeight: 700, color: on ? 'var(--ink)' : 'var(--ink-2)', lineHeight: 1.3 }}>{opt.label}</span>
              </button>
            );
          })}
        </Reveal>
      )}

      {/* Fixed NEXT */}
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, padding: '16px 20px 32px', background: 'linear-gradient(to top, var(--bg) 72%, transparent)' }}>
        <button onClick={handleNext} disabled={!canNext()} className="gd-disp" style={{
          width: '100%', padding: 17, border: 'none', borderRadius: 18, fontSize: 16, fontWeight: 700, cursor: canNext() ? 'pointer' : 'not-allowed',
          background: canNext() ? 'var(--grad)' : 'var(--soft)',
          color: canNext() ? 'var(--on-accent)' : 'var(--ink-3)',
          boxShadow: canNext() ? 'var(--glow-grad)' : 'none',
        }}>
          {currentStep === totalSteps - 1 ? 'Build my plan →' : 'Next →'}
        </button>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMsal } from '@azure/msal-react';

const API = 'https://gymdogs-api-g9d0gve4angygdcj.newzealandnorth-01.azurewebsites.net/api';

// ── Step definitions ──────────────────────────────────────────
const STEPS = [
  {
    id: 'gender',
    step: 1,
    label: 'First things first.',
    labelPurple: '',
    subtitle: "What's your gender?",
    type: 'single',
    options: [
      { id: 'male',           label: 'MALE',              icon: '/images/Onboard_icon_male.png' },
      { id: 'female',         label: 'FEMALE',            icon: '/images/Onboard_icon_female.png' },
      { id: 'nonbinary',      label: 'NON-BINARY',        icon: '/images/Onboard_icon_nonbinary.png' },
      { id: 'prefer_not',     label: 'PREFER NOT TO SAY', icon: '/images/Onboard_icon_prefer_not.png' },
    ],
    layout: 'list',
  },
  {
    id: 'goals',
    step: 2,
    label: 'What are you',
    labelPurple: 'chasing?',
    subtitle: 'Pick all that apply.',
    type: 'multi',
    options: [
      { id: 'build_muscle',   label: 'BUILD MUSCLE',          icon: '/images/Onboard_icon_build_muscle.png' },
      { id: 'lose_fat',       label: 'LOSE BODY FAT',         icon: '/images/Onboard_icon_athletic.png' },
      { id: 'get_stronger',   label: 'GET STRONGER',          icon: '/images/Onboard_icon_get_stronger.png' },
      { id: 'improve_fitness',label: 'IMPROVE FITNESS',       icon: '/images/Onboard_icon_improve_fitness.png' },
      { id: 'athletic',       label: 'ATHLETIC PERFORMANCE',  icon: '/images/Onboard_icon_athletic.png' },
      { id: 'general_health', label: 'GENERAL HEALTH',        icon: '/images/Onboard_icon_general_health.png' },
    ],
    layout: 'grid',
  },
  {
    id: 'equipment',
    step: 3,
    label: 'What do you',
    labelPurple: 'have access to?',
    subtitle: 'Pick all that apply.',
    type: 'multi',
    options: [
      { id: 'full_gym',          label: 'FULL GYM',         icon: '/images/Onboard_icon_full_gym.png' },
      { id: 'home_gym',          label: 'HOME GYM',         icon: '/images/Onboard_icon_home_gym.png' },
      { id: 'dumbbells',         label: 'DUMBBELLS ONLY',   icon: '/images/Onboard_icon_dumbbells.png' },
      { id: 'resistance_bands',  label: 'RESISTANCE BANDS', icon: '/images/Onboard_icon_resistance_bands.png' },
      { id: 'bodyweight',        label: 'BODYWEIGHT ONLY',  icon: '/images/Onboard_icon_bodyweight.png' },
      { id: 'outdoor',           label: 'OUTDOOR / PARK',   icon: '/images/Onboard_icon_outdoor.png' },
    ],
    layout: 'grid',
  },
  {
    id: 'days',
    step: 4,
    label: 'How many days',
    labelPurple: 'can you train?',
    subtitle: 'Per week, realistically.',
    type: 'single',
    options: [
      { id: '2', label: '2 DAYS', icon: '/images/icon_calender.png' },
      { id: '3', label: '3 DAYS', icon: '/images/icon_calender.png' },
      { id: '4', label: '4 DAYS', icon: '/images/icon_calender.png' },
      { id: '5', label: '5+ DAYS', icon: '/images/icon_calender.png' },
    ],
    layout: 'list',
  },
  {
    id: 'duration',
    step: 5,
    label: 'How long per',
    labelPurple: 'session?',
    subtitle: "We'll fit the plan to your schedule.",
    type: 'single',
    options: [
      { id: '30',  label: '30 MINUTES',  icon: '/images/icon_timer.png' },
      { id: '45',  label: '45 MINUTES',  icon: '/images/icon_timer.png' },
      { id: '60',  label: '60 MINUTES',  icon: '/images/icon_timer.png' },
      { id: '75',  label: '75+ MINUTES', icon: '/images/icon_timer.png' },
    ],
    layout: 'list',
  },
  {
    id: 'injuries',
    step: 6,
    label: 'Any injuries or',
    labelPurple: 'limitations?',
    subtitle: "Pick all that apply. We'll work around them.",
    type: 'multi',
    options: [
      { id: 'lower_back', label: 'LOWER BACK', icon: '/images/Onboard_icon_lower_back.png' },
      { id: 'knees',      label: 'KNEES',      icon: '/images/Onboard_icon_knees.png' },
      { id: 'shoulders',  label: 'SHOULDERS',  icon: '/images/Onboard_icon_shoulders.png' },
      { id: 'wrists',     label: 'WRISTS',     icon: '/images/Onboard_icon_wrists.png' },
      { id: 'neck',       label: 'NECK',       icon: '/images/Onboard_icon_neck.png' },
      { id: 'none',       label: 'NONE',       icon: '/images/Onboard_icon_none.png' },
    ],
    layout: 'grid',
  },
  {
    id: 'notes',
    step: 7,
    label: 'Anything else',
    labelPurple: 'we should know?',
    subtitle: 'Optional, but helpful.',
    type: 'text',
    layout: 'text',
  },
];

const TOTAL_STEPS = STEPS.length + 1; // +1 for final screen

export default function OnboardingPage() {
  const router = useRouter();
  const { accounts, inProgress } = useMsal();
  const [userId, setUserId] = useState(null);
  const [userName, setUserName] = useState('');
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [saving, setSaving] = useState(false);
  const [buildProgress, setBuildProgress] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (inProgress !== 'none') return;
    if (accounts.length === 0) { router.push('/login'); return; }
    const user = accounts[0];
    setUserId(user.localAccountId);
    const name = user.name && user.name !== 'unknown'
      ? user.name.split(' ')[0]
      : user.username?.split('@')[0] || 'Athlete';
    setUserName(name);
  }, [accounts, inProgress, router]);

  const currentStep = STEPS[step];
  const isLastStep = step === STEPS.length - 1;

  const toggleOption = (stepId, optionId, type) => {
    setAnswers(prev => {
      const current = prev[stepId] || (type === 'multi' ? [] : null);
      if (type === 'single') return { ...prev, [stepId]: optionId };
      if (type === 'multi') {
        // If selecting "none", clear others
        if (optionId === 'none') return { ...prev, [stepId]: ['none'] };
        const filtered = current.filter(id => id !== 'none');
        return {
          ...prev,
          [stepId]: filtered.includes(optionId)
            ? filtered.filter(id => id !== optionId)
            : [...filtered, optionId],
        };
      }
      return prev;
    });
  };

  const isSelected = (stepId, optionId) => {
    const val = answers[stepId];
    if (!val) return false;
    if (Array.isArray(val)) return val.includes(optionId);
    return val === optionId;
  };

  const canNext = () => {
    if (!currentStep) return false;
    if (currentStep.type === 'text') return true;
    const val = answers[currentStep.id];
    if (currentStep.type === 'single') return !!val;
    if (currentStep.type === 'multi') return val && val.length > 0;
    return false;
  };

  const handleNext = () => {
    if (isLastStep) {
      handleFinish();
    } else {
      setStep(s => s + 1);
    }
  };

  const handleFinish = async () => {
    setSaving(true);
    // Simulate building progress
    const interval = setInterval(() => {
      setBuildProgress(p => {
        if (p >= 100) { clearInterval(interval); return 100; }
        return p + 2;
      });
    }, 60);

    try {
      await fetch(`${API}/userProfiles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-functions-key': process.env.NEXT_PUBLIC_PROFILES_API_KEY || '',
        },
        body: JSON.stringify({
          userId,
          name: userName,
          onboarding: answers,
          onboardingComplete: true,
          updatedAt: new Date().toISOString(),
        }),
      });
    } catch (e) {
      console.error('Failed to save onboarding:', e);
    }

    setTimeout(() => {
      setSaving(false);
      setDone(true);
      setStep(STEPS.length); // final screen
    }, 3500);
  };

  if (!userId) return null;

  // ── FINAL SCREEN ──
  if (step === STEPS.length) {
    return (
      <div style={{ minHeight: '100vh', background: '#09090F', color: '#fff', fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 24px 40px', position: 'relative', overflow: 'hidden' }}>

        {/* Background glow */}
        <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)', width: 300, height: 300, background: 'radial-gradient(circle, rgba(109,40,217,0.4) 0%, transparent 70%)', pointerEvents: 'none' }} />

        {/* YOU'RE IN */}
        <h1 style={{ fontSize: 48, fontWeight: 900, letterSpacing: '-0.02em', textAlign: 'center', margin: '0 0 8px', position: 'relative', zIndex: 1 }}>YOU'RE IN.</h1>
        <p style={{ fontSize: 15, color: '#9ca3af', textAlign: 'center', margin: '0 0 32px', position: 'relative', zIndex: 1 }}>
          Your plan is being built by<br />
          <span style={{ color: '#a78bfa', fontWeight: 700 }}>Coach Shameel + AI.</span>
        </p>

        {/* Mascot */}
        <div style={{ position: 'relative', zIndex: 1, marginBottom: 28 }}>
          <div style={{ width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(109,40,217,0.3) 0%, transparent 70%)', position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none' }} />
          <img src="/images/gymdogs_logo.png" alt="Gym Dogs" style={{ width: 220, height: 220, objectFit: 'contain', display: 'block', filter: 'drop-shadow(0 0 30px rgba(139,92,246,0.4))' }}
            onError={(e) => { e.target.style.display = 'none'; }} />
        </div>

        {/* Plan preview */}
        <div style={{ width: '100%', maxWidth: 360, background: '#13131A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '16px', marginBottom: 20, position: 'relative', zIndex: 1 }}>
          <p style={{ margin: '0 0 12px', fontSize: 11, color: '#6b7280', fontWeight: 700, letterSpacing: '0.1em' }}>YOUR PLAN PREVIEW</p>
          {[
            { label: 'PUSH', day: 'MONDAY',    icon: '/images/Onboard_icon_build_muscle.png' },
            { label: 'PULL', day: 'WEDNESDAY', icon: '/images/Onboard_icon_get_stronger.png' },
            { label: 'LEGS', day: 'FRIDAY',    icon: '/images/Onboard_icon_bodyweight.png' },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}>
                <img src={item.icon} alt={item.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display='none'; }} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>{item.label}</p>
                <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>{item.day}</p>
              </div>
              <div style={{ marginLeft: 'auto', width: 24, height: 24, borderRadius: '50%', background: 'rgba(139,92,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#a78bfa' }}>›</div>
            </div>
          ))}
        </div>

        {/* Building progress */}
        <div style={{ width: '100%', maxWidth: 360, background: '#13131A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '14px 16px', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#a78bfa', letterSpacing: '0.06em' }}>
              {buildProgress < 100 ? 'BUILDING YOUR PLAN...' : 'PLAN READY! 🎉'}
            </p>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#a78bfa' }}>{buildProgress}%</p>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 6, height: 6 }}>
            <div style={{ width: `${buildProgress}%`, height: '100%', borderRadius: 6, background: 'linear-gradient(90deg, #7c3aed, #a78bfa)', transition: 'width 0.1s' }} />
          </div>
        </div>

        {/* Go to dashboard */}
        {buildProgress >= 100 && (
          <button onClick={() => router.push('/dashboard')} style={{
            marginTop: 24, width: '100%', maxWidth: 360,
            background: 'linear-gradient(135deg, #6d28d9, #4f46e5)',
            border: 'none', borderRadius: 18, padding: '18px 0',
            color: '#fff', fontSize: 16, fontWeight: 800, letterSpacing: '0.08em',
            cursor: 'pointer', boxShadow: '0 4px 20px rgba(109,40,217,0.4)',
            position: 'relative', zIndex: 1,
          }}>
            LET'S GO →
          </button>
        )}

        {/* Footer features */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginTop: 24, width: '100%', maxWidth: 360, position: 'relative', zIndex: 1 }}>
          {[
            { icon: '/images/icon_focus.png', label: 'PERSONALIZED', desc: 'Tailored to your goals and experience.' },
            { icon: '/images/icon_stats.png', label: 'SMART ADAPTIVE', desc: 'Adjusts to your schedule, equipment & recovery.' },
            { icon: '/images/icon_ai_coach.png', label: 'AI POWERED', desc: 'Built by advanced AI coaching technology.' },
            { icon: '/images/icon_star.png', label: 'BUILT FOR YOU', desc: 'Your results. Your way. Every step of the journey.' },
          ].map((f, i) => (
            <div key={i} style={{ background: '#13131A', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: '12px', display: 'flex', gap: 8 }}>
              <img src={f.icon} alt="" style={{ width: 28, height: 28, objectFit: 'contain', flexShrink: 0 }} onError={(e) => { e.target.style.display='none'; }} />
              <div>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: '#fff', letterSpacing: '0.05em' }}>{f.label}</p>
                <p style={{ margin: 0, fontSize: 9, color: '#6b7280', marginTop: 2, lineHeight: 1.4 }}>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── STEP SCREENS ──
  return (
    <div style={{ minHeight: '100vh', background: '#09090F', color: '#fff', fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column', padding: '52px 24px 120px', position: 'relative' }}>

      {/* Progress dots */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 32 }}>
        {STEPS.map((_, i) => (
          <div key={i} style={{
            height: 4, borderRadius: 4,
            width: i === step ? 24 : 8,
            background: i <= step ? '#7c3aed' : 'rgba(255,255,255,0.15)',
            transition: 'all 0.3s',
          }} />
        ))}
        <span style={{ marginLeft: 8, fontSize: 11, color: '#6b7280', fontWeight: 600 }}>{step + 1} of {STEPS.length}</span>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 11, color: '#a78bfa', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 6 }}>ONBOARDING</p>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 900, lineHeight: 1.1 }}>
            {currentStep.label}{' '}
            {currentStep.labelPurple && (
              <span style={{ color: '#a78bfa' }}>{currentStep.labelPurple}</span>
            )}
          </h1>
          {currentStep.subtitle && (
            <p style={{ margin: '8px 0 0', fontSize: 14, color: '#9ca3af' }}>{currentStep.subtitle}</p>
          )}
        </div>

        {/* Mascot on step 1 */}
        {step === 0 && (
          <img src="/images/gymdogs_logo.png" alt="" style={{ width: 80, height: 80, objectFit: 'contain', flexShrink: 0, marginLeft: 12 }}
            onError={(e) => { e.target.style.display = 'none'; }} />
        )}
      </div>

      {/* ── LIST layout ── */}
      {currentStep.layout === 'list' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
          {currentStep.options.map(opt => {
            const selected = isSelected(currentStep.id, opt.id);
            return (
              <button key={opt.id} onClick={() => toggleOption(currentStep.id, opt.id, currentStep.type)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  background: selected ? 'rgba(109,40,217,0.15)' : 'rgba(255,255,255,0.04)',
                  border: `1.5px solid ${selected ? '#7c3aed' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 16, padding: '14px 16px', cursor: 'pointer', textAlign: 'left',
                  transition: 'all 0.15s',
                }}>
                <img src={opt.icon} alt={opt.label} style={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 8 }}
                  onError={(e) => { e.target.style.display = 'none'; }} />
                <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: selected ? '#fff' : '#d1d5db', letterSpacing: '0.02em' }}>{opt.label}</span>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                  background: selected ? 'linear-gradient(135deg, #7c3aed, #4f46e5)' : 'transparent',
                  border: `2px solid ${selected ? '#7c3aed' : 'rgba(255,255,255,0.2)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, color: '#fff',
                }}>
                  {selected ? '✓' : ''}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ── GRID layout ── */}
      {currentStep.layout === 'grid' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginTop: 20 }}>
          {currentStep.options.map(opt => {
            const selected = isSelected(currentStep.id, opt.id);
            return (
              <button key={opt.id} onClick={() => toggleOption(currentStep.id, opt.id, currentStep.type)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
                  background: selected ? 'rgba(109,40,217,0.15)' : 'rgba(255,255,255,0.04)',
                  border: `1.5px solid ${selected ? '#7c3aed' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 16, padding: '16px 12px', cursor: 'pointer',
                  position: 'relative', transition: 'all 0.15s', minHeight: 100,
                }}>
                {selected && (
                  <div style={{ position: 'absolute', top: 8, right: 8, width: 20, height: 20, borderRadius: '50%', background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff' }}>✓</div>
                )}
                <img src={opt.icon} alt={opt.label} style={{ width: 52, height: 52, objectFit: 'contain', borderRadius: 10 }}
                  onError={(e) => { e.target.style.display = 'none'; }} />
                <span style={{ fontSize: 11, fontWeight: 800, color: selected ? '#fff' : '#9ca3af', letterSpacing: '0.04em', textAlign: 'center', lineHeight: 1.2 }}>{opt.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── TEXT layout ── */}
      {currentStep.layout === 'text' && (
        <div style={{ marginTop: 20 }}>
          <textarea
            placeholder="e.g. Old shoulder injury, prefer morning workouts, travel often, etc."
            value={answers.notes || ''}
            onChange={(e) => setAnswers(prev => ({ ...prev, notes: e.target.value }))}
            rows={5}
            style={{
              width: '100%', background: 'rgba(255,255,255,0.04)', border: '1.5px solid rgba(255,255,255,0.1)',
              borderRadius: 16, padding: '14px 16px', color: '#fff', fontSize: 14, lineHeight: 1.6,
              outline: 'none', resize: 'none', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box',
            }}
          />
          {/* Coach Shameel message */}
          <div style={{ display: 'flex', gap: 12, marginTop: 16, background: 'rgba(109,40,217,0.08)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 16, padding: '14px' }}>
            <img src="/images/icon_ai_coach.png" alt="Coach" style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }}
              onError={(e) => { e.target.style.display = 'none'; }} />
            <div>
              <p style={{ margin: '0 0 3px', fontSize: 10, fontWeight: 700, color: '#a78bfa', letterSpacing: '0.08em' }}>COACH SHAMEEL</p>
              <p style={{ margin: 0, fontSize: 13, color: '#c4b5fd', lineHeight: 1.5 }}>Thanks! This helps me build the perfect plan just for you.</p>
            </div>
          </div>
        </div>
      )}

      {/* ── NEXT button ── */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '16px 24px', background: 'linear-gradient(to top, #09090F 60%, transparent)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}>
        <button
          onClick={handleNext}
          disabled={!canNext() && currentStep.type !== 'text'}
          style={{
            width: '100%', background: canNext() || currentStep.type === 'text'
              ? 'linear-gradient(135deg, #6d28d9, #4f46e5)'
              : 'rgba(255,255,255,0.06)',
            border: 'none', borderRadius: 18, padding: '18px 0',
            color: canNext() || currentStep.type === 'text' ? '#fff' : '#4b5563',
            fontSize: 15, fontWeight: 800, letterSpacing: '0.08em',
            cursor: canNext() || currentStep.type === 'text' ? 'pointer' : 'not-allowed',
            boxShadow: canNext() || currentStep.type === 'text' ? '0 4px 20px rgba(109,40,217,0.4)' : 'none',
            transition: 'all 0.2s',
          }}
        >
          {isLastStep ? 'FINISH →' : 'NEXT →'}
        </button>

        {/* Back button */}
        {step > 0 && (
          <button onClick={() => setStep(s => s - 1)} style={{ width: '100%', background: 'none', border: 'none', color: '#6b7280', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginTop: 10, padding: '8px 0' }}>
            ← Back
          </button>
        )}
      </div>

    </div>
  );
}
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

// ─── STEP DEFINITIONS ────────────────────────────────────────────────────────

const STEPS = [
  {
    id: 'gender',
    label: 'First things first.',
    sublabel: "What's your gender?",
    type: 'single',
    showMascot: true,
    options: [
      { id: 'male',         label: 'MALE',             icon: '/images/Onboard_icon_male.png' },
      { id: 'female',       label: 'FEMALE',           icon: '/images/Onboard_icon_female.png' },
      { id: 'nonbinary',    label: 'NON-BINARY',       icon: '/images/Onboard_icon_nonbinary.png' },
      { id: 'prefer_not',   label: 'PREFER NOT TO SAY',icon: '/images/Onboard_icon_prefer_not.png' },
    ],
    layout: 'list', // single column list
  },
  {
    id: 'goals',
    label: 'What are you chasing?',
    sublabel: 'Pick all that apply.',
    type: 'multi',
    options: [
      { id: 'build_muscle',       label: 'BUILD MUSCLE',        icon: '/images/Onboard_icon_build_muscle.png' },
      { id: 'lose_fat',           label: 'LOSE BODY FAT',       icon: '/images/Onboard_icon_lose_fat.png' },
      { id: 'get_stronger',       label: 'GET STRONGER',        icon: '/images/Onboard_icon_get_stronger.png' },
      { id: 'improve_fitness',    label: 'IMPROVE FITNESS',     icon: '/images/Onboard_icon_improve_fitness.png' },
      { id: 'athletic',           label: 'ATHLETIC PERFORMANCE',icon: '/images/Onboard_icon_athletic.png' },
      { id: 'general_health',     label: 'GENERAL HEALTH',      icon: '/images/Onboard_icon_general_health.png' },
    ],
    layout: 'grid2', // 2-column grid
  },
  {
    id: 'equipment',
    label: 'What do you have access to?',
    sublabel: 'Pick all that apply.',
    type: 'multi',
    options: [
      { id: 'full_gym',        label: 'FULL GYM',          icon: '/images/Onboard_icon_full_gym.png' },
      { id: 'home_gym',        label: 'HOME GYM',          icon: '/images/Onboard_icon_home_gym.png' },
      { id: 'dumbbells',       label: 'DUMBBELLS ONLY',    icon: '/images/Onboard_icon_dumbbells.png' },
      { id: 'resistance',      label: 'RESISTANCE BANDS',  icon: '/images/Onboard_icon_resistance_bands.png' },
      { id: 'bodyweight',      label: 'BODYWEIGHT ONLY',   icon: '/images/Onboard_icon_bodyweight.png' },
      { id: 'outdoor',         label: 'OUTDOOR / PARK',    icon: '/images/Onboard_icon_outdoor.png' },
    ],
    layout: 'grid2',
  },
  {
    id: 'days',
    label: 'How many days can you train?',
    sublabel: 'Per week, realistically.',
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
    label: 'How long per session?',
    sublabel: "We'll fit the plan to your schedule.",
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
    label: 'Any injuries or limitations?',
    sublabel: "Pick all that apply. We'll work around them.",
    type: 'multi',
    options: [
      { id: 'lower_back', label: 'LOWER BACK', icon: '/images/Onboard_icon_lower_back.png' },
      { id: 'knees',      label: 'KNEES',      icon: '/images/Onboard_icon_knees.png' },
      { id: 'shoulders',  label: 'SHOULDERS',  icon: '/images/Onboard_icon_shoulders.png' },
      { id: 'wrists',     label: 'WRISTS',     icon: '/images/Onboard_icon_wrists.png' },
      { id: 'neck',       label: 'NECK',       icon: '/images/Onboard_icon_neck.png' },
      { id: 'none',       label: 'NONE',       icon: '/images/Onboard_icon_none.png' },
    ],
    layout: 'grid2',
  },
  {
    id: 'notes',
    label: 'Anything else we should know?',
    sublabel: 'Optional, but helpful.',
    type: 'text',
    placeholder: 'e.g. Old shoulder injury, prefer morning workouts, travel often, etc.',
  },
];

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [finished, setFinished] = useState(false);
  const [building, setBuilding] = useState(false);
  const [buildProgress, setBuildProgress] = useState(0);

  const step = STEPS[currentStep];
  const totalSteps = STEPS.length;

  // ── Toggle selection ──────────────────────────────────────────────────────
  function toggleOption(stepId, optionId, type) {
    setAnswers(prev => {
      const current = prev[stepId] || (type === 'multi' ? [] : null);
      if (type === 'multi') {
        // If "none" selected, clear everything else
        if (optionId === 'none') return { ...prev, [stepId]: ['none'] };
        const withoutNone = current.filter(x => x !== 'none');
        return {
          ...prev,
          [stepId]: withoutNone.includes(optionId)
            ? withoutNone.filter(x => x !== optionId)
            : [...withoutNone, optionId],
        };
      }
      return { ...prev, [stepId]: optionId };
    });
  }

  // ── Can we go next? ───────────────────────────────────────────────────────
  function canNext() {
    if (step.type === 'text') return true; // optional
    const val = answers[step.id];
    if (step.type === 'single') return !!val;
    if (step.type === 'multi') return val && val.length > 0;
    return false;
  }

  // ── Next / Finish ─────────────────────────────────────────────────────────
  async function handleNext() {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(s => s + 1);
    } else {
      // Last step — show YOU'RE IN, then build progress
      setFinished(true);
      setBuilding(true);
      // Animate progress bar
      let p = 0;
      const interval = setInterval(() => {
        p += Math.random() * 8 + 3;
        if (p >= 100) {
          p = 100;
          clearInterval(interval);
          // TODO: Save onboarding answers to CosmosDB via API
          // Then redirect to dashboard
          setTimeout(() => router.push('/dashboard'), 800);
        }
        setBuildProgress(Math.min(p, 100));
      }, 200);
    }
  }

  // ─── FINISHED SCREEN ─────────────────────────────────────────────────────
  if (finished) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#09090F',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        padding: '0 0 40px 0',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Purple glow background */}
        <div style={{
          position: 'absolute',
          top: '30%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '320px',
          height: '320px',
          background: 'radial-gradient(circle, rgba(124,58,237,0.35) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* YOU'RE IN heading */}
        <div style={{ marginTop: '60px', textAlign: 'center', zIndex: 1 }}>
          <div style={{
            fontSize: '48px',
            fontWeight: 900,
            color: '#ffffff',
            letterSpacing: '-1px',
            lineHeight: 1.1,
          }}>YOU'RE IN.</div>
          <div style={{
            fontSize: '15px',
            color: '#9ca3af',
            marginTop: '8px',
          }}>Your plan is being built by<br />Coach Shameel + AI.</div>
        </div>

        {/* Dog mascot */}
        <div style={{ marginTop: '24px', zIndex: 1 }}>
          <Image
            src="/images/gymdogs_logo.png"
            alt="Gym Dogs mascot"
            width={160}
            height={160}
            style={{ objectFit: 'contain' }}
          />
        </div>

        {/* Plan preview card */}
        <div style={{
          marginTop: '24px',
          width: '100%',
          maxWidth: '360px',
          background: '#13131A',
          border: '1px solid rgba(124,58,237,0.3)',
          borderRadius: '16px',
          padding: '16px',
          zIndex: 1,
        }}>
          <div style={{
            fontSize: '11px',
            color: '#6b7280',
            letterSpacing: '1.5px',
            marginBottom: '12px',
          }}>YOUR PLAN PREVIEW</div>

          {[
            { day: 'MONDAY',    label: 'PUSH',  color: '#7c3aed' },
            { day: 'WEDNESDAY', label: 'PULL',  color: '#6d28d9' },
            { day: 'FRIDAY',    label: 'LEGS',  color: '#5b21b6' },
          ].map((item, i) => (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 0',
              borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.06)' : 'none',
            }}>
              {/* Color dot */}
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: item.color,
                flexShrink: 0,
              }} />
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>{item.label}</div>
                <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>{item.day}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Building progress */}
        <div style={{
          marginTop: '24px',
          width: '100%',
          maxWidth: '360px',
          zIndex: 1,
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '8px',
          }}>
            <span style={{ fontSize: '12px', color: '#9ca3af', fontWeight: 600, letterSpacing: '1px' }}>
              BUILDING YOUR PLAN...
            </span>
            <span style={{ fontSize: '12px', color: '#7c3aed', fontWeight: 700 }}>
              {Math.round(buildProgress)}%
            </span>
          </div>
          <div style={{
            height: '6px',
            background: 'rgba(255,255,255,0.08)',
            borderRadius: '99px',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${buildProgress}%`,
              background: 'linear-gradient(90deg, #7c3aed, #a78bfa)',
              borderRadius: '99px',
              transition: 'width 0.2s ease',
            }} />
          </div>
        </div>

        {/* Bottom feature badges */}
        <div style={{
          marginTop: '40px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
          width: '100%',
          maxWidth: '360px',
          zIndex: 1,
        }}>
          {[
            { icon: '🎯', title: 'PERSONALIZED',   sub: 'Tailored to your goals and experience.' },
            { icon: '⚡', title: 'SMART ADAPTIVE',  sub: 'Adjusts to your schedule, equipment & recovery.' },
            { icon: '🧠', title: 'AI POWERED',      sub: 'Built by advanced AI coaching technology.' },
            { icon: '🛡️', title: 'BUILT FOR YOU',   sub: 'Your results. Your way. Every step of the journey.' },
          ].map((b, i) => (
            <div key={i} style={{
              background: '#13131A',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '12px',
              padding: '12px',
            }}>
              <div style={{ fontSize: '20px', marginBottom: '6px' }}>{b.icon}</div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#a78bfa', letterSpacing: '1px', marginBottom: '4px' }}>{b.title}</div>
              <div style={{ fontSize: '11px', color: '#6b7280', lineHeight: 1.4 }}>{b.sub}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── ONBOARDING STEPS ────────────────────────────────────────────────────
  const selectedVal = answers[step.id] || (step.type === 'multi' ? [] : null);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#09090F',
      display: 'flex',
      flexDirection: 'column',
      padding: '0 20px 100px 20px',
      maxWidth: '480px',
      margin: '0 auto',
    }}>

      {/* ── Progress bar ── */}
      <div style={{ paddingTop: '52px' }}>
        <div style={{
          height: '3px',
          background: 'rgba(255,255,255,0.08)',
          borderRadius: '99px',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${((currentStep + 1) / totalSteps) * 100}%`,
            background: 'linear-gradient(90deg, #7c3aed, #a78bfa)',
            borderRadius: '99px',
            transition: 'width 0.4s ease',
          }} />
        </div>
        <div style={{
          fontSize: '11px',
          color: '#6b7280',
          marginTop: '6px',
          letterSpacing: '1px',
        }}>
          ONBOARDING
        </div>
      </div>

      {/* ── Step header + optional mascot ── */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginTop: '20px',
        marginBottom: '28px',
      }}>
        <div style={{ flex: 1 }}>
          <h1 style={{
            fontSize: '28px',
            fontWeight: 800,
            color: '#ffffff',
            lineHeight: 1.2,
            margin: 0,
          }}>
            {/* Split label so second line is purple if it has 'chasing?' / 'access?' etc */}
            {step.label.split(' ').slice(0, -2).join(' ')}{' '}
            <span style={{ color: '#a78bfa' }}>
              {step.label.split(' ').slice(-2).join(' ')}
            </span>
          </h1>
          <p style={{
            fontSize: '14px',
            color: '#9ca3af',
            marginTop: '6px',
            marginBottom: 0,
          }}>{step.sublabel}</p>
        </div>

        {/* Mascot on step 1 only */}
        {step.showMascot && (
          <div style={{ flexShrink: 0, marginLeft: '12px' }}>
            <Image
              src="/images/shameel double_bicep_waist_up.png"
              alt="Coach Shameel"
              width={90}
              height={110}
              style={{ objectFit: 'contain' }}
            />
          </div>
        )}
      </div>

      {/* ── Options ── */}

      {/* TEXT step */}
      {step.type === 'text' && (
        <>
          <textarea
            placeholder={step.placeholder}
            value={answers[step.id] || ''}
            onChange={e => setAnswers(prev => ({ ...prev, [step.id]: e.target.value }))}
            style={{
              width: '100%',
              minHeight: '120px',
              background: '#13131A',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '14px',
              padding: '16px',
              color: '#ffffff',
              fontSize: '15px',
              lineHeight: 1.5,
              resize: 'none',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          {/* Coach note */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            marginTop: '20px',
            background: '#13131A',
            border: '1px solid rgba(124,58,237,0.25)',
            borderRadius: '14px',
            padding: '14px',
          }}>
            <Image
              src="/images/gymdogs_logo.png"
              alt="Coach"
              width={40}
              height={40}
              style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
            />
            <div>
              <div style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 700, letterSpacing: '1px', marginBottom: '4px' }}>
                COACH SHAMEEL
              </div>
              <div style={{ fontSize: '13px', color: '#9ca3af', lineHeight: 1.5 }}>
                Thanks! This helps me build the perfect plan just for you.
              </div>
            </div>
          </div>
        </>
      )}

      {/* LIST step (single column) */}
      {step.type !== 'text' && step.layout === 'list' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {step.options.map(opt => {
            const isSelected = step.type === 'single'
              ? selectedVal === opt.id
              : selectedVal.includes(opt.id);
            return (
              <button
                key={opt.id}
                onClick={() => toggleOption(step.id, opt.id, step.type)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  padding: '16px 18px',
                  background: isSelected
                    ? 'linear-gradient(135deg, rgba(124,58,237,0.25), rgba(109,40,217,0.15))'
                    : '#13131A',
                  border: isSelected
                    ? '1.5px solid #7c3aed'
                    : '1.5px solid rgba(255,255,255,0.07)',
                  borderRadius: '14px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                  width: '100%',
                }}
              >
                <Image
                  src={opt.icon}
                  alt={opt.label}
                  width={28}
                  height={28}
                  style={{ objectFit: 'contain', flexShrink: 0 }}
                />
                <span style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: isSelected ? '#ffffff' : '#9ca3af',
                  letterSpacing: '0.5px',
                  flex: 1,
                }}>
                  {opt.label}
                </span>
                {/* Checkmark */}
                {isSelected && (
                  <div style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    background: '#7c3aed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <span style={{ color: '#fff', fontSize: '13px' }}>✓</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* GRID2 step (2-column grid with icon cards) */}
      {step.type !== 'text' && step.layout === 'grid2' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '10px',
        }}>
          {step.options.map(opt => {
            const isSelected = step.type === 'single'
              ? selectedVal === opt.id
              : selectedVal.includes(opt.id);
            return (
              <button
                key={opt.id}
                onClick={() => toggleOption(step.id, opt.id, step.type)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  padding: '18px 12px',
                  background: isSelected
                    ? 'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(109,40,217,0.2))'
                    : '#13131A',
                  border: isSelected
                    ? '1.5px solid #7c3aed'
                    : '1.5px solid rgba(255,255,255,0.07)',
                  borderRadius: '16px',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'all 0.15s ease',
                  minHeight: '100px',
                }}
              >
                {/* Checkmark badge */}
                {isSelected && (
                  <div style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: '#7c3aed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <span style={{ color: '#fff', fontSize: '11px' }}>✓</span>
                  </div>
                )}
                <Image
                  src={opt.icon}
                  alt={opt.label}
                  width={44}
                  height={44}
                  style={{ objectFit: 'contain' }}
                />
                <span style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: isSelected ? '#ffffff' : '#9ca3af',
                  letterSpacing: '0.5px',
                  textAlign: 'center',
                  lineHeight: 1.3,
                }}>
                  {opt.label}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Fixed NEXT button ── */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: '480px',
        padding: '16px 20px 32px',
        background: 'linear-gradient(to top, #09090F 70%, transparent)',
      }}>
        <button
          onClick={handleNext}
          disabled={!canNext()}
          style={{
            width: '100%',
            padding: '18px',
            background: canNext()
              ? 'linear-gradient(135deg, #7c3aed, #6d28d9)'
              : 'rgba(255,255,255,0.06)',
            border: 'none',
            borderRadius: '14px',
            color: canNext() ? '#ffffff' : '#4b5563',
            fontSize: '16px',
            fontWeight: 700,
            letterSpacing: '1px',
            cursor: canNext() ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s ease',
          }}
        >
          {currentStep === totalSteps - 1 ? "LET'S GO →" : 'NEXT →'}
        </button>
      </div>
    </div>
  );
}
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const STEPS = [
  {
    id: 'gender',
    title: "First things first.",
    subtitle: "What's your gender?",
    type: 'single',
    options: [
      { label: 'Male', icon: '♂️' },
      { label: 'Female', icon: '♀️' },
      { label: 'Non-binary', icon: '⚧' },
      { label: 'Prefer not to say', icon: '🤐' },
    ],
  },
  {
    id: 'goals',
    title: "What are you chasing?",
    subtitle: "Pick all that apply.",
    type: 'multi',
    options: [
      { label: 'Build Muscle', icon: '💪' },
      { label: 'Lose Body Fat', icon: '🔥' },
      { label: 'Get Stronger', icon: '🏋️' },
      { label: 'Improve Fitness', icon: '❤️' },
      { label: 'Athletic Performance', icon: '⚡' },
      { label: 'General Health', icon: '🌿' },
    ],
  },
  {
    id: 'experience',
    title: "How long have you been training?",
    subtitle: "Be honest — we'll build the right plan.",
    type: 'single',
    options: [
      { label: 'Just starting out', icon: '🌱' },
      { label: '6 months – 1 year', icon: '📈' },
      { label: '1 – 3 years', icon: '💪' },
      { label: '3+ years', icon: '🏆' },
    ],
  },
  {
    id: 'equipment',
    title: "What do you have access to?",
    subtitle: "Pick all that apply.",
    type: 'multi',
    options: [
      { label: 'Full Gym', icon: '🏢' },
      { label: 'Home Gym', icon: '🏠' },
      { label: 'Dumbbells Only', icon: '🏋️' },
      { label: 'Resistance Bands', icon: '🔗' },
      { label: 'Bodyweight Only', icon: '🧘' },
      { label: 'Outdoor / Park', icon: '🌳' },
    ],
  },
  {
    id: 'days',
    title: "How many days can you train?",
    subtitle: "Per week, realistically.",
    type: 'single',
    options: [
      { label: '2 days', icon: '📅' },
      { label: '3 days', icon: '📅' },
      { label: '4 days', icon: '📅' },
      { label: '5+ days', icon: '📅' },
    ],
  },
  {
    id: 'duration',
    title: "How long per session?",
    subtitle: "We'll fit the plan to your schedule.",
    type: 'single',
    options: [
      { label: '30 minutes', icon: '⏱️' },
      { label: '45 minutes', icon: '⏱️' },
      { label: '60 minutes', icon: '⏱️' },
      { label: '75+ minutes', icon: '⏱️' },
    ],
  },
  {
    id: 'injuries',
    title: "Any injuries or limitations?",
    subtitle: "Pick all that apply. We'll work around them.",
    type: 'multi',
    options: [
      { label: 'Lower Back', icon: '🦴' },
      { label: 'Knees', icon: '🦵' },
      { label: 'Shoulders', icon: '💪' },
      { label: 'Wrists', icon: '🤲' },
      { label: 'Neck', icon: '🧠' },
      { label: 'None', icon: '✅' },
    ],
  },
  {
    id: 'bodystats',
    title: "Last step — body stats.",
    subtitle: "So we can track your progress over time.",
    type: 'inputs',
    fields: [
      { key: 'weight', label: 'Weight', unit: 'kg', placeholder: '82' },
      { key: 'height', label: 'Height', unit: 'cm', placeholder: '178' },
      { key: 'age', label: 'Age', unit: 'yrs', placeholder: '28' },
    ],
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [bodyInputs, setBodyInputs] = useState({ weight: '', height: '', age: '' });
  const [done, setDone] = useState(false);

  const current = STEPS[step];
  const progress = ((step) / STEPS.length) * 100;

  const selectSingle = (value) => setAnswers((prev) => ({ ...prev, [current.id]: value }));

  const toggleMulti = (value) => {
    const existing = answers[current.id] || [];
    if (existing.includes(value)) {
      setAnswers((prev) => ({ ...prev, [current.id]: existing.filter((v) => v !== value) }));
    } else {
      setAnswers((prev) => ({ ...prev, [current.id]: [...existing, value] }));
    }
  };

  const isSelected = (value) => {
    const val = answers[current.id];
    if (Array.isArray(val)) return val.includes(value);
    return val === value;
  };

  const canProceed = () => {
    if (current.type === 'inputs') return bodyInputs.weight && bodyInputs.height && bodyInputs.age;
    if (current.type === 'multi') return (answers[current.id] || []).length > 0;
    return !!answers[current.id];
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      setAnswers((prev) => ({ ...prev, bodystats: bodyInputs }));
      setDone(true);
    }
  };

  const handleBack = () => { if (step > 0) setStep((s) => s - 1); };

  if (done) {
    return (
      <div className="min-h-screen bg-[#080C14] text-white flex flex-col items-center justify-center px-5 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-500/15 rounded-full blur-3xl" />
          <div className="absolute bottom-1/3 right-0 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 text-center flex flex-col items-center gap-5">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-5xl shadow-2xl shadow-blue-500/30">
            🐾
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-wider">YOU'RE IN.</h1>
            <p className="text-slate-400 mt-2 text-sm tracking-wider">Your plan is being built by Coach Shameel + AI.</p>
          </div>
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full max-w-sm bg-gradient-to-r from-blue-500 to-violet-600 rounded-2xl py-4 text-white font-black tracking-widest text-sm uppercase shadow-lg shadow-blue-500/25"
          >
            GO TO DASHBOARD →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080C14] text-white flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-0 w-64 h-64 bg-violet-500/8 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 px-5 pt-14 pb-2">
        <div className="flex items-center justify-between mb-3">
          <button onClick={handleBack} className={`text-slate-500 text-sm tracking-wider ${step === 0 ? 'opacity-0 pointer-events-none' : ''}`}>
            ← BACK
          </button>
          <p className="text-xs text-slate-500 tracking-[3px] uppercase">{step + 1} of {STEPS.length}</p>
          <div className="w-12" />
        </div>
        <div className="w-full h-1 bg-white/8 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-blue-500 to-violet-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="relative z-10 px-5 pt-10 flex-1 flex flex-col">
        <p className="text-xs tracking-[3px] text-slate-500 uppercase">Onboarding</p>
        <h1 className="text-3xl font-black tracking-wider mt-2 leading-tight">{current.title}</h1>
        <p className="text-slate-400 text-sm mt-2 tracking-wide">{current.subtitle}</p>

        {(current.type === 'single' || current.type === 'multi') && (
          <div className="mt-8 grid grid-cols-2 gap-3">
            {current.options.map((opt) => {
              const selected = isSelected(opt.label);
              return (
                <button
                  key={opt.label}
                  onClick={() => current.type === 'single' ? selectSingle(opt.label) : toggleMulti(opt.label)}
                  className={`flex flex-col items-center justify-center gap-2 rounded-2xl p-4 border transition-all duration-200 ${
                    selected ? 'bg-gradient-to-br from-blue-500/25 to-violet-500/25 border-blue-500/60 shadow-lg shadow-blue-500/10' : 'bg-white/4 border-white/8'
                  }`}
                >
                  <span className="text-2xl">{opt.icon}</span>
                  <span className={`text-xs font-bold tracking-wider text-center uppercase ${selected ? 'text-white' : 'text-slate-400'}`}>{opt.label}</span>
                  {selected && <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-sm shadow-blue-400/50" />}
                </button>
              );
            })}
          </div>
        )}

        {current.type === 'inputs' && (
          <div className="mt-8 flex flex-col gap-4">
            {current.fields.map((field) => (
              <div key={field.key} className="bg-white/4 border border-white/8 rounded-2xl p-4">
                <p className="text-xs text-slate-500 tracking-widest uppercase mb-2">{field.label}</p>
                <div className="flex items-baseline gap-2">
                  <input
                    type="number"
                    placeholder={field.placeholder}
                    value={bodyInputs[field.key]}
                    onChange={(e) => setBodyInputs((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    className="flex-1 bg-transparent text-white text-4xl font-black font-mono outline-none placeholder:text-white/15"
                  />
                  <span className="text-slate-500 text-lg font-bold">{field.unit}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-auto pb-12 pt-8">
          <button
            onClick={handleNext}
            disabled={!canProceed()}
            className={`w-full rounded-2xl py-4 font-black tracking-widest text-sm uppercase transition-all duration-200 ${
              canProceed() ? 'bg-gradient-to-r from-blue-500 to-violet-600 text-white shadow-lg shadow-blue-500/25' : 'bg-white/5 text-slate-600 cursor-not-allowed'
            }`}
          >
            {step === STEPS.length - 1 ? 'BUILD MY PLAN →' : 'NEXT →'}
          </button>
        </div>
      </div>
    </div>
  );
}
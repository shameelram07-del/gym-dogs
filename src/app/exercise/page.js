'use client';

import { useState } from 'react';

const exercises = [
  {
    id: 1,
    name: 'Incline Dumbbell Press',
    muscle: 'Chest - Anterior Deltoid',
    category: 'PUSH',
    safe: true,
    difficulty: 'Intermediate',
    steps: [
      { title: 'Set the bench', desc: 'Set bench to 45 degrees. No higher - protects your rotator cuff.' },
      { title: 'Grip and position', desc: 'Hold dumbbells at chest height, palms facing forward. Retract shoulder blades into the pad before lifting.' },
      { title: 'Lower slowly', desc: 'Lower the dumbbells slowly over 3 seconds. Feel the stretch in your chest at the bottom.' },
      { title: 'Drive up', desc: 'Drive up explosively. Exhale on the push. Dumbbells should travel up and slightly inward.' },
      { title: 'Squeeze at the top', desc: 'Squeeze your chest hard at the top for 1 second before lowering again.' },
    ],
    cues: [
      'Keep elbows at 45 degrees - not flared out wide',
      'Drive through your chest, not your shoulders',
      'Control the descent - 3 seconds down',
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
    category: 'SHOULDERS',
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
      'Stop at shoulder height - going higher shifts load to traps',
      'Keep a slight bend in the elbow throughout',
      'Stand tall - no leaning to generate momentum',
    ],
    warning: null,
    muscles_primary: ['Lateral Deltoid'],
    muscles_secondary: ['Supraspinatus', 'Trapezius'],
  },
];

const navItems = [
  { icon: '🏠', label: 'Home', href: '/dashboard' },
  { icon: '📋', label: 'Log', href: '/workout' },
  { icon: '📈', label: 'Progress', href: '/progress' },
  { icon: '🏆', label: 'Community', href: '/community' },
  { icon: '⚙️', label: 'Profile', href: '/profile' },
];

export default function ExercisePage() {
  const [selected, setSelected] = useState(exercises[0]);
  const [activeStep, setActiveStep] = useState(0);
  const [activeCue, setActiveCue] = useState(0);
  const [playing, setPlaying] = useState(true);

  const cycleExercise = (ex) => {
    setSelected(ex);
    setActiveStep(0);
    setActiveCue(0);
  };

  const nextStep = () => {
    if (activeStep < selected.steps.length - 1) {
      setActiveStep(prev => prev + 1);
    }
  };

  const prevStep = () => {
    if (activeStep > 0) {
      setActiveStep(prev => prev - 1);
    }
  };

  return (
    <div className="min-h-screen bg-[#050810] text-white pb-24">

      {/* Header */}
      <div className="px-5 pt-12 pb-4 flex items-center gap-3">
        <a href="/workout" className="w-9 h-9 bg-white/6 rounded-xl flex items-center justify-center text-lg">
          ←
        </a>
        <div className="flex-1">
          <h1 className="text-lg font-black tracking-wider leading-tight">{selected.name}</h1>
          <p className="text-xs text-slate-500 mt-0.5">{selected.muscle}</p>
        </div>
        {selected.safe && (
          <span className="bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs px-3 py-1 rounded-full font-bold">
            💚 SAFE
          </span>
        )}
      </div>

      {/* Exercise selector */}
      <div className="px-5 flex gap-2 mb-4 overflow-x-auto pb-1">
        {exercises.map((ex) => (
          <button
            key={ex.id}
            onClick={() => cycleExercise(ex)}
            className={`flex-shrink-0 px-4 py-2 rounded-2xl text-xs font-bold tracking-wider border transition-all ${
              selected.id === ex.id
                ? 'bg-blue-500/15 border-blue-500/30 text-blue-400'
                : 'bg-white/4 border-white/8 text-slate-500'
            }`}
          >
            {ex.name.split(' ').slice(0, 2).join(' ')}
          </button>
        ))}
      </div>

      {/* Animation stage */}
      <div className="mx-5 rounded-3xl overflow-hidden bg-gradient-to-b from-[#0A1628] to-[#060A14] border border-white/5 relative">
        
        {/* Phase badge */}
        <div className="absolute top-3 left-3 z-10">
          <span className="bg-gradient-to-r from-blue-500 to-violet-600 text-white text-xs px-3 py-1 rounded-full font-bold tracking-wider">
            {selected.category}
          </span>
        </div>

        {/* Difficulty */}
        <div className="absolute top-3 right-3 z-10">
          <span className="bg-white/8 border border-white/10 text-slate-300 text-xs px-3 py-1 rounded-full font-bold">
            {selected.difficulty}
          </span>
        </div>

        {/* Character animation area */}
        <div className="flex flex-col items-center justify-center py-10 relative">
          <div className="text-8xl mb-2" style={{
            animation: playing ? 'bounce 1.5s ease-in-out infinite' : 'none',
            display: 'inline-block'
          }}>
            🏋️
          </div>
          <style>{`
            @keyframes bounce {
              0%, 100% { transform: translateY(0px); }
              50% { transform: translateY(-10px); }
            }
          `}</style>

          {/* Play/pause */}
          <button
            onClick={() => setPlaying(!playing)}
            className="mt-2 bg-white/8 border border-white/10 rounded-full px-4 py-1.5 text-xs font-bold tracking-wider text-slate-300"
          >
            {playing ? '⏸ PAUSE' : '▶ PLAY'}
          </button>
        </div>

        {/* Live cue */}
        <div className="mx-4 mb-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl px-4 py-3 flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0 animate-pulse" />
          <p className="text-xs text-blue-300 font-medium leading-relaxed">
            {selected.cues[activeCue]}
          </p>
        </div>

        {/* Cue dots */}
        <div className="flex justify-center gap-1.5 pb-4">
          {selected.cues.map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveCue(i)}
              className={`rounded-full transition-all ${
                i === activeCue ? 'w-4 h-1.5 bg-blue-400' : 'w-1.5 h-1.5 bg-white/20'
              }`}
            />
          ))}
        </div>

      </div>

      {/* Step by step */}
      <div className="mx-5 mt-4 bg-white/4 border border-white/8 rounded-3xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5 flex justify-between items-center">
          <p className="text-xs tracking-[3px] text-slate-500 uppercase">Form Steps</p>
          <p className="text-xs text-slate-600">{activeStep + 1} of {selected.steps.length}</p>
        </div>

        {/* Steps list */}
        <div className="px-4 py-3 flex flex-col gap-2">
          {selected.steps.map((step, i) => (
            <button
              key={i}
              onClick={() => setActiveStep(i)}
              className={`flex gap-3 items-start text-left p-3 rounded-2xl transition-all ${
                i === activeStep ? 'bg-blue-500/8 border border-blue-500/15' :
                i < activeStep ? 'opacity-40' : 'opacity-60'
              }`}
            >
              <div className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                i < activeStep ? 'bg-teal-500/15 text-teal-400' :
                i === activeStep ? 'bg-gradient-to-br from-blue-500 to-violet-600 text-white' :
                'bg-white/6 text-slate-500'
              }`}>
                {i < activeStep ? '✓' : i + 1}
              </div>
              <div className="pt-0.5">
                <p className={`text-sm font-semibold ${i === activeStep ? 'text-white' : 'text-slate-400'}`}>
                  {step.title}
                </p>
                {i === activeStep && (
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">{step.desc}</p>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Step navigation */}
        <div className="px-4 pb-4 flex gap-3">
          <button
            onClick={prevStep}
            disabled={activeStep === 0}
            className="flex-1 py-3 rounded-2xl bg-white/5 border border-white/10 text-sm font-bold text-slate-400 disabled:opacity-30"
          >
            ← Previous
          </button>
          <button
            onClick={nextStep}
            disabled={activeStep === selected.steps.length - 1}
            className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-blue-500 to-violet-600 text-sm font-bold disabled:opacity-30"
          >
            Next →
          </button>
        </div>
      </div>

      {/* Muscles targeted */}
      <div className="mx-5 mt-4 bg-white/4 border border-white/8 rounded-3xl p-4">
        <p className="text-xs tracking-[3px] text-slate-500 uppercase mb-3">Muscles Targeted</p>
        <div className="flex flex-wrap gap-2">
          {selected.muscles_primary.map((m) => (
            <span key={m} className="bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs px-3 py-1 rounded-full font-semibold">
              {m}
            </span>
          ))}
          {selected.muscles_secondary.map((m) => (
            <span key={m} className="bg-white/5 border border-white/10 text-slate-400 text-xs px-3 py-1 rounded-full">
              {m}
            </span>
          ))}
        </div>
      </div>

      {/* Warning */}
      {selected.warning && (
        <div className="mx-5 mt-4 bg-orange-500/8 border border-orange-500/15 rounded-3xl p-4 flex gap-3">
          <span className="text-xl">⚠️</span>
          <p className="text-xs text-orange-300 leading-relaxed">{selected.warning}</p>
        </div>
      )}

      {/* Bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-[#0E1624]/95 backdrop-blur border-t border-white/7 flex items-center justify-around px-2 py-2">
        {navItems.map((item) => (
          <a key={item.label} href={item.href} className="flex flex-col items-center gap-1 flex-1 py-1">
            <span className="text-xl opacity-40">{item.icon}</span>
            <span className="text-xs tracking-wider text-slate-600">{item.label}</span>
          </a>
        ))}
      </div>

    </div>
  );
}
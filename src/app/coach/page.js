'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMsal } from '@azure/msal-react';
import { exerciseLibrary, muscleGroups } from '@/lib/exercises';
import BottomNav from '@/components/BottomNav';
import Reveal from '@/components/Reveal';

const PLANS_API_URL = 'https://gymdogs-api-g9d0gve4angygdcj.newzealandnorth-01.azurewebsites.net/api/workoutPlans';
const PLANS_API_KEY = process.env.NEXT_PUBLIC_PLANS_API_KEY;
const AI_COACH_URL = 'https://gymdogs-api-g9d0gve4angygdcj.newzealandnorth-01.azurewebsites.net/api/aiCoach';
const AI_COACH_KEY = process.env.NEXT_PUBLIC_AI_COACH_KEY;

const clients = [
  { id: 1, name: 'Joel',   initials: 'JM', goal: 'Build muscle',        readiness: 91, streak: 7, trainedToday: true,  alert: null,                 lastSession: 'Chest & Shoulders', sessionsThisWeek: 5, weight: 84 },
  { id: 2, name: 'Hamish', initials: 'HT', goal: 'Lose body fat',       readiness: 74, streak: 3, trainedToday: true,  alert: null,                 lastSession: 'Lower Body',        sessionsThisWeek: 3, weight: 91 },
  { id: 3, name: 'Zafi',   initials: 'ZK', goal: 'Get stronger',        readiness: 58, streak: 1, trainedToday: false, alert: 'Missed 2 sessions',  lastSession: 'Pull Day',          sessionsThisWeek: 2, weight: 78 },
  { id: 4, name: 'Priya',  initials: 'PK', goal: 'General health',      readiness: 45, streak: 0, trainedToday: false, alert: 'Deload recommended', lastSession: 'Full Body',         sessionsThisWeek: 1, weight: 62 },
  { id: 5, name: 'Marcus', initials: 'MR', goal: 'Athletic performance',readiness: 83, streak: 5, trainedToday: true,  alert: null,                 lastSession: 'Push Day',          sessionsThisWeek: 4, weight: 88 },
];

function readinessStyle(score) {
  if (score >= 80) return { ink: 'var(--accent-strong)', bg: 'var(--accent-tint)', label: 'Ready' };
  if (score >= 60) return { ink: 'var(--blue-ink)', bg: 'var(--blue-tint)', label: 'Moderate' };
  if (score >= 40) return { ink: 'var(--orange-ink)', bg: 'var(--orange-tint)', label: 'Fatigued' };
  return { ink: 'var(--red-ink)', bg: 'var(--red-tint)', label: 'Rest day' };
}

const emptyExercise = () => ({ muscleGroup: 'CHEST', name: '', sets: 3, reps: '10-12', cue: '' });

// AI plan builder — deterministic fallback templates so a draft is always produced.
const PLAN_TEMPLATES = {
  STRENGTH:    [['CHEST', 2], ['BACK', 2], ['LEGS', 2]],
  HYPERTROPHY: [['CHEST', 2], ['BACK', 2], ['SHOULDERS', 1], ['BICEPS', 1], ['TRICEPS', 1]],
  CARDIO:      [['CARDIO', 3]],
  DELOAD:      [['CHEST', 1], ['BACK', 1], ['LEGS', 1]],
  'FULL BODY': [['CHEST', 1], ['BACK', 1], ['LEGS', 1], ['SHOULDERS', 1], ['CORE', 1]],
};
function buildFromTemplate(tag) {
  const tpl = PLAN_TEMPLATES[tag] || PLAN_TEMPLATES['FULL BODY'];
  const out = [];
  tpl.forEach(([group, count]) => {
    (exerciseLibrary[group] || []).slice(0, count).forEach(e => out.push({ muscleGroup: group, name: e.name, sets: e.defaultSets, reps: e.defaultReps, cue: e.cue }));
  });
  return out.length ? out : [emptyExercise()];
}
function findExercise(name) {
  const target = String(name).toLowerCase().trim();
  for (const group of muscleGroups) {
    const found = exerciseLibrary[group]?.find(e => e.name.toLowerCase() === target);
    if (found) return { muscleGroup: group, name: found.name, sets: found.defaultSets, reps: found.defaultReps, cue: found.cue };
  }
  return null;
}

const eyebrow = { fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', color: 'var(--ink-3)', textTransform: 'uppercase', margin: 0 };
const fieldLabel = { fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--ink-3)', textTransform: 'uppercase', margin: '0 0 8px' };
const inputStyle = { width: '100%', background: 'var(--soft)', border: '1px solid var(--line)', borderRadius: 12, padding: '12px 14px', color: 'var(--ink)', fontSize: 14, fontWeight: 600, outline: 'none', boxSizing: 'border-box' };

function Avatar({ initials, size = 44, online }) {
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <div style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg, var(--violet), var(--blue))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.32, fontWeight: 700, color: '#fff' }}>{initials}</div>
      {online !== undefined && (
        <div style={{ position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: '50%', background: online ? 'var(--accent)' : 'var(--orange)', border: '2px solid var(--card)' }} />
      )}
    </div>
  );
}

export default function CoachDashboard() {
  const router = useRouter();
  const { accounts, inProgress } = useMsal();
  const [userId, setUserId] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [filter, setFilter] = useState('all');
  const [view, setView] = useState('clients');
  const [planName, setPlanName] = useState('');
  const [planTag, setPlanTag] = useState('STRENGTH');
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0]);
  const [exercises, setExercises] = useState([emptyExercise()]);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);
  const [activePlan, setActivePlan] = useState(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (inProgress !== 'none') return;
    if (accounts.length === 0) { router.push('/login'); return; }
    setUserId(accounts[0].localAccountId);
  }, [accounts, inProgress, router]);

  useEffect(() => {
    if (!userId) return;
    fetchActivePlan();
  }, [userId]);

  const fetchActivePlan = async () => {
    try {
      const res = await fetch(PLANS_API_URL, { headers: { 'x-functions-key': PLANS_API_KEY } });
      if (res.ok) setActivePlan(await res.json());
    } catch (e) {}
  };

  const addExercise = () => setExercises(prev => [...prev, emptyExercise()]);
  const removeExercise = (idx) => setExercises(prev => prev.filter((_, i) => i !== idx));
  const updateMuscleGroup = (idx, muscleGroup) => setExercises(prev => { const u = [...prev]; u[idx] = { ...emptyExercise(), muscleGroup }; return u; });
  const updateExerciseName = (idx, name) => {
    const found = exerciseLibrary[exercises[idx].muscleGroup]?.find(e => e.name === name);
    setExercises(prev => { const u = [...prev]; u[idx] = { ...u[idx], name, sets: found?.defaultSets ?? 3, reps: found?.defaultReps ?? '10-12', cue: found?.cue ?? '' }; return u; });
  };
  const updateExercise = (idx, field, value) => setExercises(prev => { const u = [...prev]; u[idx] = { ...u[idx], [field]: value }; return u; });

  const generatePlan = async () => {
    setGenerating(true); setSaveMsg(null);
    try {
      const catalogue = muscleGroups.map(g => `${g}: ${exerciseLibrary[g].map(e => e.name).join(', ')}`).join('\n');
      const prompt = `You are a strength coach. Design a ${planTag} gym session of 5 exercises. Choose ONLY exercises from this catalogue. Reply with ONLY a JSON array, no prose, in the form [{"name":"exact name","sets":3,"reps":"10-12"}].\nCatalogue:\n${catalogue}`;
      let text = '';
      try {
        const res = await fetch(AI_COACH_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-functions-key': AI_COACH_KEY },
          body: JSON.stringify({ message: prompt, prompt }),
        });
        if (res.ok) { const d = await res.json(); text = d.reply || d.message || (typeof d === 'string' ? d : ''); }
      } catch (e) {}

      let parsed = [];
      const match = text && text.match(/\[[\s\S]*\]/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]).map(item => {
            const lib = findExercise(item.name);
            return lib ? { ...lib, sets: item.sets || lib.sets, reps: item.reps || lib.reps } : null;
          }).filter(Boolean);
        } catch (e) {}
      }

      const usedAI = parsed.length >= 3;
      setExercises(usedAI ? parsed : buildFromTemplate(planTag));
      if (!planName.trim()) setPlanName(`${planTag.charAt(0) + planTag.slice(1).toLowerCase()} session`);
      setSaveMsg({ type: 'success', text: usedAI ? 'AI draft ready — review and publish.' : 'Draft built from template — review and publish.' });
    } catch (e) {
      setExercises(buildFromTemplate(planTag));
      setSaveMsg({ type: 'success', text: 'Draft ready — review and publish.' });
    } finally {
      setGenerating(false);
    }
  };

  const handlePublish = async (isActive) => {
    if (!planName.trim()) { setSaveMsg({ type: 'error', text: 'Please enter a session name' }); return; }
    if (exercises.some(e => !e.name.trim())) { setSaveMsg({ type: 'error', text: 'Please select all exercise names' }); return; }
    setSaving(true); setSaveMsg(null);
    try {
      const plan = { id: Date.now().toString(), name: planName, tag: planTag, date: sessionDate, exercises, isActive, createdAt: new Date().toISOString() };
      const res = await fetch(PLANS_API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-functions-key': PLANS_API_KEY }, body: JSON.stringify(plan) });
      if (res.ok) {
        setSaveMsg({ type: 'success', text: isActive ? 'Session published and set as active.' : 'Session saved as draft.' });
        if (isActive) { setActivePlan(plan); setPlanName(''); setSessionDate(new Date().toISOString().split('T')[0]); setExercises([emptyExercise()]); }
      } else { setSaveMsg({ type: 'error', text: 'Failed to save. Try again.' }); }
    } catch (e) { setSaveMsg({ type: 'error', text: 'Failed to save. Try again.' }); }
    finally { setSaving(false); }
  };

  if (!userId) return null;

  const trainedToday = clients.filter(c => c.trainedToday).length;
  const alerts = clients.filter(c => c.alert).length;
  const avgReadiness = Math.round(clients.reduce((a, c) => a + c.readiness, 0) / clients.length);
  const filteredClients = clients.filter(c => {
    if (filter === 'trained') return c.trainedToday;
    if (filter === 'alerts') return c.alert;
    if (filter === 'rest') return !c.trainedToday;
    return true;
  });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)', paddingBottom: 100 }}>

      {/* ── HEADER ── */}
      <div style={{ padding: '52px 20px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-2)' }}>Coach view</p>
          <h1 style={{ margin: '2px 0 0', fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>Coach HQ</h1>
        </div>
        <Avatar initials="SC" size={42} />
      </div>

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── STATS ── */}
        <Reveal>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {[
            { value: `${trainedToday}/${clients.length}`, label: 'trained today', color: 'var(--accent-strong)' },
            { value: avgReadiness, label: 'avg readiness', color: 'var(--blue-ink)' },
            { value: alerts, label: 'alerts', color: alerts > 0 ? 'var(--orange)' : 'var(--ink-3)' },
          ].map((s, i) => (
            <div key={i} style={{ background: 'var(--soft)', borderRadius: 16, padding: '14px 8px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: s.color }}>{s.value}</p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--ink-3)', fontWeight: 600 }}>{s.label}</p>
            </div>
          ))}
        </div>
        </Reveal>

        {/* ── TAB SWITCHER ── */}
        <Reveal delay={60}>
        <div style={{ display: 'flex', background: 'var(--soft)', borderRadius: 14, padding: 4, gap: 4 }}>
          {[{ key: 'clients', label: 'Clients' }, { key: 'plans', label: 'Plan builder' }].map(tab => (
            <button key={tab.key} onClick={() => setView(tab.key)} style={{
              flex: 1, padding: 10, borderRadius: 11, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
              background: view === tab.key ? 'var(--card)' : 'transparent',
              color: view === tab.key ? 'var(--ink)' : 'var(--ink-3)',
            }}>{tab.label}</button>
          ))}
        </div>
        </Reveal>

        {/* ══ CLIENTS ══ */}
        {view === 'clients' && (
          <>
            {alerts > 0 && (
              <div style={{ background: 'var(--orange-tint)', borderRadius: 18, padding: '14px 16px' }}>
                <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--orange-ink)' }}>⚠️ ATTENTION NEEDED</p>
                {clients.filter(c => c.alert).map(c => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar initials={c.initials} size={30} />
                      <span style={{ fontSize: 14, fontWeight: 700 }}>{c.name}</span>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--orange-ink)', fontWeight: 600 }}>{c.alert}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
              {[{ key: 'all', label: 'All' }, { key: 'trained', label: 'Trained' }, { key: 'rest', label: 'Rest' }, { key: 'alerts', label: 'Alerts' }].map(f => (
                <button key={f.key} onClick={() => setFilter(f.key)} style={{
                  flexShrink: 0, padding: '8px 16px', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                  background: filter === f.key ? 'var(--accent-tint)' : 'var(--soft)',
                  color: filter === f.key ? 'var(--accent-strong)' : 'var(--ink-2)',
                }}>{f.label}</button>
              ))}
            </div>

            {filteredClients.map((client, ci) => {
              const rs = readinessStyle(client.readiness);
              const open = selectedClient?.id === client.id;
              return (
                <Reveal key={client.id} delay={120 + ci * 50}>
                <button onClick={() => setSelectedClient(open ? null : client)} style={{ width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ background: 'var(--card)', border: `1px solid ${open ? 'var(--accent)' : 'var(--line)'}`, borderRadius: 18, padding: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <Avatar initials={client.initials} size={44} online={client.trainedToday} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{client.name}</p>
                          {client.alert && <span style={{ fontSize: 13 }}>⚠️</span>}
                        </div>
                        <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--ink-3)' }}>{client.goal}</p>
                      </div>
                      <div style={{ background: rs.bg, borderRadius: 12, padding: '8px 12px', textAlign: 'center', flexShrink: 0 }}>
                        <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: rs.ink, lineHeight: 1 }}>{client.readiness}</p>
                        <p style={{ margin: '2px 0 0', fontSize: 10, color: rs.ink, fontWeight: 600 }}>{rs.label}</p>
                      </div>
                    </div>

                    {open && (
                      <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--line-2)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10 }}>
                          {[
                            { label: 'sessions', value: `${client.sessionsThisWeek}/wk` },
                            { label: 'streak', value: `🔥${client.streak}` },
                            { label: 'weight', value: `${client.weight}kg` },
                          ].map((s, i) => (
                            <div key={i} style={{ background: 'var(--soft)', borderRadius: 12, padding: 10, textAlign: 'center' }}>
                              <p style={{ margin: '0 0 3px', fontSize: 15, fontWeight: 800 }}>{s.value}</p>
                              <p style={{ margin: 0, fontSize: 9, color: 'var(--ink-3)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{s.label}</p>
                            </div>
                          ))}
                        </div>
                        <div style={{ background: 'var(--soft)', borderRadius: 12, padding: 12 }}>
                          <p style={{ margin: '0 0 4px', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Last session</p>
                          <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{client.lastSession}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </button>
                </Reveal>
              );
            })}
          </>
        )}

        {/* ══ PLAN BUILDER ══ */}
        {view === 'plans' && (
          <>
            {activePlan && (
              <div style={{ background: 'var(--accent-tint)', borderRadius: 16, padding: 16 }}>
                <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--accent-strong)' }}>CURRENTLY ACTIVE</p>
                <p style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800 }}>{activePlan.name}</p>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-2)' }}>{activePlan.exercises?.length} exercises · {activePlan.tag} · {activePlan.date}</p>
              </div>
            )}

            <p style={{ ...eyebrow, marginLeft: 4 }}>Create new session</p>

            <Reveal delay={100}>
            <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 20, padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <p style={fieldLabel}>Session name</p>
                <input type="text" placeholder="e.g. Chest & Shoulders" value={planName} onChange={e => setPlanName(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <p style={fieldLabel}>Session type</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {['STRENGTH', 'HYPERTROPHY', 'CARDIO', 'DELOAD', 'FULL BODY'].map(t => (
                    <button key={t} onClick={() => setPlanTag(t)} style={{
                      padding: '8px 14px', borderRadius: 999, cursor: 'pointer', fontSize: 11, fontWeight: 700,
                      border: 'none',
                      background: planTag === t ? 'var(--accent-tint)' : 'var(--soft)',
                      color: planTag === t ? 'var(--accent-strong)' : 'var(--ink-2)',
                    }}>{t}</button>
                  ))}
                </div>
              </div>
              <div>
                <p style={fieldLabel}>Session date</p>
                <input type="date" value={sessionDate} onChange={e => setSessionDate(e.target.value)} style={inputStyle} />
              </div>
            </div>
            </Reveal>

            <Reveal delay={140}>
            <button onClick={generatePlan} disabled={generating} style={{
              width: '100%', background: `linear-gradient(135deg, var(--ai-card-1), var(--ai-card-2))`,
              color: '#fff', border: 'none', borderRadius: 16, padding: 15, fontSize: 14, fontWeight: 700,
              cursor: generating ? 'wait' : 'pointer', opacity: generating ? 0.7 : 1,
            }}>
              {generating ? 'Generating…' : `✨ Generate ${planTag.toLowerCase()} plan with AI`}
            </button>
            </Reveal>

            <p style={{ ...eyebrow, marginLeft: 4 }}>Exercises</p>

            {exercises.map((ex, idx) => (
              <div key={idx} style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 20, padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--accent-strong)', fontWeight: 800, letterSpacing: '0.06em' }}>EXERCISE {idx + 1}</p>
                  {exercises.length > 1 && (
                    <button onClick={() => removeExercise(idx)} style={{ background: 'none', border: 'none', color: 'var(--red-ink)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Remove</button>
                  )}
                </div>

                <div>
                  <p style={fieldLabel}>Muscle group</p>
                  <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                    {muscleGroups.map(mg => (
                      <button key={mg} onClick={() => updateMuscleGroup(idx, mg)} style={{
                        flexShrink: 0, padding: '7px 14px', borderRadius: 999, cursor: 'pointer', fontSize: 11, fontWeight: 700, border: 'none',
                        background: ex.muscleGroup === mg ? 'var(--accent-tint)' : 'var(--soft)',
                        color: ex.muscleGroup === mg ? 'var(--accent-strong)' : 'var(--ink-2)',
                      }}>{mg}</button>
                    ))}
                  </div>
                </div>

                <div>
                  <p style={fieldLabel}>Exercise</p>
                  <select value={ex.name} onChange={e => updateExerciseName(idx, e.target.value)} style={{ ...inputStyle, background: 'var(--soft)' }}>
                    <option value="">— Select exercise —</option>
                    {exerciseLibrary[ex.muscleGroup]?.map(e => (<option key={e.name} value={e.name}>{e.name}</option>))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[{ label: 'Sets', field: 'sets', type: 'number', value: ex.sets }, { label: 'Reps', field: 'reps', type: 'text', value: ex.reps }].map(input => (
                    <div key={input.field}>
                      <p style={fieldLabel}>{input.label}</p>
                      <input type={input.type} value={input.value}
                        onChange={e => updateExercise(idx, input.field, input.type === 'number' ? parseInt(e.target.value) : e.target.value)}
                        style={{ ...inputStyle, fontSize: 16, fontWeight: 800, textAlign: 'center' }} />
                    </div>
                  ))}
                </div>

                {ex.cue && (
                  <div style={{ background: 'var(--accent-tint)', borderRadius: 12, padding: 12 }}>
                    <p style={{ margin: '0 0 6px', fontSize: 10, color: 'var(--accent-strong)', fontWeight: 700, letterSpacing: '0.06em' }}>FORM CUE</p>
                    <textarea value={ex.cue} onChange={e => updateExercise(idx, 'cue', e.target.value)} rows={3}
                      style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--ink-2)', fontSize: 13, lineHeight: 1.5, outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
                  </div>
                )}
              </div>
            ))}

            <button onClick={addExercise} style={{ width: '100%', background: 'var(--soft)', border: 'none', borderRadius: 16, padding: 15, color: 'var(--accent-strong)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>+ Add exercise</button>

            {saveMsg && (
              <div style={{ borderRadius: 14, padding: '12px 16px', textAlign: 'center', fontSize: 13, fontWeight: 700,
                background: saveMsg.type === 'success' ? 'var(--accent-tint)' : 'var(--red-tint)',
                color: saveMsg.type === 'success' ? 'var(--accent-strong)' : 'var(--red-ink)',
              }}>{saveMsg.text}</div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => handlePublish(false)} disabled={saving} style={{ flex: 1, padding: 15, background: 'var(--soft)', border: 'none', borderRadius: 14, color: 'var(--ink-2)', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.5 : 1 }}>Save draft</button>
              <button onClick={() => handlePublish(true)} disabled={saving} style={{ flex: 1.4, padding: 15, background: 'var(--accent)', border: 'none', borderRadius: 14, color: 'var(--on-accent)', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.5 : 1 }}>Publish & activate</button>
            </div>
          </>
        )}

      </div>

      <BottomNav />
    </div>
  );
}

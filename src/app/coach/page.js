'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMsal } from '@azure/msal-react';
import Image from 'next/image';
import { exerciseLibrary, muscleGroups } from '@/lib/exercises';
import BottomNav from '@/components/BottomNav';

const PLANS_API_URL = 'https://gymdogs-api-g9d0gve4angygdcj.newzealandnorth-01.azurewebsites.net/api/workoutPlans';
const PLANS_API_KEY = process.env.NEXT_PUBLIC_PLANS_API_KEY;

const clients = [
  { id: 1, name: 'JOEL',   initials: 'JM', color: '#7c3aed', goal: 'Build Muscle',        readiness: 91, streak: 7, trainedToday: true,  alert: null,                  lastSession: 'Chest & Shoulders', sessionsThisWeek: 5, weight: 84 },
  { id: 2, name: 'HAMISH', initials: 'HT', color: '#6d28d9', goal: 'Lose Body Fat',        readiness: 74, streak: 3, trainedToday: true,  alert: null,                  lastSession: 'Lower Body',        sessionsThisWeek: 3, weight: 91 },
  { id: 3, name: 'ZAFI',   initials: 'ZK', color: '#5b21b6', goal: 'Get Stronger',         readiness: 58, streak: 1, trainedToday: false, alert: 'Missed 2 sessions',   lastSession: 'Pull Day',          sessionsThisWeek: 2, weight: 78 },
  { id: 4, name: 'PRIYA',  initials: 'PK', color: '#4c1d95', goal: 'General Health',       readiness: 45, streak: 0, trainedToday: false, alert: 'Deload recommended',  lastSession: 'Full Body',         sessionsThisWeek: 1, weight: 62 },
  { id: 5, name: 'MARCUS', initials: 'MR', color: '#3b0764', goal: 'Athletic Performance', readiness: 83, streak: 5, trainedToday: true,  alert: null,                  lastSession: 'Push Day',          sessionsThisWeek: 4, weight: 88 },
];

function readinessColor(score) {
  if (score >= 80) return '#34d399';
  if (score >= 60) return '#60a5fa';
  if (score >= 40) return '#f97316';
  return '#f87171';
}

function readinessBg(score) {
  if (score >= 80) return 'rgba(52,211,153,0.12)';
  if (score >= 60) return 'rgba(96,165,250,0.12)';
  if (score >= 40) return 'rgba(249,115,22,0.12)';
  return 'rgba(248,113,113,0.12)';
}

function readinessLabel(score) {
  if (score >= 80) return 'Ready';
  if (score >= 60) return 'Moderate';
  if (score >= 40) return 'Fatigued';
  return 'Rest Day';
}

const emptyExercise = () => ({ muscleGroup: 'CHEST', name: '', sets: 3, reps: '10-12', cue: '' });

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

  const handlePublish = async (isActive) => {
    if (!planName.trim()) { setSaveMsg({ type: 'error', text: 'Please enter a session name' }); return; }
    if (exercises.some(e => !e.name.trim())) { setSaveMsg({ type: 'error', text: 'Please select all exercise names' }); return; }
    setSaving(true); setSaveMsg(null);
    try {
      const plan = { id: Date.now().toString(), name: planName, tag: planTag, date: sessionDate, exercises, isActive, createdAt: new Date().toISOString() };
      const res = await fetch(PLANS_API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-functions-key': PLANS_API_KEY }, body: JSON.stringify(plan) });
      if (res.ok) {
        setSaveMsg({ type: 'success', text: isActive ? '✅ Session published and set as active!' : '✅ Session saved as draft!' });
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
    <div style={{ minHeight: '100vh', background: '#09090F', color: '#ffffff', fontFamily: 'system-ui, sans-serif', paddingBottom: '100px' }}>

      {/* ── HEADER ── */}
      <div style={{
        padding: '52px 20px 20px',
        background: 'linear-gradient(180deg, rgba(124,58,237,0.12) 0%, transparent 100%)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      }}>
        <div>
          <p style={{ fontSize: '11px', color: '#6b7280', letterSpacing: '2px', margin: '0 0 4px' }}>COACH VIEW</p>
          <h1 style={{ fontSize: '32px', fontWeight: 900, margin: 0 }}>
            COACH <span style={{ color: '#7c3aed' }}>HQ</span>
          </h1>
        </div>
        <div style={{
          width: '48px', height: '48px', borderRadius: '50%',
          background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '15px', fontWeight: 800,
        }}>SC</div>
      </div>

      {/* ── 3 STAT CARDS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', padding: '0 20px 16px' }}>
        {[
          { value: `${trainedToday}/${clients.length}`, label: 'TRAINED TODAY', color: '#34d399' },
          { value: avgReadiness,                         label: 'AVG READINESS', color: '#60a5fa' },
          { value: alerts,                               label: 'ALERTS',        color: alerts > 0 ? '#f97316' : '#6b7280' },
        ].map((stat, i) => (
          <div key={i} style={{
            background: '#13131A', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '16px', padding: '14px 10px', textAlign: 'center',
          }}>
            <p style={{ fontSize: '26px', fontWeight: 900, color: stat.color, margin: '0 0 4px', lineHeight: 1 }}>{stat.value}</p>
            <p style={{ fontSize: '9px', color: '#6b7280', margin: 0, letterSpacing: '1px' }}>{stat.label}</p>
          </div>
        ))}
      </div>

      {/* ── TAB SWITCHER ── */}
      <div style={{ padding: '0 20px 16px', display: 'flex', gap: '8px' }}>
        {[
          { key: 'clients', label: '👥 CLIENTS' },
          { key: 'plans',   label: '💪 PLAN BUILDER' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setView(tab.key)}
            style={{
              flex: 1, padding: '12px',
              borderRadius: '14px', border: 'none',
              background: view === tab.key
                ? 'linear-gradient(135deg, #7c3aed, #6d28d9)'
                : 'rgba(255,255,255,0.05)',
              color: view === tab.key ? '#ffffff' : '#6b7280',
              fontSize: '12px', fontWeight: 800, letterSpacing: '1px',
              cursor: 'pointer',
            }}
          >{tab.label}</button>
        ))}
      </div>

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

        {/* ══ CLIENTS VIEW ══ */}
        {view === 'clients' && (
          <>
            {/* Attention needed */}
            {alerts > 0 && (
              <div style={{
                background: 'rgba(249,115,22,0.08)',
                border: '1px solid rgba(249,115,22,0.25)',
                borderRadius: '16px', padding: '14px 16px',
              }}>
                <p style={{ fontSize: '11px', color: '#f97316', letterSpacing: '1.5px', margin: '0 0 12px', fontWeight: 700 }}>⚠️ ATTENTION NEEDED</p>
                {clients.filter(c => c.alert).map(c => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '32px', height: '32px', borderRadius: '50%',
                        background: c.color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '12px', fontWeight: 800,
                      }}>{c.initials}</div>
                      <span style={{ fontSize: '14px', fontWeight: 700 }}>{c.name}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '12px', color: '#f97316', fontWeight: 600 }}>{c.alert}</span>
                      <span style={{ color: '#6b7280' }}>›</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Filter pills */}
            <p style={{ fontSize: '11px', color: '#6b7280', letterSpacing: '2px', margin: '4px 0 0', fontWeight: 700 }}>ALL CLIENTS</p>
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
              {[
                { key: 'all',     label: 'ALL' },
                { key: 'trained', label: '✅ TRAINED' },
                { key: 'rest',    label: '😴 REST' },
                { key: 'alerts',  label: '⚠️ ALERT' },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  style={{
                    flexShrink: 0, padding: '8px 16px',
                    borderRadius: '99px', border: 'none',
                    background: filter === f.key
                      ? 'linear-gradient(135deg, #7c3aed, #6d28d9)'
                      : 'rgba(255,255,255,0.06)',
                    color: filter === f.key ? '#ffffff' : '#6b7280',
                    fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px',
                    cursor: 'pointer',
                  }}
                >{f.label}</button>
              ))}
            </div>

            {/* Client cards */}
            {filteredClients.map(client => (
              <button
                key={client.id}
                onClick={() => setSelectedClient(selectedClient?.id === client.id ? null : client)}
                style={{ width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
              >
                <div style={{
                  background: selectedClient?.id === client.id ? 'rgba(124,58,237,0.08)' : '#13131A',
                  border: `1px solid ${selectedClient?.id === client.id ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.07)'}`,
                  borderRadius: '18px', padding: '16px',
                  transition: 'all 0.15s ease',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {/* Avatar with online dot */}
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <div style={{
                        width: '44px', height: '44px', borderRadius: '50%',
                        background: client.color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '14px', fontWeight: 800,
                      }}>{client.initials}</div>
                      <div style={{
                        position: 'absolute', bottom: 0, right: 0,
                        width: '12px', height: '12px', borderRadius: '50%',
                        background: client.trainedToday ? '#34d399' : '#f97316',
                        border: '2px solid #09090F',
                      }} />
                    </div>

                    {/* Name + goal */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <p style={{ fontSize: '15px', fontWeight: 800, margin: 0, letterSpacing: '0.5px' }}>{client.name}</p>
                        {client.alert && <span style={{ fontSize: '13px' }}>⚠️</span>}
                      </div>
                      <p style={{ fontSize: '12px', color: '#6b7280', margin: '2px 0 0' }}>{client.goal}</p>
                    </div>

                    {/* Readiness score */}
                    <div style={{
                      background: readinessBg(client.readiness),
                      border: `1px solid ${readinessColor(client.readiness)}40`,
                      borderRadius: '12px', padding: '8px 12px', textAlign: 'center', flexShrink: 0,
                    }}>
                      <p style={{ fontSize: '20px', fontWeight: 900, color: readinessColor(client.readiness), margin: 0, lineHeight: 1 }}>{client.readiness}</p>
                      <p style={{ fontSize: '10px', color: readinessColor(client.readiness), margin: '2px 0 0', fontWeight: 600 }}>{readinessLabel(client.readiness)}</p>
                    </div>
                    <span style={{ fontSize: '18px', color: '#4b5563' }}>›</span>
                  </div>

                  {/* Expanded detail */}
                  {selectedClient?.id === client.id && (
                    <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                        {[
                          { label: 'SESSIONS', value: `${client.sessionsThisWeek}/wk` },
                          { label: 'STREAK',   value: `🔥${client.streak}` },
                          { label: 'WEIGHT',   value: `${client.weight}kg` },
                        ].map((s, i) => (
                          <div key={i} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '12px', padding: '10px', textAlign: 'center' }}>
                            <p style={{ fontSize: '15px', fontWeight: 900, margin: '0 0 3px' }}>{s.value}</p>
                            <p style={{ fontSize: '9px', color: '#6b7280', margin: 0, letterSpacing: '0.5px' }}>{s.label}</p>
                          </div>
                        ))}
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '12px', padding: '12px' }}>
                        <p style={{ fontSize: '10px', color: '#6b7280', letterSpacing: '1px', margin: '0 0 4px' }}>LAST SESSION</p>
                        <p style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>{client.lastSession}</p>
                      </div>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </>
        )}

        {/* ══ PLAN BUILDER VIEW ══ */}
        {view === 'plans' && (
          <>
            {/* Currently active plan */}
            {activePlan && (
              <div style={{
                background: 'rgba(52,211,153,0.08)',
                border: '1px solid rgba(52,211,153,0.25)',
                borderRadius: '16px', padding: '16px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <p style={{ fontSize: '11px', color: '#34d399', letterSpacing: '1.5px', margin: '0 0 6px', fontWeight: 700 }}>CURRENTLY ACTIVE</p>
                  <p style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 4px' }}>{activePlan.name}</p>
                  <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>{activePlan.exercises?.length} exercises · {activePlan.tag} · {activePlan.date}</p>
                </div>
                <span style={{ fontSize: '20px', color: '#4b5563' }}>›</span>
              </div>
            )}

            {/* Create new session */}
            <p style={{ fontSize: '11px', color: '#6b7280', letterSpacing: '2px', margin: '4px 0 0', fontWeight: 700 }}>CREATE NEW SESSION</p>

            <div style={{ background: '#13131A', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '20px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Session name */}
              <div>
                <p style={{ fontSize: '11px', color: '#6b7280', letterSpacing: '1.5px', margin: '0 0 8px', fontWeight: 700 }}>SESSION NAME</p>
                <input
                  type="text"
                  placeholder="e.g. Chest & Shoulders"
                  value={planName}
                  onChange={e => setPlanName(e.target.value)}
                  style={{
                    width: '100%', background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px',
                    padding: '12px 16px', color: '#ffffff', fontSize: '14px',
                    fontWeight: 600, outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Session type */}
              <div>
                <p style={{ fontSize: '11px', color: '#6b7280', letterSpacing: '1.5px', margin: '0 0 8px', fontWeight: 700 }}>SESSION TYPE</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {['STRENGTH', 'HYPERTROPHY', 'CARDIO', 'DELOAD', 'FULL BODY'].map(t => (
                    <button
                      key={t}
                      onClick={() => setPlanTag(t)}
                      style={{
                        padding: '8px 14px', borderRadius: '99px',
                        border: planTag === t ? '1.5px solid #7c3aed' : '1px solid rgba(255,255,255,0.1)',
                        background: planTag === t ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.04)',
                        color: planTag === t ? '#a78bfa' : '#6b7280',
                        fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px', cursor: 'pointer',
                      }}
                    >{t}</button>
                  ))}
                </div>
              </div>

              {/* Session date */}
              <div>
                <p style={{ fontSize: '11px', color: '#6b7280', letterSpacing: '1.5px', margin: '0 0 8px', fontWeight: 700 }}>SESSION DATE</p>
                <input
                  type="date"
                  value={sessionDate}
                  onChange={e => setSessionDate(e.target.value)}
                  style={{
                    width: '100%', background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px',
                    padding: '12px 16px', color: '#ffffff', fontSize: '14px',
                    fontWeight: 600, outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* Exercises */}
            <p style={{ fontSize: '11px', color: '#6b7280', letterSpacing: '2px', margin: '4px 0 0', fontWeight: 700 }}>EXERCISES</p>

            {exercises.map((ex, idx) => (
              <div key={idx} style={{ background: '#13131A', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '20px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ fontSize: '12px', color: '#7c3aed', fontWeight: 800, letterSpacing: '1px', margin: 0 }}>EXERCISE {idx + 1}</p>
                  {exercises.length > 1 && (
                    <button onClick={() => removeExercise(idx)} style={{ background: 'none', border: 'none', color: '#f87171', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>REMOVE</button>
                  )}
                </div>

                {/* Muscle group */}
                <div>
                  <p style={{ fontSize: '11px', color: '#6b7280', letterSpacing: '1px', margin: '0 0 8px', fontWeight: 700 }}>MUSCLE GROUP</p>
                  <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                    {muscleGroups.map(mg => (
                      <button
                        key={mg}
                        onClick={() => updateMuscleGroup(idx, mg)}
                        style={{
                          flexShrink: 0, padding: '7px 14px', borderRadius: '99px',
                          border: ex.muscleGroup === mg ? '1.5px solid #7c3aed' : '1px solid rgba(255,255,255,0.1)',
                          background: ex.muscleGroup === mg ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.04)',
                          color: ex.muscleGroup === mg ? '#a78bfa' : '#6b7280',
                          fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                        }}
                      >{mg}</button>
                    ))}
                  </div>
                </div>

                {/* Exercise select */}
                <div>
                  <p style={{ fontSize: '11px', color: '#6b7280', letterSpacing: '1px', margin: '0 0 8px', fontWeight: 700 }}>EXERCISE</p>
                  <select
                    value={ex.name}
                    onChange={e => updateExerciseName(idx, e.target.value)}
                    style={{
                      width: '100%', background: '#09090F',
                      border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px',
                      padding: '12px 16px', color: '#ffffff', fontSize: '14px', outline: 'none',
                    }}
                  >
                    <option value="">— Select exercise —</option>
                    {exerciseLibrary[ex.muscleGroup]?.map(e => (
                      <option key={e.name} value={e.name}>{e.name}</option>
                    ))}
                  </select>
                </div>

                {/* Sets + Reps */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  {[
                    { label: 'SETS', field: 'sets', type: 'number', value: ex.sets },
                    { label: 'REPS', field: 'reps', type: 'text',   value: ex.reps },
                  ].map(input => (
                    <div key={input.field}>
                      <p style={{ fontSize: '11px', color: '#6b7280', letterSpacing: '1px', margin: '0 0 6px', fontWeight: 700 }}>{input.label}</p>
                      <input
                        type={input.type}
                        value={input.value}
                        onChange={e => updateExercise(idx, input.field, input.type === 'number' ? parseInt(e.target.value) : e.target.value)}
                        style={{
                          width: '100%', background: 'rgba(255,255,255,0.06)',
                          border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px',
                          padding: '12px', color: '#ffffff', fontSize: '16px',
                          fontWeight: 800, textAlign: 'center', outline: 'none', boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  ))}
                </div>

                {/* Form cue */}
                {ex.cue && (
                  <div style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: '12px', padding: '12px' }}>
                    <p style={{ fontSize: '10px', color: '#a78bfa', fontWeight: 700, letterSpacing: '1px', margin: '0 0 6px' }}>FORM CUE</p>
                    <textarea
                      value={ex.cue}
                      onChange={e => updateExercise(idx, 'cue', e.target.value)}
                      rows={3}
                      style={{ width: '100%', background: 'transparent', border: 'none', color: '#9ca3af', fontSize: '13px', lineHeight: 1.5, outline: 'none', resize: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                )}
              </div>
            ))}

            {/* Add exercise */}
            <button
              onClick={addExercise}
              style={{
                width: '100%', background: 'rgba(255,255,255,0.03)',
                border: '1.5px dashed rgba(124,58,237,0.3)', borderRadius: '16px',
                padding: '16px', color: '#7c3aed', fontSize: '14px',
                fontWeight: 700, letterSpacing: '1px', cursor: 'pointer',
              }}
            >+ ADD EXERCISE</button>

            {/* Save message */}
            {saveMsg && (
              <div style={{
                borderRadius: '14px', padding: '12px 16px', textAlign: 'center',
                fontSize: '13px', fontWeight: 700,
                background: saveMsg.type === 'success' ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)',
                border: `1px solid ${saveMsg.type === 'success' ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}`,
                color: saveMsg.type === 'success' ? '#34d399' : '#f87171',
              }}>{saveMsg.text}</div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => handlePublish(false)}
                disabled={saving}
                style={{
                  flex: 1, padding: '16px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '14px', color: '#9ca3af',
                  fontSize: '13px', fontWeight: 700, letterSpacing: '1px',
                  cursor: 'pointer', opacity: saving ? 0.5 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                }}
              >💾 SAVE DRAFT</button>
              <button
                onClick={() => handlePublish(true)}
                disabled={saving}
                style={{
                  flex: 1, padding: '16px',
                  background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                  border: 'none', borderRadius: '14px', color: '#ffffff',
                  fontSize: '13px', fontWeight: 800, letterSpacing: '1px',
                  cursor: 'pointer', opacity: saving ? 0.5 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  boxShadow: '0 4px 20px rgba(124,58,237,0.4)',
                }}
              >🚀 PUBLISH & ACTIVATE</button>
            </div>
          </>
        )}

      </div>

      <BottomNav />
    </div>
  );
}
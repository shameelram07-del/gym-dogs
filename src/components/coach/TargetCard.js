'use client';
import { muscleGroups } from '@/lib/exercises';
import { DAY_PRESETS, presetFor } from '@/lib/session';
import { cardStyle, fieldLabel, hint, chip, numberInput, R, T } from '@/lib/ui';
import { useNumberDraft } from './useNumberDraft';
import { STYLES } from './useSessionBuilder';

const title = (s) => s.charAt(0) + s.slice(1).toLowerCase();

/** `Pull · Hypertrophy · 60 min · 2 people` — the whole brief, in one line. */
export function briefSummary({ targetGroups, planTag, minutes, people }) {
  const preset = presetFor(targetGroups);
  const what = preset ? preset.label : targetGroups.map(title).join(', ');
  return [
    what || 'No target',
    title(planTag),
    `${minutes} min`,
    `${people} ${people === 1 ? 'person' : 'people'}`,
  ].join(' · ');
}

/**
 * The brief — everything the generator consumes, and nothing else.
 *
 * Style lives here, not with the publishing fields. It looks like a label but
 * `STYLE_BRIEF[planTag]` goes straight into the prompt, so it is an input
 * wearing a label's clothes; its being filed with Name and Date is most of why
 * the old screen read as scrambled.
 *
 * Once a session exists this collapses to one line, because the screen should
 * never show a full brief and a full session at the same time.
 */
export default function TargetCard({ b }) {
  const { bind } = useNumberDraft();
  const activePreset = presetFor(b.targetGroups);

  if (!b.briefOpen) {
    return (
      <button
        type="button"
        onClick={() => b.setBriefOpen(true)}
        style={{
          ...cardStyle, padding: '13px 16px', width: '100%', textAlign: 'left',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          cursor: 'pointer', color: 'var(--ink)',
        }}
      >
        <span style={{ minWidth: 0 }}>
          <span style={{ ...fieldLabel, display: 'block', margin: 0 }}>The brief</span>
          <span style={{
            display: 'block', marginTop: 3, fontSize: 13.5, fontWeight: 600,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{briefSummary(b)}</span>
        </span>
        <span style={{ flexShrink: 0, color: 'var(--ink-3)', fontSize: 15 }}>&rsaquo;</span>
      </button>
    );
  }

  return (
    <div style={{ ...cardStyle, padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <p style={fieldLabel}>Target</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          {DAY_PRESETS.map((pre) => (
            <button key={pre.id} onClick={() => b.setTargetGroups(pre.groups)} style={chip(activePreset?.id === pre.id)}>
              {pre.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {muscleGroups.map((mg) => (
            <button key={mg} onClick={() => b.toggleGroup(mg)} style={chip(b.targetGroups.includes(mg))}>{mg}</button>
          ))}
        </div>
        <p style={hint}>
          {b.targetGroups.length
            ? `Building from ${b.targetGroups.join(', ')}.`
            : 'Pick a day, or tap the groups you’re training. A day preset just fills the row below it.'}
        </p>
      </div>

      <div>
        <p style={fieldLabel}>Style</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {STYLES.map((t) => (
            <button key={t} onClick={() => b.setPlanTag(t)} style={chip(b.planTag === t)}>{t}</button>
          ))}
        </div>
      </div>

      {/* "Time & people", not "Session" — the tab is called Session, so the
          word can't also label a field group inside it. */}
      <div>
        <p style={fieldLabel}>Time &amp; people</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          {[
            { label: 'Minutes', value: b.minutes, min: 10, step: 5, onChange: b.setMinutes },
            { label: 'People', value: b.people, min: 1, step: 1, onChange: b.setPeople },
            // Clearing this one hands the count back to the minutes.
            { label: 'Exercises', value: b.exCount, min: 4, max: 8, step: 1, onChange: b.setCountOverride, onEmpty: () => b.setCountOverride(null) },
          ].map((f) => (
            <div key={f.label}>
              <p style={fieldLabel}>{f.label}</p>
              <input {...bind(f)} style={numberInput} />
            </div>
          ))}
        </div>
        <p style={hint}>
          {b.countOverride === null
            ? `${b.minutes} minutes works out at about ${b.exCount} exercises — change the count to override it.`
            : `${b.exCount} exercises, set by hand.`}
          {b.people >= 2 && ' Two or more people means paired blocks, so nobody waits on a machine.'}
        </p>
      </div>

      <div>
        <button
          onClick={b.generatePlan}
          disabled={b.generating || !b.canGenerate}
          className={b.generating ? 'gd-shimbar' : undefined}
          style={{
            width: '100%', background: 'linear-gradient(135deg, var(--ai-card-1), var(--ai-card-2))',
            color: 'var(--on-dark)', border: 'none', borderRadius: R.panel, padding: 15,
            fontSize: T.md, fontWeight: 700,
            cursor: !b.canGenerate ? 'not-allowed' : b.generating ? 'wait' : 'pointer',
            opacity: b.generating || !b.canGenerate ? 0.55 : 1,
          }}
        >
          {b.generating
            ? 'Generating…'
            : !b.canGenerate
              ? 'Pick a muscle group to generate'
              : '✨ Generate with Gym Daddy'}
        </button>
        {/* Hand-building still exists. The generator is the fast path, not the
            only one — and without this, clearing the session left no way back in. */}
        <button
          onClick={b.startByHand}
          style={{
            display: 'block', margin: '10px auto 0', background: 'none', border: 'none',
            color: 'var(--ink-3)', fontSize: 12.5, fontWeight: 600,
            textDecoration: 'underline', cursor: 'pointer',
          }}
        >
          or build it by hand
        </button>
      </div>
    </div>
  );
}

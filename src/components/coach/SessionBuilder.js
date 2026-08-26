'use client';
import Reveal from '@/components/Reveal';
import { cardStyle, eyebrow, R, T } from '@/lib/ui';
import LiveNow from './LiveNow';
import TargetCard from './TargetCard';
import ExerciseRow from './ExerciseRow';
import SwapSheet from './SwapSheet';
import PublishCard from './PublishCard';
import DraftList from './DraftList';

/**
 * Brief it, read it, publish it — in that order.
 *
 * The ordering matters, but progressive disclosure is what actually makes the
 * screen short. The most common state here is "nothing generated yet", and in
 * that state the session and publish sections do not render AT ALL — not as
 * empty cards waiting to be filled. Reordering alone would have moved the
 * furniture without shortening anything.
 *
 * No step numbers, no locking, no completion ticks: sections appear when they
 * have something in them. This is not a wizard, and dressing it as one would
 * promise a sequence it does not enforce.
 *
 * All state lives in useSessionBuilder(), called by page.js — see the note
 * there about why it must not live in this component.
 */
export default function SessionBuilder({ b, clients }) {
  return (
    <>
      <LiveNow plan={b.activePlan} clients={clients} />

      <Reveal delay={60}><TargetCard b={b} /></Reveal>

      {b.hasSession && (
        <Reveal delay={80}>
          <div id="gd-session" style={{ ...cardStyle, padding: '4px 14px 14px', scrollMarginTop: 12 }}>
            {/* Gym Daddy's run note sits INSIDE the session it describes. It
                used to float between the generate button and the exercise list,
                while the safety notes it gets joined to at publish were ~600px
                further down — the two halves of what the pack reads were nowhere
                near each other. */}
            {b.runNote && (
              <div style={{
                background: 'linear-gradient(135deg, var(--ai-card-1), var(--ai-card-2))',
                borderRadius: R.panel, padding: '13px 14px', margin: '10px 0 4px',
              }}>
                <p style={{ ...eyebrow, color: 'var(--ice)' }}>Gym Daddy</p>
                <p style={{ margin: '5px 0 0', fontSize: T.sm, lineHeight: 1.5, color: 'var(--on-dark)' }}>
                  {b.runNote}
                </p>
              </div>
            )}

            {b.exercises.map((ex, i) => (
              <ExerciseRow
                key={i}
                ex={ex}
                index={i}
                open={b.openRow === i}
                onToggle={() => b.setOpenRow(b.openRow === i ? null : i)}
                onSwap={() => b.setSwapFor(i)}
                onChange={(field, value) => b.updateExercise(i, field, value)}
                onRemove={() => b.removeExercise(i)}
                canRemove={b.exercises.length > 1}
              />
            ))}

            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={b.regenerate} disabled={b.generating || !b.canGenerate} style={{
                flex: 1, padding: 11, borderRadius: R.inner, border: '1px solid var(--line)',
                background: 'var(--soft)', color: 'var(--ink-2)', fontSize: 12.5, fontWeight: 700,
                cursor: b.generating ? 'wait' : 'pointer', opacity: b.generating || !b.canGenerate ? 0.5 : 1,
              }}>{b.generating ? 'Generating…' : '↻ Regenerate'}</button>
              <button onClick={b.addExercise} style={{
                flex: 1, padding: 11, borderRadius: R.inner, border: '1px solid var(--line)',
                background: 'var(--soft)', color: 'var(--ink-2)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
              }}>+ Add exercise</button>
            </div>
          </div>
        </Reveal>
      )}

      {b.hasSession && <Reveal delay={100}><PublishCard b={b} clients={clients} /></Reveal>}

      {/* Before there is a session the message has nowhere else to live — the
          publish card that normally shows it isn't rendered yet. */}
      {!b.hasSession && b.saveMsg && (
        <div style={{
          borderRadius: R.control, padding: '12px 16px', textAlign: 'center', fontSize: 13, fontWeight: 700,
          background: b.saveMsg.type === 'error' ? 'var(--red-tint)' : 'var(--accent-tint)',
          color: b.saveMsg.type === 'error' ? 'var(--red-ink)' : 'var(--accent-strong)',
        }}>{b.saveMsg.text}</div>
      )}

      <DraftList drafts={b.drafts} draftId={b.draftId} onEdit={b.editDraft} onDelete={b.deleteDraft} />

      {b.swapFor !== null && (
        <SwapSheet
          exercises={b.exercises}
          index={b.swapFor}
          onPick={(lib) => b.swapExercise(b.swapFor, lib)}
          onClose={() => b.setSwapFor(null)}
        />
      )}
    </>
  );
}

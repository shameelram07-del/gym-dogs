'use client';
import { fieldLabel, inputStyle, R, T } from '@/lib/ui';

/**
 * One exercise, as one line.
 *
 * This is the change the whole rebuild exists for. Every exercise used to
 * render a full editor — two horizontally-scrolling chip rows, a select,
 * sets/reps and a cue box — so six exercises came to roughly 2,500px of form
 * and reading the session meant thumbing through twelve scrollers to see six
 * names. Now the session is six lines you can take in at once, and the editor
 * is one tap away on the row you actually want to change.
 *
 * Deliberately NOT here, and not an oversight:
 *   * muscle group — `{ ...emptyExercise(), muscleGroup }` wiped the name, sets,
 *     reps and cue the instant you touched it. On a generated session that
 *     control could only cause damage.
 *   * equipment filter — it narrowed a dropdown this exercise has already been
 *     chosen from.
 * Swap replaces both, and knows about blocks, which neither of them did.
 */
export default function ExerciseRow({
  ex, index, open, onToggle, onSwap, onChange, onRemove, canRemove,
}) {
  return (
    <div style={{ borderTop: index === 0 ? 'none' : '1px solid var(--line-2)' }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 2px', background: 'none', border: 'none',
          cursor: 'pointer', textAlign: 'left', color: 'var(--ink)',
        }}
      >
        <span className="gd-disp" style={{ width: 13, flexShrink: 0, fontSize: T.xs, fontWeight: 700, color: 'var(--ink-3)' }}>
          {index + 1}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{
            display: 'block', fontSize: 13.5, fontWeight: 600,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            color: ex.name ? 'var(--ink)' : 'var(--ink-3)',
          }}>
            {ex.name || 'Choose an exercise'}
          </span>
          <span className="gd-num" style={{ display: 'block', marginTop: 1, fontSize: T.xs, color: 'var(--ink-3)' }}>
            {ex.sets} &times; {ex.reps}
          </span>
        </span>
        {/* Blue, not gold. Gold means "challenge" everywhere else in the app. */}
        {ex.block && (
          <span style={{
            flexShrink: 0, fontSize: 9.5, fontWeight: 800, letterSpacing: '0.07em',
            padding: '3px 8px', borderRadius: 6,
            background: 'var(--blue-tint)', color: 'var(--blue-ink)',
          }}>{ex.block}</span>
        )}
        <span style={{
          flexShrink: 0, color: 'var(--ink-3)', fontSize: 15,
          transform: open ? 'rotate(90deg)' : 'none',
          transition: 'transform 0.2s cubic-bezier(0.22, 1, 0.36, 1)',
        }}>&rsaquo;</span>
      </button>

      {/* Height-animated the same way the client cards expand, so the two
          expanding things on this screen behave identically. */}
      <div style={{
        display: 'grid',
        gridTemplateRows: open ? '1fr' : '0fr',
        transition: 'grid-template-rows 0.32s cubic-bezier(0.22, 1, 0.36, 1)',
      }}>
        <div style={{ overflow: 'hidden' }}>
          <div style={{
            background: 'var(--soft)', borderRadius: R.control,
            padding: 12, margin: '0 0 10px',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <button type="button" onClick={onSwap} style={{
              width: '100%', padding: '11px 14px', borderRadius: R.inner,
              background: 'var(--accent-tint)', border: '1px solid var(--accent)',
              color: 'var(--accent-strong)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}>
              &#8646; Swap this exercise
            </button>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <p style={fieldLabel}>Sets</p>
                <input
                  type="number" value={ex.sets} min={1} max={10}
                  onChange={(e) => onChange('sets', parseInt(e.target.value, 10) || 1)}
                  style={{ ...inputStyle, background: 'var(--card)', fontSize: T.lg, fontWeight: 800, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}
                />
              </div>
              <div>
                <p style={fieldLabel}>Reps</p>
                <input
                  type="text" value={ex.reps}
                  onChange={(e) => onChange('reps', e.target.value)}
                  style={{ ...inputStyle, background: 'var(--card)', fontSize: T.lg, fontWeight: 800, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}
                />
              </div>
            </div>

            {ex.cue && (
              <div>
                <p style={fieldLabel}>Form cue</p>
                <textarea
                  value={ex.cue} rows={3}
                  onChange={(e) => onChange('cue', e.target.value)}
                  style={{ ...inputStyle, background: 'var(--card)', fontWeight: 500, fontSize: 13, lineHeight: 1.5, resize: 'vertical' }}
                />
              </div>
            )}

            {canRemove && (
              <button type="button" onClick={onRemove} style={{
                background: 'none', border: 'none', padding: '2px 0 0',
                color: 'var(--red-ink)', fontSize: 12, fontWeight: 700, cursor: 'pointer', alignSelf: 'flex-start',
              }}>Remove from session</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

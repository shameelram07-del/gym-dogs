'use client';
import { todayISO } from '@/lib/day';
import { cardStyle, fieldLabel, hint, chip, inputStyle, R } from '@/lib/ui';

/**
 * Publish — only the things that are true of a finished session.
 *
 * Everything here used to sit ABOVE the generator, so you named and assigned a
 * session before deciding what it was. That was not only backwards, it was a
 * live data bug: `suggestName` is guarded by `if (!planName.trim())`, and with
 * the name field first on screen it was never empty, so the auto-name never
 * fired. You could type "Chest & Shoulders", switch Target to Legs, and publish
 * leg day under the wrong name.
 *
 * The name has since left this card entirely — it is the session's title and it
 * now sits at the top of the session, in SessionBuilder. There is exactly one
 * name field on the screen; do not add a second one here. `handlePublish` still
 * refuses a blank name, and the error still surfaces in this card.
 */
export default function PublishCard({ b, clients }) {
  return (
    <div style={{ ...cardStyle, padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <p style={fieldLabel}>Goes out to</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button onClick={() => b.setAssignedTo([])} style={chip(b.assignedTo.length === 0)}>Everyone</button>
          {clients.map((c) => {
            const on = b.assignedTo.includes(c.userId);
            return (
              <button
                key={c.userId}
                onClick={() => b.setAssignedTo((prev) => (on ? prev.filter((u) => u !== c.userId) : [...prev, c.userId]))}
                style={chip(on)}
              >{c.name.split(' ')[0]}</button>
            );
          })}
        </div>
        {b.assignedTo.length > 0 && (
          <p style={hint}>Only the selected {b.assignedTo.length === 1 ? 'client sees' : 'clients see'} this session.</p>
        )}
      </div>

      {/* Today or a date, rather than a date field to fill in every time. The
          overwhelmingly common case shouldn't cost a date picker. */}
      <div>
        <p style={fieldLabel}>When</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button onClick={() => b.setDateMode('today')} style={chip(b.dateMode === 'today')}>Today</button>
          <button
            onClick={() => { b.setDateMode('pick'); if (!b.sessionDate) b.setSessionDate(todayISO()); }}
            style={chip(b.dateMode === 'pick')}
          >Pick a date</button>
        </div>
        {b.dateMode === 'pick' && (
          <input
            type="date"
            value={b.sessionDate}
            onChange={(e) => b.setSessionDate(e.target.value)}
            style={{ ...inputStyle, marginTop: 10 }}
          />
        )}
      </div>

      <div>
        <p style={fieldLabel}>Safety notes</p>
        <textarea
          placeholder="How to do this session safely — warm-up, form reminders, weight guidance, injuries to watch."
          value={b.notes}
          onChange={(e) => b.setNotes(e.target.value)}
          rows={4}
          style={{ ...inputStyle, fontWeight: 500, lineHeight: 1.5, resize: 'vertical', minHeight: 90 }}
        />
        <p style={hint}>
          {b.runNote
            ? 'Shown to clients with the session, below Gym Daddy’s run note. Optional.'
            : 'Shown to clients with the session. Optional.'}
        </p>
      </div>

      {b.saveMsg && (
        <div style={{
          borderRadius: R.control, padding: '12px 16px', textAlign: 'center', fontSize: 13, fontWeight: 700,
          background: b.saveMsg.type === 'error' ? 'var(--red-tint)' : 'var(--accent-tint)',
          color: b.saveMsg.type === 'error' ? 'var(--red-ink)' : 'var(--accent-strong)',
        }}>{b.saveMsg.text}</div>
      )}

      {/* Side by side, and Publish is NOT a full-width primary. It is the
          irreversible one — it goes live for everyone and posts to the feed —
          so it must not also be the easiest thing to hit by accident. */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={() => b.handlePublish(false)} disabled={b.saving} style={{
          flex: 1, padding: 15, background: 'var(--soft)', border: 'none', borderRadius: R.control,
          color: 'var(--ink-2)', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: b.saving ? 0.5 : 1,
        }}>Save draft</button>
        <button onClick={() => b.handlePublish(true)} disabled={b.saving} className="gd-disp gd-shine" style={{
          flex: 1.4, padding: 15, background: 'var(--grad)', border: 'none', borderRadius: R.control,
          color: 'var(--on-accent)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          opacity: b.saving ? 0.5 : 1, boxShadow: b.saving ? 'none' : 'var(--glow-grad)',
        }}>{b.saving ? 'Saving…' : 'Publish & activate'}</button>
      </div>
    </div>
  );
}

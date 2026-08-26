'use client';
import { useState } from 'react';
import { R, T } from '@/lib/ui';

// Enough to recognise the one you want without turning the tail of the screen
// into a list again.
const PREVIEW = 5;

/**
 * Saved drafts, collapsed, at the bottom.
 *
 * Already the right shape — commit 66b1e9c moved these below the builder
 * deliberately, because scrolling past eleven old drafts to reach the form was
 * the wrong way round. Kept as-is, just lifted into its own component.
 */
export default function DraftList({ drafts, draftId, onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState(false);

  // Newest first: the API hands these back in whatever order Cosmos stored
  // them, and "the newest 5" has to mean something.
  const newest = [...drafts].sort((a, b) =>
    String(b.createdAt || b.date || '').localeCompare(String(a.createdAt || a.date || ''))
  );
  if (newest.length === 0) return null;

  const shown = all ? newest : newest.slice(0, PREVIEW);

  return (
    <div>
      <button
        onClick={() => { if (open) setAll(false); setOpen((o) => !o); }}
        aria-expanded={open}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--soft)', border: 'none', borderRadius: R.panel, padding: '13px 16px',
          color: 'var(--ink-2)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
        }}
      >
        <span>Saved drafts ({newest.length})</span>
        <span style={{
          color: 'var(--ink-3)', fontSize: 16,
          transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s ease',
        }}>&rsaquo;</span>
      </button>

      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
          {shown.map((d) => (
            <div key={d.id} style={{
              background: 'var(--card)',
              border: `1px solid ${draftId === d.id ? 'var(--accent)' : 'var(--line)'}`,
              borderRadius: R.control, padding: '12px 14px',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: T.md, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {d.name || 'Untitled'}
                </p>
                <p className="gd-num" style={{ margin: '2px 0 0', fontSize: T.xs, color: 'var(--ink-3)' }}>
                  {d.exercises?.length || 0} exercises &middot; {d.tag} &middot; {d.date}
                </p>
              </div>
              <button onClick={() => onEdit(d)} style={{
                flexShrink: 0, background: 'var(--accent-tint)', border: 'none', borderRadius: 10,
                padding: '8px 12px', color: 'var(--accent-strong)', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}>Edit</button>
              <button onClick={() => onDelete(d)} aria-label={`Delete draft ${d.name || 'Untitled'}`} style={{
                flexShrink: 0, background: 'none', border: 'none',
                color: 'var(--red-ink)', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}>Delete</button>
            </div>
          ))}
          {newest.length > PREVIEW && (
            <button onClick={() => setAll((v) => !v)} style={{
              background: 'none', border: 'none', padding: '4px 0 0',
              color: 'var(--accent-strong)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
            }}>{all ? 'Show fewer' : `Show all ${newest.length}`}</button>
          )}
        </div>
      )}
    </div>
  );
}

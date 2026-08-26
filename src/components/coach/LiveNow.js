'use client';
import { cardStyle, eyebrow, T } from '@/lib/ui';

/**
 * How long ago, in words.
 *
 * Deliberately relative. A date string makes you work out whether it is current;
 * "22h ago" tells you directly. Falls back to the plan's date when a plan
 * predates `createdAt` being stored.
 */
function since(iso, fallbackDate) {
  const t = iso ? new Date(iso).getTime() : NaN;
  if (!Number.isFinite(t)) return fallbackDate ? `for ${fallbackDate}` : '';
  const mins = Math.floor((Date.now() - t) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? 'yesterday' : `${days}d ago`;
}

/**
 * What is currently out there.
 *
 * Ambient status, which is why it carries no step number — it is not a step in
 * making a session. Critically it is NOT gated on the plan's date any more: the
 * old card only rendered when `activePlan.date === todayISO()`, so publishing
 * something for tomorrow left the screen whose entire job is publishing silent
 * about what the pack could actually see.
 */
export default function LiveNow({ plan, clients }) {
  if (!plan || !plan.name) return null;

  const who = !Array.isArray(plan.assignedTo) || plan.assignedTo.length === 0
    ? 'whole pack'
    : plan.assignedTo
        .map((uid) => clients.find((c) => c.userId === uid)?.name?.split(' ')[0])
        .filter(Boolean).join(', ') || 'selected members';

  const count = Array.isArray(plan.exercises) ? plan.exercises.length : 0;

  return (
    <div style={{ ...cardStyle, background: 'var(--accent-tint)', borderColor: 'transparent', padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ ...eyebrow, color: 'var(--accent-strong)' }}>What&rsquo;s live</p>
          <p className="gd-disp" style={{ margin: '4px 0 0', fontSize: 16, fontWeight: 700 }}>{plan.name}</p>
          <p className="gd-num" style={{ margin: '2px 0 0', fontSize: T.sm, color: 'var(--ink-2)' }}>
            {count} exercise{count === 1 ? '' : 's'} &middot; {who} &middot; {since(plan.createdAt, plan.date)}
          </p>
        </div>
        <span style={{
          flexShrink: 0, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
          background: 'var(--card)', color: 'var(--accent-strong)', borderRadius: 999, padding: '4px 9px',
        }}>Live</span>
      </div>
    </div>
  );
}

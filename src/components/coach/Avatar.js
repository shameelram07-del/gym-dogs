'use client';

/** The brand-gradient initials disc. Used by the header, the client list and the alerts strip. */
export default function Avatar({ initials, size = 44, online }) {
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <div style={{
        width: size, height: size, borderRadius: '50%', background: 'var(--grad)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.32, fontWeight: 700, color: 'var(--on-accent)',
      }}>{initials}</div>
      {online !== undefined && (
        <div style={{
          position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: '50%',
          background: online ? 'var(--accent)' : 'var(--orange)', border: '2px solid var(--card)',
        }} />
      )}
    </div>
  );
}

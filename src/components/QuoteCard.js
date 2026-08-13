'use client';

import { useState, useEffect } from 'react';
import { quoteOfTheDay, randomQuote } from '@/lib/quotes';

// Renders a Gym Daddy quote. mode: 'daily' (default) or 'random'.
// plain=true renders a subtle inline line instead of a card.
// Quote is chosen after mount to avoid static-export hydration mismatch.
export default function QuoteCard({ mode = 'daily', plain = false }) {
  const [q, setQ] = useState('');
  useEffect(() => { setQ(mode === 'random' ? randomQuote() : quoteOfTheDay()); }, [mode]);
  if (!q) return null;

  if (plain) {
    return (
      <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-3)', fontStyle: 'italic', lineHeight: 1.5, textAlign: 'center' }}>
        &ldquo;{q}&rdquo;
      </p>
    );
  }

  return (
    <div style={{ background: 'var(--accent-tint)', borderRadius: 26, padding: 18 }}>
      <div style={{ fontSize: 34, lineHeight: 0.9, color: 'var(--accent-strong)', fontWeight: 800, marginBottom: 4 }}>&ldquo;</div>
      <p style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.5 }}>{q}</p>
      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', color: 'var(--accent-strong)', textTransform: 'uppercase' }}>Gym Daddy</p>
    </div>
  );
}

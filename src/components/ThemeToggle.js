'use client';

import { useState, useEffect } from 'react';
import { getTheme, setTheme as saveTheme, watchTheme } from '@/lib/theme';

export default function ThemeToggle({ size = 38 }) {
  // Starts as dark to match the default, then reads what is actually applied.
  // It never re-applies on mount: that is what used to flip the theme, because
  // this component defaulted to light while the page defaulted to dark.
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    setTheme(getTheme());
    return watchTheme(setTheme);
  }, []);

  function toggle() {
    setTheme(saveTheme(theme === 'dark' ? 'light' : 'dark'));
  }

  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggle}
      aria-label="Toggle dark mode"
      style={{
        width: size, height: size, borderRadius: '50%',
        background: 'var(--soft)', border: '1px solid var(--line)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', color: 'var(--ink-2)', flexShrink: 0,
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {isDark ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        ) : (
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        )}
      </svg>
    </button>
  );
}

'use client';

// The ONE place the theme is decided. The pre-paint script in layout.js does
// the same thing inline (it runs before any JS bundle loads), so the rules
// here and there must match: saved choice from localStorage, else the cookie
// backup, else dark.
//
// Why two stores: iOS can clear a site's localStorage (and the home-screen app
// keeps its own, separate from Safari). Writing a long-lived cookie as well
// means one surviving copy is enough to keep the choice.

export const THEME_KEY = 'gd-theme';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 400; // 400 days, the browser maximum

function valid(t) { return t === 'dark' || t === 'light' ? t : null; }

function readCookie() {
  try {
    const m = document.cookie.match(/(?:^|;\s*)gd-theme=(dark|light)/);
    return m ? m[1] : null;
  } catch (e) {
    console.warn('theme: cookie unreadable', e);
    return null;
  }
}

export function getTheme() {
  // Whatever the pre-paint script already applied wins: it is what the user
  // is looking at, so re-deciding here could only ever flip it.
  const applied = valid(document.documentElement.getAttribute('data-theme'));
  if (applied) return applied;
  let saved = null;
  try { saved = valid(localStorage.getItem(THEME_KEY)); } catch (e) { console.warn('theme: localStorage unreadable', e); }
  return saved || readCookie() || 'dark';
}

export function setTheme(t) {
  const next = valid(t) || 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem(THEME_KEY, next); } catch (e) { console.warn('theme: could not save to localStorage', e); }
  try { document.cookie = `gd-theme=${next}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax; secure`; } catch (e) { console.warn('theme: could not save cookie', e); }
  return next;
}

// Re-apply the saved theme when another tab changes it, or when iOS restores
// the page from its back/forward cache with a stale attribute.
export function watchTheme(onChange) {
  const sync = () => {
    let saved = null;
    try { saved = valid(localStorage.getItem(THEME_KEY)); } catch (e) { /* cookie below */ }
    const t = saved || readCookie();
    if (t && t !== document.documentElement.getAttribute('data-theme')) {
      document.documentElement.setAttribute('data-theme', t);
      onChange?.(t);
    }
  };
  window.addEventListener('storage', sync);
  window.addEventListener('pageshow', sync);
  return () => { window.removeEventListener('storage', sync); window.removeEventListener('pageshow', sync); };
}

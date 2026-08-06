// Dates, in the user's own timezone.
//
// The app used `new Date().toISOString().split('T')[0]` everywhere, which is UTC.
// New Zealand runs at UTC+12 (+13 in daylight saving), so between midnight and
// midday local time that expression returns YESTERDAY. Every "today" in the app
// — the day's food, the workout streak, "done today" — rolled over at noon
// instead of midnight.
//
// These helpers use the local calendar day instead. Same 'YYYY-MM-DD' format, so
// stored data and sort order are unaffected.

/** 'YYYY-MM-DD' for a Date, in local time. */
export function toLocalISO(d) {
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date)) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Today's local calendar date. Call it — never cache it at module scope, or a
 *  tab left open overnight keeps showing yesterday. */
export const todayISO = () => toLocalISO(new Date());

/** Local date N days from today (negative for the past). */
export function shiftISO(days, from) {
  const d = from ? new Date(from) : new Date();
  d.setDate(d.getDate() + days);
  return toLocalISO(d);
}

/**
 * Fires when the local calendar day changes — on a timer, and whenever the tab
 * is brought back to the foreground. Phones suspend background tabs, so the
 * visibility check is the one that actually catches an overnight rollover.
 */
export function onDayChange(current, callback) {
  let last = current;
  const check = () => {
    const now = todayISO();
    if (now !== last) { last = now; callback(now); }
  };
  const timer = setInterval(check, 60000);
  document.addEventListener('visibilitychange', check);
  window.addEventListener('focus', check);
  return () => {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', check);
    window.removeEventListener('focus', check);
  };
}

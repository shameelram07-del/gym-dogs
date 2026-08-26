// Personal bests, defined once.
//
// Profile said 22 and Progress said 5 for the same account at the same moment.
// Neither was a different definition of a PR — both counted the distinct
// exercises you have moved weight on, which is 22. Progress was rendering
// `prs.length` on a list it had already cut to the top five for display, so the
// stat was really "how many rows fit in the card".
//
// The definition kept is ONE PR PER EXERCISE: your best-ever top set on a
// movement. It matches the "First PR" and "5 PRs set" badges on Profile, which
// would otherwise be unreachable-then-instant depending on which screen you
// asked, and it is the number that grows as you train rather than one that
// stops at five.
//
// Pure — no React, no fetch — so both screens read the same number.

/**
 * Every exercise's best set, heaviest first.
 *
 * @param {Array}    logs      gymLogs docs; sets live in `sets_data` as JSON
 * @param {Function} [onError] called with the parse error for a doc that won't
 *                             read, so the caller can report it. A bad doc is
 *                             skipped, never fatal.
 * @returns {Array<{exercise: string, weight: number, date: string}>}
 */
export function personalBests(logs, onError) {
  const best = {};
  (logs || []).forEach((log) => {
    if (!log || !log.exName) return;
    try {
      const sets = JSON.parse(log.sets_data || '[]');
      sets.forEach((s) => {
        const kg = parseFloat(s && s.kg);
        if (!Number.isFinite(kg) || kg <= 0) return;
        if (!best[log.exName] || kg > best[log.exName].weight) {
          best[log.exName] = { exercise: log.exName, weight: kg, date: log.date };
        }
      });
    } catch (e) {
      if (onError) onError(e);
    }
  });
  return Object.values(best).sort((a, b) => b.weight - a.weight);
}

/** How many PRs stand. The number Profile and Progress both show. */
export function prCount(logs, onError) {
  return personalBests(logs, onError).length;
}

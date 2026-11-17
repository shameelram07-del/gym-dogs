// Who the coach is, and how coach screens show member names.
//
// This is a CLIENT-SIDE guard only: it hides the Coach tab and bounces
// non-coaches off /coach. The API must still enforce coach-only access itself.

export const COACH_ID = '6d765ac9-47b2-4d3f-b36a-9d784015b917';

/** True when the signed-in MSAL account is the coach. */
export function isCoach(account) {
  return !!account && account.localAccountId === COACH_ID;
}

// Some Entra accounts have their display name set to the account GUID.
const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function looksLikeGuid(s) {
  return typeof s === 'string' && GUID_RE.test(s.trim());
}

/** A member's display name, or a fallback when it is missing or a GUID. */
export function memberName(name, fallback = 'Member') {
  if (typeof name !== 'string') return fallback;
  const n = name.trim();
  if (!n || looksLikeGuid(n)) return fallback;
  return n;
}

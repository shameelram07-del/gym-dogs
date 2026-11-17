'use client';

// Single-user mode. Login was removed (Nov 2026): Shameel is the only user, so
// every screen runs as him. This stands in for `useMsal()` from
// @azure/msal-react and returns the same shape the pages already read
// (accounts[0].localAccountId, inProgress, instance), so the pages didn't need
// rewriting.
//
// To bring real login back: restore MsalProvider in layout.js and point the
// imports of `useMsal` back at '@azure/msal-react'.

import { COACH_ID } from '@/lib/coach';

const ME = {
  localAccountId: COACH_ID,
  name: 'Shameel',
  username: '',
  idTokenClaims: {},
};

const STATE = {
  accounts: [ME],
  inProgress: 'none',
  instance: { logoutRedirect: () => {} },
};

export function useMsal() {
  return STATE;
}

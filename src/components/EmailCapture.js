'use client';

import { useEffect } from 'react';
import { useMsal } from '@azure/msal-react';
import { captureError } from '@/lib/monitoring';

const PROFILES_URL = 'https://gymdogs-api-g9d0gve4angygdcj.newzealandnorth-01.azurewebsites.net/api/userProfiles';
const PROFILES_KEY = process.env.NEXT_PUBLIC_PROFILES_API_KEY;

// Entra External ID puts the email in different places depending on setup —
// try username first, then the token claims. Return only a valid-looking email.
function emailOf(account) {
  if (!account) return null;
  const c = account.idTokenClaims || {};
  const emails = Array.isArray(c.emails) ? c.emails[0] : c.emails;
  const cand = account.username || c.email || emails || c.preferred_username || c.upn;
  return cand && /.+@.+\..+/.test(String(cand)) ? String(cand).toLowerCase() : null;
}

// Runs app-wide (rendered inside the MSAL provider) so a client's email is saved
// to their profile no matter which page they land on. De-dupes per session.
export default function EmailCapture() {
  const { accounts, inProgress } = useMsal();
  useEffect(() => {
    if (inProgress !== 'none') return;
    const acc = accounts[0];
    if (!acc) return;
    const email = emailOf(acc);
    const uid = acc.localAccountId;
    if (!email || !uid) return;
    const key = 'gd-email-saved-' + uid;
    // Deliberate: sessionStorage throws in private mode. Losing the de-dupe just
    // means one extra POST, which is harmless.
    try { if (sessionStorage.getItem(key) === email) return; } catch (e) {}
    fetch(PROFILES_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-functions-key': PROFILES_KEY || '' },
      body: JSON.stringify({ userId: uid, email }),
    })
      .then((res) => {
        // Only mark it done on a confirmed write. Setting the de-dupe key after
        // a failed save means no retry for the rest of the session, and the
        // coach silently has no email for that client.
        if (!res.ok) {
          console.error(`EmailCapture: email not saved for ${uid} (${res.status})`);
          captureError(new Error(`Email not saved (${res.status})`), {
            screen: 'app', action: 'save-email', endpoint: 'userProfiles', status: res.status,
          });
          return;
        }
        // Deliberate: see above — private mode only costs a repeat POST.
        try { sessionStorage.setItem(key, email); } catch (e) {}
      })
      .catch((e) => {
        console.error('EmailCapture: email not saved', e);
        captureError(e, { screen: 'app', action: 'save-email', endpoint: 'userProfiles' });
      });
  }, [accounts, inProgress]);
  return null;
}

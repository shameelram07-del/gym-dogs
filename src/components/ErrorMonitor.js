'use client';

// Starts error monitoring and keeps it told who and where.
//
// Rendered inside MsalProvider alongside EmailCapture, so it's live on every
// screen. With no DSN configured this mounts, does nothing, and costs nothing.

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useMsal } from '@azure/msal-react';
import { initMonitoring, identifyUser, breadcrumb } from '@/lib/monitoring';

export default function ErrorMonitor() {
  const { accounts, inProgress } = useMsal();
  const pathname = usePathname();

  useEffect(() => { initMonitoring(); }, []);

  // Only the opaque local account id — never the name, never the email.
  useEffect(() => {
    if (inProgress !== 'none') return;
    identifyUser(accounts[0] ? accounts[0].localAccountId : null);
  }, [accounts, inProgress]);

  // Which screen they were on is what makes a stack trace answerable a week
  // later. The path is app routing, not user data.
  useEffect(() => {
    if (pathname) breadcrumb('screen', { path: pathname });
  }, [pathname]);

  return null;
}

'use client';

// Wraps every screen. Used to be MsalProvider; login was removed (Nov 2026,
// single-user mode, see src/lib/me.js), so all that's left is error monitoring.

import ErrorMonitor from '@/components/ErrorMonitor';

export default function AppProvider({ children }) {
  return (
    <>
      <ErrorMonitor />
      {children}
    </>
  );
}

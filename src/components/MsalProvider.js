'use client';

import { useState, useEffect } from 'react';
import { PublicClientApplication } from '@azure/msal-browser';
import { MsalProvider } from '@azure/msal-react';
import { msalConfig } from '@/lib/authConfig';
import EmailCapture from '@/components/EmailCapture';
import ErrorMonitor from '@/components/ErrorMonitor';
import { initMonitoring, captureError } from '@/lib/monitoring';

const msalInstance = new PublicClientApplication(msalConfig);

export default function AuthProvider({ children }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Started here as well as in ErrorMonitor, because nothing below renders
    // until MSAL resolves — and if it never does, that's the failure most worth
    // hearing about: the whole app is a blank screen with no error anywhere.
    initMonitoring();
    msalInstance.initialize()
      .then(() => setReady(true))
      .catch((err) => {
        console.error('Auth: MSAL failed to initialise — the app cannot render', err);
        captureError(err, { screen: 'app', action: 'msal-initialize' });
      });
  }, []);

  if (!ready) return null;

  return (
    <MsalProvider instance={msalInstance}>
      <ErrorMonitor />
      <EmailCapture />
      {children}
    </MsalProvider>
  );
}
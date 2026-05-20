'use client';

import { useState, useEffect } from 'react';
import { PublicClientApplication } from '@azure/msal-browser';
import { MsalProvider } from '@azure/msal-react';
import { msalConfig } from '@/lib/authConfig';

const msalInstance = new PublicClientApplication(msalConfig);

export default function AuthProvider({ children }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    msalInstance.initialize().then(() => {
      setReady(true);
    });
  }, []);

  if (!ready) return null;

  return (
    <MsalProvider instance={msalInstance}>
      {children}
    </MsalProvider>
  );
}
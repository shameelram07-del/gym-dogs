'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMsal } from '@azure/msal-react';
import { loginRequest } from '@/lib/authConfig';

export default function LoginPage() {
  const { instance, accounts } = useMsal();
  const router = useRouter();

  useEffect(() => {
    if (accounts && accounts.length > 0) {
      router.push('/dashboard');
    }
  }, [accounts, router]);

  const handleLogin = () => {
    instance.loginRedirect({ ...loginRequest, prompt: 'login' });
  };

  const handleSignUp = () => {
    instance.loginRedirect({ ...loginRequest, prompt: 'create' });
  };

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--bg)',
      color: 'var(--ink)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 28px',
      position: 'relative',
      overflow: 'hidden',
    }}>

      {/* soft brand glow */}
      <div style={{
        position: 'absolute', top: '-10%', left: '50%', transform: 'translateX(-50%)',
        width: 360, height: 360, borderRadius: '50%',
        background: 'var(--accent-tint)', filter: 'blur(60px)', pointerEvents: 'none',
      }} />

      {/* ── HERO ── */}
      <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <div style={{
          width: 88, height: 88, borderRadius: 26,
          background: 'linear-gradient(135deg, var(--accent), #27D17F)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 46, marginBottom: 22,
          boxShadow: '0 12px 30px -8px rgba(18,183,106,0.5)',
        }}>
          <img src="/images/gymdogs_logo.png" alt="Gym Dogs"
            style={{ width: 64, height: 64, objectFit: 'contain' }}
            onError={(e) => { e.target.replaceWith(document.createTextNode('🐕')); }} />
        </div>
        <h1 style={{ margin: 0, fontSize: 34, fontWeight: 800, letterSpacing: '-0.03em' }}>
          Gym Dogs
        </h1>
        <p style={{ margin: '10px 0 0', fontSize: 16, color: 'var(--ink-2)', fontWeight: 500 }}>
          Train smart. Recover smarter.
        </p>
      </div>

      {/* ── ACTIONS ── */}
      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button onClick={handleLogin} style={{
          width: '100%', border: 'none', borderRadius: 16, padding: '16px',
          background: 'var(--accent)', color: 'var(--on-accent)',
          fontSize: 16, fontWeight: 700, cursor: 'pointer',
        }}>
          Sign in
        </button>
        <button onClick={handleSignUp} style={{
          width: '100%', borderRadius: 16, padding: '16px',
          background: 'var(--soft)', color: 'var(--ink)', border: '1px solid var(--line)',
          fontSize: 16, fontWeight: 700, cursor: 'pointer',
        }}>
          Create account
        </button>
      </div>

      {/* ── FOOTER ── */}
      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 420, textAlign: 'center', paddingTop: 18, paddingBottom: 'calc(env(safe-area-inset-bottom, 16px) + 18px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 8 }}>
          <span style={{ fontSize: 13 }}>🔒</span>
          <span style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 500 }}>Secured by Microsoft Entra</span>
        </div>
        <p style={{ margin: 0, fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.6 }}>
          By continuing you agree to our Terms of Use and Privacy Policy
        </p>
      </div>

    </div>
  );
}

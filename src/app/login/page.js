'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMsal } from '@azure/msal-react';
import { loginRequest } from '@/lib/authConfig';
import QuoteCard from '@/components/QuoteCard';

const PROFILES_URL = 'https://gymdogs-api-g9d0gve4angygdcj.newzealandnorth-01.azurewebsites.net/api/userProfiles';
const PROFILES_KEY = process.env.NEXT_PUBLIC_PROFILES_API_KEY;

export default function LoginPage() {
  const { instance, accounts } = useMsal();
  const router = useRouter();

  useEffect(() => {
    if (!accounts || accounts.length === 0) return;
    // New users (no profile / onboarding not finished) go to onboarding first.
    // If the profile check fails for any reason, fail open to the dashboard.
    (async () => {
      const uid = accounts[0].localAccountId;

      // Fast path: this device already completed onboarding for this account.
      try {
        if (localStorage.getItem('gd-onboarded') === uid) {
          router.push('/dashboard');
          return;
        }
      } catch (e) {}

      try {
        const res = await fetch(`${PROFILES_URL}?userId=${uid}`, { headers: { 'x-functions-key': PROFILES_KEY || '' } });
        if (res.ok) {
          const data = await res.json();
          // The API may return a list — find THIS user's profile, don't grab the first one.
          const profile = Array.isArray(data)
            ? data.find((p) => p.userId === uid)
            : data;
          if (profile && !profile.error && profile.onboardingComplete) {
            try { localStorage.setItem('gd-onboarded', uid); } catch (e) {}
            router.push('/dashboard');
            return;
          }
          router.push('/onboarding');
          return;
        }
      } catch (e) {}
      router.push('/dashboard');
    })();
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
        <img src="/images/gymdogs_logo.png" alt="Gym Dogs"
          style={{ width: 150, height: 150, objectFit: 'contain', marginBottom: 18 }}
          onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        <h1 style={{ margin: 0, fontSize: 34, fontWeight: 800, letterSpacing: '-0.03em' }}>
          Gym Dogs
        </h1>
        <p style={{ margin: '10px 0 0', fontSize: 16, color: 'var(--ink-2)', fontWeight: 500 }}>
          Train smart. Recover smarter.
        </p>
        <div style={{ marginTop: 20, maxWidth: 300 }}><QuoteCard plain /></div>
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

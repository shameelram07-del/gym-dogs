'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMsal } from '@azure/msal-react';
import { loginRequest } from '@/lib/authConfig';
import QuoteCard from '@/components/QuoteCard';
import Reveal from '@/components/Reveal';

const eyebrow = { fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', color: 'var(--ink-3)', textTransform: 'uppercase', margin: 0 };

// Signed-in users always go straight to the dashboard.
// (The dashboard shows a dismissible "finish your setup" card for anyone
// who has not completed onboarding — no forced redirects, no loops.)

// The Gym Dogs mark — crafted inline SVG, themes with the app.
function LogoMark({ size = 92 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        {/* The same run as --grad: ice into steel into deep steel. */}
        <linearGradient id="gdTile" x1="0" y1="0" x2="96" y2="96" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--ice)" />
          <stop offset="0.52" stopColor="var(--steel)" />
          <stop offset="1" stopColor="var(--steel-deep)" />
        </linearGradient>
        <linearGradient id="gdShine" x1="0" y1="0" x2="0" y2="96" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--on-accent)" stopOpacity="0.22" />
          <stop offset="0.4" stopColor="var(--on-accent)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* squircle tile */}
      <rect x="2" y="2" width="92" height="92" rx="26" fill="url(#gdTile)" />
      <rect x="2" y="2" width="92" height="92" rx="26" fill="url(#gdShine)" />
      <rect x="2.75" y="2.75" width="90.5" height="90.5" rx="25.25" stroke="var(--on-accent)" strokeOpacity="0.18" strokeWidth="1.5" />

      {/* dumbbell, set at a confident angle */}
      <g transform="rotate(-32 48 48)">
        <rect x="24" y="45" width="48" height="6" rx="3" fill="var(--on-accent)" />
        <rect x="18" y="34" width="9" height="28" rx="4.5" fill="var(--on-accent)" />
        <rect x="69" y="34" width="9" height="28" rx="4.5" fill="var(--on-accent)" />
        <rect x="10" y="39" width="6" height="18" rx="3" fill="var(--on-accent)" opacity="0.75" />
        <rect x="80" y="39" width="6" height="18" rx="3" fill="var(--on-accent)" opacity="0.75" />
      </g>

      {/* paw print accent */}
      <g transform="translate(62 60)">
        <ellipse cx="8" cy="10.5" rx="5.2" ry="4.4" fill="var(--logo-ink)" opacity="0.9" />
        <circle cx="1.8" cy="5.4" r="2.1" fill="var(--logo-ink)" opacity="0.9" />
        <circle cx="6" cy="2.6" r="2.1" fill="var(--logo-ink)" opacity="0.9" />
        <circle cx="10.6" cy="2.8" r="2.1" fill="var(--logo-ink)" opacity="0.9" />
        <circle cx="14.4" cy="6" r="2.1" fill="var(--logo-ink)" opacity="0.9" />
      </g>
    </svg>
  );
}

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
      {/* Ambient slate glow — ice above, steel below, matching the app-wide orbs.
          Static: a moving full-screen blur is what caused the scroll jank. */}
      <div style={{
        position: 'absolute', top: '-16%', left: '50%', transform: 'translateX(-58%)',
        width: 480, height: 480, borderRadius: '50%',
        background: 'radial-gradient(circle, var(--blue-tint), transparent 65%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-22%', right: '-24%',
        width: 460, height: 460, borderRadius: '50%',
        background: 'radial-gradient(circle, var(--accent-glow), transparent 65%)',
        pointerEvents: 'none',
      }} />

      {/* ── HERO ── */}
      <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <Reveal delay={0}>
          <div style={{ marginBottom: 22, filter: 'drop-shadow(0 18px 34px var(--accent-glow))', animation: 'gdFloat 5s ease-in-out 3' }}>
            <LogoMark />
          </div>
        </Reveal>
        <Reveal delay={80}>
          <h1 className="gd-disp gd-grad-text" style={{ margin: 0, fontSize: 40, fontWeight: 700, lineHeight: 1 }}>
            Gym Dogs
          </h1>
          <p style={{ ...eyebrow, margin: '12px 0 0', fontSize: 12, letterSpacing: '0.14em' }}>
            Train smart · Recover smarter
          </p>
        </Reveal>
        <Reveal delay={160} style={{ marginTop: 26, maxWidth: 300 }}>
          <QuoteCard plain />
        </Reveal>
      </div>

      {/* ── ACTIONS ── */}
      <Reveal delay={240} style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 420 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button onClick={handleLogin} className="gd-disp" style={{
            width: '100%', border: 'none', borderRadius: 18, padding: '17px',
            background: 'var(--grad)', color: 'var(--on-accent)',
            fontSize: 16, fontWeight: 700, cursor: 'pointer',
            boxShadow: 'var(--glow-grad)',
          }}>
            Sign in
          </button>
          <button onClick={handleSignUp} style={{
            width: '100%', borderRadius: 18, padding: '16px',
            background: 'transparent', color: 'var(--ink)', border: '1px solid var(--line-2)',
            fontSize: 15, fontWeight: 600, cursor: 'pointer',
          }}>
            Create account
          </button>
        </div>
      </Reveal>

      {/* ── FOOTER ── */}
      <Reveal delay={320} style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 420, textAlign: 'center', paddingTop: 20, paddingBottom: 'calc(env(safe-area-inset-bottom, 16px) + 20px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, marginBottom: 8 }}>
          <svg width="12" height="14" viewBox="0 0 12 14" fill="none">
            <rect x="1" y="6" width="10" height="7" rx="2" stroke="var(--ink-3)" strokeWidth="1.4" />
            <path d="M3.5 6V4.5a2.5 2.5 0 0 1 5 0V6" stroke="var(--ink-3)" strokeWidth="1.4" />
          </svg>
          <span style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 500 }}>Secured by Microsoft Entra</span>
        </div>
        <p style={{ margin: 0, fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.6 }}>
          By continuing you agree to our Terms of Use and Privacy Policy
        </p>
      </Reveal>

    </div>
  );
}

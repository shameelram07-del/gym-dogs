'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMsal } from '@azure/msal-react';
import { loginRequest } from '@/lib/authConfig';
import QuoteCard from '@/components/QuoteCard';

// Signed-in users always go straight to the dashboard.
// (The dashboard shows a dismissible "finish your setup" card for anyone
// who has not completed onboarding — no forced redirects, no loops.)

// The Gym Dogs mark — crafted inline SVG, themes with the app.
function LogoMark({ size = 92 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="gdTile" x1="0" y1="0" x2="96" y2="96" gradientUnits="userSpaceOnUse">
          <stop stopColor="#12B76A" />
          <stop offset="1" stopColor="#0B8F7A" />
        </linearGradient>
        <linearGradient id="gdShine" x1="0" y1="0" x2="0" y2="96" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" stopOpacity="0.22" />
          <stop offset="0.4" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* squircle tile */}
      <rect x="2" y="2" width="92" height="92" rx="26" fill="url(#gdTile)" />
      <rect x="2" y="2" width="92" height="92" rx="26" fill="url(#gdShine)" />
      <rect x="2.75" y="2.75" width="90.5" height="90.5" rx="25.25" stroke="#FFFFFF" strokeOpacity="0.18" strokeWidth="1.5" />

      {/* dumbbell, set at a confident angle */}
      <g transform="rotate(-32 48 48)">
        <rect x="24" y="45" width="48" height="6" rx="3" fill="#FFFFFF" />
        <rect x="18" y="34" width="9" height="28" rx="4.5" fill="#FFFFFF" />
        <rect x="69" y="34" width="9" height="28" rx="4.5" fill="#FFFFFF" />
        <rect x="10" y="39" width="6" height="18" rx="3" fill="#FFFFFF" opacity="0.75" />
        <rect x="80" y="39" width="6" height="18" rx="3" fill="#FFFFFF" opacity="0.75" />
      </g>

      {/* paw print accent */}
      <g transform="translate(62 60)">
        <ellipse cx="8" cy="10.5" rx="5.2" ry="4.4" fill="#052E1E" opacity="0.9" />
        <circle cx="1.8" cy="5.4" r="2.1" fill="#052E1E" opacity="0.9" />
        <circle cx="6" cy="2.6" r="2.1" fill="#052E1E" opacity="0.9" />
        <circle cx="10.6" cy="2.8" r="2.1" fill="#052E1E" opacity="0.9" />
        <circle cx="14.4" cy="6" r="2.1" fill="#052E1E" opacity="0.9" />
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
      <style>{`
        @keyframes gdRise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
        .gd-rise-1 { animation: gdRise 0.6s cubic-bezier(0.22,1,0.36,1) both; }
        .gd-rise-2 { animation: gdRise 0.6s 0.08s cubic-bezier(0.22,1,0.36,1) both; }
        .gd-rise-3 { animation: gdRise 0.6s 0.16s cubic-bezier(0.22,1,0.36,1) both; }
        .gd-rise-4 { animation: gdRise 0.6s 0.24s cubic-bezier(0.22,1,0.36,1) both; }
        .gd-btn { transition: transform 0.12s ease, box-shadow 0.2s ease, background 0.2s ease; }
        .gd-btn:active { transform: scale(0.975); }
        .gd-btn-primary:hover { box-shadow: 0 10px 30px rgba(18,183,106,0.35); }
        .gd-btn-ghost:hover { background: var(--soft); }
      `}</style>

      {/* layered ambient glow */}
      <div style={{
        position: 'absolute', top: '-16%', left: '50%', transform: 'translateX(-58%)',
        width: 480, height: 480, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(18,183,106,0.16), transparent 65%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-22%', right: '-24%',
        width: 460, height: 460, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(46,144,250,0.10), transparent 65%)',
        pointerEvents: 'none',
      }} />

      {/* ── HERO ── */}
      <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <div className="gd-rise-1" style={{ marginBottom: 22, filter: 'drop-shadow(0 18px 34px rgba(18,183,106,0.28))' }}>
          <LogoMark />
        </div>
        <h1 className="gd-rise-2" style={{ margin: 0, fontSize: 38, fontWeight: 800, letterSpacing: '-0.045em', lineHeight: 1 }}>
          Gym Dogs
        </h1>
        <p className="gd-rise-2" style={{
          margin: '12px 0 0', fontSize: 14, color: 'var(--ink-2)', fontWeight: 500,
          letterSpacing: '0.14em', textTransform: 'uppercase',
        }}>
          Train smart · Recover smarter
        </p>
        <div className="gd-rise-3" style={{ marginTop: 26, maxWidth: 300 }}>
          <QuoteCard plain />
        </div>
      </div>

      {/* ── ACTIONS ── */}
      <div className="gd-rise-4" style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button onClick={handleLogin} className="gd-btn gd-btn-primary" style={{
          width: '100%', border: 'none', borderRadius: 16, padding: '17px',
          background: 'var(--accent)', color: 'var(--on-accent)',
          fontSize: 16, fontWeight: 700, cursor: 'pointer',
          boxShadow: '0 6px 22px rgba(18,183,106,0.28)',
        }}>
          Sign in
        </button>
        <button onClick={handleSignUp} className="gd-btn gd-btn-ghost" style={{
          width: '100%', borderRadius: 16, padding: '16px',
          background: 'transparent', color: 'var(--ink)', border: '1px solid var(--line)',
          fontSize: 15, fontWeight: 600, cursor: 'pointer',
        }}>
          Create account
        </button>
      </div>

      {/* ── FOOTER ── */}
      <div className="gd-rise-4" style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 420, textAlign: 'center', paddingTop: 20, paddingBottom: 'calc(env(safe-area-inset-bottom, 16px) + 20px)' }}>
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
      </div>

    </div>
  );
}

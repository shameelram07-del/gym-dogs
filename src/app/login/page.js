'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMsal } from '@azure/msal-react';
import { loginRequest } from '@/lib/authConfig';

export default function LoginPage() {
  const { instance, accounts } = useMsal();
  const router = useRouter();

  // If already logged in, redirect to dashboard
  useEffect(() => {
    if (accounts && accounts.length > 0) {
      router.push('/dashboard');
    }
  }, [accounts, router]);

  const handleLogin = () => {
    instance.loginRedirect({
      ...loginRequest,
      prompt: 'login',
    });
  };

  const handleSignUp = () => {
    instance.loginRedirect({
      ...loginRequest,
      prompt: 'create',
    });
  };

  return (
    <div style={{
      minHeight: '100vh',
      minHeight: '100dvh',
      background: '#080008',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      overflowX: 'hidden',
      position: 'relative',
    }}>

      {/* ── BACKGROUND LAYERS ── */}

      {/* Deep purple radial vignette */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 80% 60% at 50% 30%, rgba(88,28,220,0.35) 0%, rgba(30,0,60,0.5) 50%, #080008 100%)',
      }} />

      {/* Spotlight glow behind mascot */}
      <div style={{
        position: 'absolute', top: '5%', left: '50%',
        transform: 'translateX(-50%)',
        width: '340px', height: '340px',
        background: 'radial-gradient(circle, rgba(139,92,246,0.3) 0%, rgba(109,40,217,0.15) 40%, transparent 70%)',
        pointerEvents: 'none',
        filter: 'blur(20px)',
      }} />

      {/* Ambient bottom glow */}
      <div style={{
        position: 'absolute', bottom: 0, left: '50%',
        transform: 'translateX(-50%)',
        width: '300px', height: '200px',
        background: 'radial-gradient(ellipse, rgba(109,40,217,0.15) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* ── HERO SECTION ── */}
      <div style={{
        position: 'relative', zIndex: 10,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center',
        marginTop: '-16px',
        flex: 1,
        justifyContent: 'center',
        maxHeight: '70vh',
      }}>

        {/* Mascot hero image */}
        <div style={{ position: 'relative', width: '100%', maxWidth: '360px' }}>
          {/* Purple outer glow around mascot */}
          <div style={{
            position: 'absolute', top: '10%', left: '50%',
            transform: 'translateX(-50%)',
            width: '260px', height: '260px',
            background: 'radial-gradient(circle, rgba(139,92,246,0.25) 0%, transparent 70%)',
            filter: 'blur(16px)',
            pointerEvents: 'none',
          }} />
          <img
            src="/images/gymdogs_logo.png"
            alt="Gym Dogs Mascot"
            style={{
              width: '100%',
              maxWidth: '360px',
              objectFit: 'contain',
              display: 'block',
              margin: '0 auto',
              filter: 'drop-shadow(0 0 30px rgba(139,92,246,0.4)) drop-shadow(0 0 60px rgba(109,40,217,0.2))',
            }}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        </div>

        {/* Tagline */}
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <p style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 900,
            letterSpacing: '0.12em',
            lineHeight: 1.2,
            color: '#fff',
          }}>
            TRAIN HARDER.
          </p>
          <p style={{
            margin: '2px 0 0',
            fontSize: 22,
            fontWeight: 900,
            letterSpacing: '0.12em',
            lineHeight: 1.2,
            background: 'linear-gradient(90deg, #a78bfa, #7c3aed)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            TRACK EVERYTHING.
          </p>
        </div>
      </div>

      {/* ── BUTTONS SECTION ── */}
      <div style={{
        position: 'relative', zIndex: 10,
        width: '100%', maxWidth: '400px',
        display: 'flex', flexDirection: 'column',
        gap: 12,
        paddingBottom: 8,
      }}>

        {/* START TRAINING — primary purple */}
        <button
          onClick={handleLogin}
          style={{
            width: '100%',
            background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 50%, #4c1d95 100%)',
            border: '1px solid rgba(167,139,250,0.3)',
            borderRadius: 18,
            padding: '17px 24px',
            color: '#fff',
            fontSize: 15,
            fontWeight: 800,
            letterSpacing: '0.1em',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 20px rgba(109,40,217,0.35), 0 1px 0 rgba(255,255,255,0.1) inset',
          }}
        >
          <img
            src="/images/icon_start_training.png"
            alt=""
            style={{ width: 32, height: 32, objectFit: 'contain' }}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <span>START TRAINING</span>
          <span style={{ fontSize: 18, opacity: 0.8 }}>→</span>
        </button>

        {/* CREATE ACCOUNT — dark glass */}
        <button
          onClick={handleSignUp}
          style={{
            width: '100%',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(139,92,246,0.35)',
            borderRadius: 18,
            padding: '17px 24px',
            color: '#e2e8f0',
            fontSize: 15,
            fontWeight: 800,
            letterSpacing: '0.1em',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <img
            src="/images/icon_create_account.png"
            alt=""
            style={{ width: 32, height: 32, objectFit: 'contain' }}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <span>CREATE ACCOUNT</span>
          <span style={{ fontSize: 18, opacity: 0.5 }}>→</span>
        </button>

      </div>

      {/* ── BOTTOM SECTION ── */}
      <div style={{
        position: 'relative', zIndex: 10,
        width: '100%', maxWidth: '400px',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 8,
        paddingBottom: 'calc(env(safe-area-inset-bottom, 16px) + 16px)',
        paddingTop: 16,
      }}>

        {/* Secured by */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13 }}>🔒</span>
          <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>
            Secured by Microsoft Entra
          </span>
        </div>

        {/* Terms */}
        <p style={{ margin: 0, fontSize: 11, color: '#4b5563', textAlign: 'center', lineHeight: 1.6 }}>
          By continuing you agree to our{' '}
          <span style={{ color: '#a78bfa', cursor: 'pointer' }}>Terms of Use</span>
          {' '}and{' '}
          <span style={{ color: '#a78bfa', cursor: 'pointer' }}>Privacy Policy</span>
        </p>

      </div>

    </div>
  );
}
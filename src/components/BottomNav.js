'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useMsal } from '@azure/msal-react';

const COACH_ID = '6d765ac9-47b2-4d3f-b36a-9d784015b917';

const ICONS = {
  home:     <><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></>,
  train:    <><path d="M6 7v10M18 7v10M4 9v6M20 9v6M6 12h12" /></>,
  eat:      <><path d="M4 3v6a2 2 0 0 0 2 2h.5a2 2 0 0 0 2-2V3" /><path d="M6.25 11v10" /><path d="M20 14V3a4.5 4.5 0 0 0-4 4.5V12a2 2 0 0 0 2 2h2zm0 0v7" /></>,
  progress: <><path d="M4 19V5M4 19h16M8 16l4-5 3 3 5-7" /></>,
  community:<><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3 20c0-3 3-5 6-5s6 2 6 5M15 20c0-2 1-3 3-3s3 1 3 3" /></>,
  coach:    <><path d="M12 3l2.5 5 5.5.8-4 3.9.9 5.4-4.9-2.6-4.9 2.6.9-5.4-4-3.9 5.5-.8z" /></>,
  profile:  <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-4 3-6 7-6s7 2 7 6" /></>,
};

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { accounts } = useMsal();

  const isCoach = accounts[0]?.localAccountId === COACH_ID;

  const tabs = [
    { label: 'Home',      key: 'home',      href: '/dashboard' },
    { label: 'Train',     key: 'train',     href: '/workout'   },
    { label: 'Eat',       key: 'eat',       href: '/nutrition' },
    { label: 'Progress',  key: 'progress',  href: '/progress'  },
    { label: 'Community', key: 'community', href: '/community' },
    ...(isCoach ? [{ label: 'Coach', key: 'coach', href: '/coach' }] : []),
    { label: 'Profile',   key: 'profile',   href: '/profile'   },
  ];

  return (
    <nav aria-label="Main" style={{
      position: 'fixed',
      bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480,
      background: 'var(--nav-bg)',
      backdropFilter: 'blur(18px)',
      WebkitBackdropFilter: 'blur(18px)',
      borderTop: '1px solid var(--line-2)',
      display: 'flex',
      zIndex: 100,
      paddingTop: 10,
      paddingBottom: 'calc(8px + env(safe-area-inset-bottom))',
    }}>
      {tabs.map((item) => {
        const active = pathname === item.href;
        return (
          <button
            key={item.href}
            onClick={() => router.push(item.href)}
            aria-current={active ? 'page' : undefined}
            aria-label={item.label}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              color: active ? 'var(--accent)' : 'var(--ink-3)',
              position: 'relative',
              // The press scale on `button` is wrong for a nav tab — the whole
              // bar appears to flinch. Colour and the indicator carry the state.
              transform: 'none',
              transition: 'color 0.2s ease',
            }}
          >
            <span style={{
              position: 'absolute', top: -10, left: '50%',
              width: 34, height: 3, borderRadius: 99,
              background: 'var(--grad)', boxShadow: '0 0 12px var(--accent-glow)',
              // Always rendered, only revealed — mounting it on selection made
              // the indicator pop into place instead of sliding up.
              transform: `translateX(-50%) scaleX(${active ? 1 : 0.3})`,
              opacity: active ? 1 : 0,
              transition: 'opacity 0.22s ease, transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)',
            }} />
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
              stroke="currentColor"
              // A hair heavier when selected. At 24px this reads as weight
              // rather than as a different icon, which is the point.
              strokeWidth={active ? 2.2 : 1.8}
              strokeLinecap="round" strokeLinejoin="round"
              style={{ transition: 'stroke-width 0.2s ease' }}>
              {ICONS[item.key]}
            </svg>
            {/* Fixed weight on purpose. This was 500 -> 700 on selection, and
                since bolder text is WIDER, every tab label physically shifted
                each time you navigated. Colour and the bar say "selected"
                without moving the layout. */}
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.01em' }}>
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

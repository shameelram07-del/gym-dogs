'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useMsal } from '@azure/msal-react';

const COACH_ID = '6d765ac9-47b2-4d3f-b36a-9d784015b917';

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { accounts } = useMsal();

  const isCoach = accounts[0]?.localAccountId === COACH_ID;

  const tabs = [
    { label: 'Home',      icon: '/images/icon_home.png',        href: '/dashboard' },
    { label: 'Train',     icon: '/images/icon_workout.png',     href: '/workout'   },
    { label: 'Progress',  icon: '/images/icon_progress2.png',   href: '/progress'  },
    { label: 'Community', icon: '/images/icon_community.png',   href: '/community' },
    ...(isCoach ? [{ label: 'Coach', icon: '/images/icon_focus.png', href: '/coach' }] : []),
    { label: 'Profile',   icon: '/images/icon_profile_nav.png', href: '/profile'   },
  ];

  return (
    <div style={{
      position: 'fixed',
      bottom: 0, left: 0, right: 0,
      background: '#0d0d14',
      borderTop: '1px solid rgba(255,255,255,0.07)',
      display: 'flex',
      zIndex: 100,
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      {tabs.map((item) => {
        const active = pathname === item.href;
        return (
          <button
            key={item.href}
            onClick={() => router.push(item.href)}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '10px 0 8px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <img
              src={item.icon}
              alt={item.label}
              style={{
                width: 24, height: 24,
                opacity: active ? 1 : 0.4,
                objectFit: 'contain',
              }}
              onError={(e) => { e.target.style.display = 'none'; }}
            />
            <span style={{
              fontSize: 10,
              fontWeight: active ? 700 : 400,
              color: active ? '#a78bfa' : '#6b7280',
            }}>
              {item.label}
            </span>
            {active && (
              <div style={{
                width: 4, height: 4,
                borderRadius: '50%',
                background: '#a78bfa',
              }} />
            )}
          </button>
        );
      })}
    </div>
  );
}
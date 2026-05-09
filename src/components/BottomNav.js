'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function BottomNav() {
  const pathname = usePathname();

  const tabs = [
    { icon: '🏠', label: 'Home', path: '/dashboard' },
    { icon: '📋', label: 'Log', path: '/workout' },
    { icon: '📈', label: 'Progress', path: '/progress' },
    { icon: '🏆', label: 'Community', path: '/community' },
    { icon: '⚙️', label: 'Profile', path: '/profile' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 bg-[#0E1624]/95 backdrop-blur border-t border-white/7 flex items-center justify-around px-2 py-2">
      {tabs.map((item) => {
        const active = pathname === item.path;
        return (
          <Link
            key={item.path}
            href={item.path}
            className="flex flex-col items-center gap-1 flex-1 py-1"
          >
            <span className={`text-xl ${active ? 'opacity-100' : 'opacity-40'}`}>{item.icon}</span>
            {active && <div className="w-1 h-1 rounded-full bg-blue-400 shadow-lg shadow-blue-400/50" />}
            <span className={`text-xs tracking-wider ${active ? 'text-blue-400' : 'text-slate-600'}`}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
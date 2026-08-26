'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMsal } from '@azure/msal-react';
import BottomNav from '@/components/BottomNav';
import Reveal from '@/components/Reveal';
import Avatar from '@/components/coach/Avatar';
import ClientList from '@/components/coach/ClientList';
import ChallengePanel from '@/components/coach/ChallengePanel';
import SessionBuilder from '@/components/coach/SessionBuilder';
import { useSessionBuilder } from '@/components/coach/useSessionBuilder';
import { captureError } from '@/lib/monitoring';

const CLIENTS_URL = 'https://gymdogs-api-g9d0gve4angygdcj.newzealandnorth-01.azurewebsites.net/api/clients';
const CLIENTS_KEY = process.env.NEXT_PUBLIC_API_KEY;

const TABS = [
  { key: 'clients', label: 'Clients' },
  { key: 'session', label: 'Session' },
  { key: 'challenges', label: 'Challenges' },
];

/**
 * Every tab stays mounted; only one is shown.
 *
 * This is the point of the wrapper. `{view === 'session' && <SessionBuilder/>}`
 * would unmount the builder the moment you glanced at Challenges, silently
 * destroying a session you had not published yet — and the old single-component
 * screen preserved that work by accident, so a split done carelessly would have
 * been a straight regression. Hiding rather than unmounting protects it
 * deliberately, and does the same for a half-filled challenge form.
 */
function Panel({ show, children }) {
  return (
    <div style={{ display: show ? 'flex' : 'none', flexDirection: 'column', gap: 16 }}>
      {children}
    </div>
  );
}

export default function CoachDashboard() {
  const router = useRouter();
  const { accounts, inProgress } = useMsal();
  const [userId, setUserId] = useState(null);
  const [view, setView] = useState('clients');
  const [clients, setClients] = useState([]);
  const [clientsLoading, setClientsLoading] = useState(true);

  useEffect(() => {
    if (inProgress !== 'none') return;
    if (accounts.length === 0) { router.push('/login'); return; }
    setUserId(accounts[0].localAccountId);
  }, [accounts, inProgress, router]);

  // Every signed-up user with live stats. Fetched here rather than inside
  // ClientList because the publish step needs the same list for "Goes out to".
  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const res = await fetch(CLIENTS_URL, { headers: { 'x-functions-key': CLIENTS_KEY || '' } });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) setClients(data);
        } else {
          captureError(new Error(`clients failed (${res.status})`), {
            screen: 'coach', action: 'load-clients', endpoint: 'clients', status: res.status,
          });
        }
      } catch (e) {
        // "No clients yet" and "the call failed" render identically.
        captureError(e, { screen: 'coach', action: 'load-clients', endpoint: 'clients' });
      } finally { setClientsLoading(false); }
    })();
  }, [userId]);

  // Held here, not inside SessionBuilder — see the note in the hook.
  const builder = useSessionBuilder({ userId, clients });

  if (!userId) return null;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)', paddingBottom: 100 }}>

      <div style={{ padding: '52px 20px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-2)' }}>Coach view</p>
          <h1 className="gd-disp" style={{ margin: '2px 0 0', fontSize: 28, fontWeight: 700 }}>
            Coach <span className="gd-grad-text">HQ</span>
          </h1>
        </div>
        <Avatar initials="SC" size={42} />
      </div>

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        <Reveal>
          <div style={{ display: 'flex', background: 'var(--soft)', borderRadius: 14, padding: 4, gap: 4 }}>
            {TABS.map((tab) => {
              const on = view === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setView(tab.key)}
                  aria-pressed={on}
                  style={{
                    flex: 1, padding: 10, borderRadius: 11, border: 'none', cursor: 'pointer',
                    fontSize: 13, fontWeight: 700,
                    background: on ? 'var(--card)' : 'transparent',
                    color: on ? 'var(--ink)' : 'var(--ink-3)',
                    boxShadow: on ? 'var(--e1)' : 'none',
                  }}
                >{tab.label}</button>
              );
            })}
          </div>
        </Reveal>

        <Panel show={view === 'clients'}>
          <ClientList clients={clients} loading={clientsLoading} />
        </Panel>

        <Panel show={view === 'session'}>
          <SessionBuilder b={builder} clients={clients} />
        </Panel>

        <Panel show={view === 'challenges'}>
          <ChallengePanel userId={userId} />
        </Panel>

      </div>

      <BottomNav />
    </div>
  );
}

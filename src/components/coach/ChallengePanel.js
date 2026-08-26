'use client';
import { useState, useEffect, useCallback } from 'react';
import { todayISO } from '@/lib/day';
import Reveal from '@/components/Reveal';
import { cardStyle, eyebrow, fieldLabel, hint, inputStyle, numberInput, R, T } from '@/lib/ui';
import { captureError } from '@/lib/monitoring';
import { useNumberDraft } from './useNumberDraft';

const COMMUNITY_URL = 'https://gymdogs-api-g9d0gve4angygdcj.newzealandnorth-01.azurewebsites.net/api/communityPosts';
const KEY = process.env.NEXT_PUBLIC_API_KEY;

// Same shortening the Community screen uses, so a figure quoted here reads the
// same way it does on the card the pack sees.
function fmtKg(kg) {
  const n = Math.round(Number(kg) || 0);
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;
}

/**
 * Challenges — start one, edit it, end it early, see the history.
 *
 * Lifted out of coach/page.js unchanged. This is deliberately a pure move: the
 * brief puts Challenges out of scope beyond the split, and the tab's behaviour
 * must not change. It takes eight state variables off the page with it.
 */
export default function ChallengePanel({ userId }) {
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null);
  const [past, setPast] = useState([]);
  const [suggestion, setSuggestion] = useState(null);
  // `form` being non-null is what opens the form — null means closed, an object
  // means starting or editing.
  const [form, setForm] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const { bind } = useNumberDraft();

  const fetchChallenges = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(`${COMMUNITY_URL}?challenges=true&userId=${encodeURIComponent(userId)}`, {
        headers: { 'x-functions-key': KEY || '' },
      });
      if (res.ok) {
        const d = await res.json();
        setActive(d.active || null);
        setPast(Array.isArray(d.past) ? d.past : []);
        setSuggestion(d.suggestion || null);
      } else {
        captureError(new Error(`challenges failed (${res.status})`), {
          screen: 'coach', action: 'load-challenges', endpoint: 'communityPosts', status: res.status,
        });
      }
    } catch (e) {
      captureError(e, { screen: 'coach', action: 'load-challenges', endpoint: 'communityPosts' });
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchChallenges(); }, [fetchChallenges]);

  const openStart = () => {
    // Defaults that are actually reachable: today, a month out, and roughly what
    // the pack really lifted over the last 30 days. The 100,000 kg club asked
    // for about three times that and nobody got close.
    const sug = suggestion || {};
    setEditingId(null);
    setMsg(null);
    setForm({
      name: '', prize: '',
      targetKg: sug.targetKg || 5000,
      startDate: sug.startDate || todayISO(),
      endDate: sug.endDate || todayISO(),
    });
  };

  const openEdit = (c) => {
    setEditingId(c.id);
    setMsg(null);
    setForm({
      name: c.name || '', prize: c.prize || '', targetKg: c.targetKg || 0,
      startDate: c.startDate || todayISO(), endDate: c.endDate || todayISO(),
    });
  };

  const save = async () => {
    if (!form || saving) return;
    if (!form.name.trim()) { setMsg({ type: 'error', text: 'Give the challenge a name.' }); return; }
    setSaving(true); setMsg(null);
    try {
      const payload = editingId
        ? { action: 'updateChallenge', userId, challengeId: editingId, ...form }
        : { action: 'startChallenge', userId, ...form };
      const res = await fetch(COMMUNITY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-functions-key': KEY || '' },
        body: JSON.stringify(payload),
      });
      // The server is the one that refuses a second running challenge, so its
      // message is the useful one — show it rather than a generic failure.
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setMsg({ type: 'error', text: data.error || `Could not save (${res.status}).` }); return; }
      setForm(null); setEditingId(null);
      setMsg({ type: 'success', text: editingId ? 'Challenge updated.' : 'Challenge started — announced on the feed.' });
      fetchChallenges();
    } catch (e) {
      setMsg({ type: 'error', text: 'Could not reach the server. Try again.' });
      captureError(e, { screen: 'coach', action: 'save-challenge', endpoint: 'communityPosts' });
    } finally { setSaving(false); }
  };

  const endNow = async (c) => {
    if (!window.confirm(`End "${c.name}" now? The standings freeze and the result goes on the feed.`)) return;
    setSaving(true); setMsg(null);
    try {
      const res = await fetch(COMMUNITY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-functions-key': KEY || '' },
        body: JSON.stringify({ action: 'endChallenge', userId, challengeId: c.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setMsg({ type: 'error', text: data.error || `Could not end it (${res.status}).` }); return; }
      setForm(null);
      setMsg({ type: 'success', text: 'Challenge ended and the result posted.' });
      fetchChallenges();
    } catch (e) {
      setMsg({ type: 'error', text: 'Could not reach the server. Try again.' });
      captureError(e, { screen: 'coach', action: 'end-challenge', endpoint: 'communityPosts' });
    } finally { setSaving(false); }
  };

  return (
    <>
      {msg && (
        <div style={{
          borderRadius: R.control, padding: '12px 16px', textAlign: 'center', fontSize: 13, fontWeight: 700,
          background: msg.type === 'success' ? 'var(--accent-tint)' : 'var(--red-tint)',
          color: msg.type === 'success' ? 'var(--accent-strong)' : 'var(--red-ink)',
        }}>{msg.text}</div>
      )}

      {loading && (
        <p style={{ fontSize: T.sm, color: 'var(--ink-3)', textAlign: 'center', padding: '10px 0', margin: 0 }}>Loading challenges…</p>
      )}

      {/* ── the one that is running ── */}
      {!loading && active && !form && (
        <Reveal>
          <div style={{ ...cardStyle, borderColor: 'var(--gold-tint)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
              <p style={{ ...eyebrow, color: 'var(--gold)' }}>Running now</p>
              <span style={{
                flexShrink: 0, fontSize: T.xs, fontWeight: 700, background: 'var(--gold-tint)',
                color: 'var(--gold)', borderRadius: 999, padding: '3px 10px',
              }}>ends {active.endDate}</span>
            </div>
            <p className="gd-disp" style={{ margin: '6px 0 2px', fontSize: T.xl, fontWeight: 700 }}>{active.name}</p>
            <p className="gd-num" style={{ margin: 0, fontSize: T.sm, color: 'var(--ink-2)' }}>
              {Number(active.targetKg).toLocaleString()} kg target &middot; {active.prize || 'no prize set'} &middot; {(active.joinedBy || []).length} joined
            </p>

            {(active.standings || []).length > 0 ? (
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ ...eyebrow, fontSize: T.xxs }}>Standings</p>
                {active.standings.slice(0, 5).map((row, i) => (
                  <div key={row.userId || i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="gd-disp" style={{ width: 18, fontSize: 13, fontWeight: 700, color: i === 0 ? 'var(--gold)' : 'var(--ink-3)' }}>{i + 1}</span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, color: 'var(--ink-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.name}</span>
                    <span className="gd-num" style={{ flexShrink: 0, fontSize: 13, fontWeight: 700, color: 'var(--ink-2)' }}>{row.kg.toLocaleString()} kg</span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ ...hint, marginTop: 12 }}>Nobody has joined yet. It shows on Community with a join button.</p>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={() => openEdit(active)} disabled={saving} style={{
                flex: 1, padding: 13, background: 'var(--soft)', border: 'none', borderRadius: R.control,
                color: 'var(--ink-2)', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.5 : 1,
              }}>Edit</button>
              <button onClick={() => endNow(active)} disabled={saving} style={{
                flex: 1, padding: 13, background: 'var(--red-tint)', border: 'none', borderRadius: R.control,
                color: 'var(--red-ink)', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.5 : 1,
              }}>End now</button>
            </div>
          </div>
        </Reveal>
      )}

      {/* ── nothing running ── */}
      {!loading && !active && !form && (
        <Reveal>
          <div style={{ ...cardStyle, textAlign: 'center' }}>
            <p className="gd-disp" style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700 }}>No challenge running</p>
            <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>
              Community shows nothing where the card was. Start one and it goes up with an announcement on the feed.
            </p>
            <button onClick={openStart} className="gd-disp gd-shine" style={{
              width: '100%', padding: 15, background: 'var(--grad)', border: 'none', borderRadius: R.control,
              color: 'var(--on-accent)', fontSize: T.md, fontWeight: 700, cursor: 'pointer', boxShadow: 'var(--glow-grad)',
            }}>Start a challenge</button>
          </div>
        </Reveal>
      )}

      {/* ── start / edit form ── */}
      {form && (
        <Reveal>
          <div style={{ ...cardStyle, padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={eyebrow}>{editingId ? 'Edit challenge' : 'New challenge'}</p>

            <div>
              <p style={fieldLabel}>Name</p>
              <input type="text" placeholder="e.g. September Grind" value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} style={inputStyle} />
            </div>

            <div>
              <p style={fieldLabel}>Prize</p>
              <input type="text" placeholder="e.g. Tub of creatine 🏆" value={form.prize}
                onChange={(e) => setForm((f) => ({ ...f, prize: e.target.value }))} style={inputStyle} />
              <p style={hint}>Shown on the card and in the announcement. Just a label — nothing tracks it.</p>
            </div>

            <div>
              <p style={fieldLabel}>Target (kg)</p>
              <input
                {...bind({ label: 'Target kg', value: form.targetKg, min: 1, step: 500, onChange: (v) => setForm((f) => ({ ...f, targetKg: v })) })}
                style={numberInput}
              />
              {suggestion && (
                <p style={hint}>
                  The pack lifted <b style={{ color: 'var(--ink-2)' }}>{fmtKg(suggestion.packKg30d)} kg</b> in the last 30 days,
                  so {suggestion.targetKg.toLocaleString()} kg is a target somebody can actually reach.
                </p>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <p style={fieldLabel}>Starts</p>
                <input type="date" value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <p style={fieldLabel}>Ends</p>
                <input type="date" value={form.endDate}
                  onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} style={inputStyle} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setForm(null); setEditingId(null); setMsg(null); }} disabled={saving} style={{
                flex: 1, padding: 15, background: 'var(--soft)', border: 'none', borderRadius: R.control,
                color: 'var(--ink-2)', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.5 : 1,
              }}>Cancel</button>
              <button onClick={save} disabled={saving} className="gd-disp gd-shine" style={{
                flex: 1.4, padding: 15, background: 'var(--grad)', border: 'none', borderRadius: R.control,
                color: 'var(--on-accent)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                opacity: saving ? 0.5 : 1, boxShadow: saving ? 'none' : 'var(--glow-grad)',
              }}>{saving ? 'Saving…' : editingId ? 'Save changes' : 'Start it'}</button>
            </div>
          </div>
        </Reveal>
      )}

      {/* ── history ── */}
      {!loading && past.length > 0 && (
        <>
          <p style={{ ...eyebrow, marginLeft: 4 }}>Past challenges</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {past.map((c) => (
              <div key={c.id} style={{ ...cardStyle, borderRadius: R.control, padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                  <p style={{ margin: 0, fontSize: T.md, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name || 'Untitled'}</p>
                  <span className="gd-num" style={{ flexShrink: 0, fontSize: T.xs, color: 'var(--ink-3)' }}>{c.startDate} → {c.endDate}</span>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: T.sm, color: 'var(--ink-2)', lineHeight: 1.5 }}>
                  {c.winnerName
                    ? <><b style={{ color: 'var(--gold)' }}>{c.winnerName}</b> won it — {Number(c.targetKg).toLocaleString()} kg target</>
                    : c.closestName
                      ? <>Nobody reached {Number(c.targetKg).toLocaleString()} kg · {c.closestName} closest on {fmtKg(c.closestKg)} kg</>
                      : <>Nobody logged against it · {Number(c.targetKg).toLocaleString()} kg target</>}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

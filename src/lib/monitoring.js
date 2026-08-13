// Error monitoring — the app's own evidence, kept instead of thrown away.
//
// Every function here is safe to call at any time. With no NEXT_PUBLIC_SENTRY_DSN
// set, nothing initialises, nothing goes over the network, nothing is logged, and
// every capture is a no-op — a clone of this repo without a Sentry account behaves
// exactly as it did before this file existed.
//
// Nothing in here may throw. A monitoring bug that breaks a screen is worse than
// the bug it was trying to report, so every entry point is wrapped.
//
// The SDK is loaded with a dynamic import() so it becomes its own chunk that is
// only fetched when a DSN is actually configured — the app runs on phones on gym
// wifi, and nobody should download ~90KB of error reporting that is switched off.
// The cost of that is a gap: the SDK's own global handlers aren't installed until
// the chunk lands, so this file installs its own listeners synchronously and
// replays anything they catch once it does.

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
// Set NEXT_PUBLIC_SENTRY_LOCAL=1 to test the wiring from `npm run dev`. Without
// it, localhost never initialises — otherwise every dev session floods the tier.
const ALLOW_LOCAL = process.env.NEXT_PUBLIC_SENTRY_LOCAL === '1';
// Set from ${{ github.sha }} in the deploy workflow. Absent locally, and that's fine.
const RELEASE = process.env.NEXT_PUBLIC_COMMIT_SHA;

// ── Privacy ───────────────────────────────────────────────────────────────
// His crew's names, emails, weights and food logs move through this app. None
// of it belongs in an error report. Two independent guards: context values are
// scrubbed on the way in (below), and the whole event is scrubbed again in
// beforeSend, so a future call site that gets it wrong still can't leak.

const PII_KEYS = ['email', 'name', 'weight', 'weighins', 'goalweight', 'nutritionlog'];
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

// Contexts Sentry fills in itself. They legitimately contain a `name` key
// (browser.name, os.name) and hold nothing personal, so the key-name scrub
// must skip them or every event loses its browser and OS.
const SENTRY_CONTEXTS = ['browser', 'os', 'device', 'runtime', 'culture', 'app', 'trace', 'cloud_resource', 'response'];

const isPiiKey = (k) => PII_KEYS.includes(String(k).toLowerCase());
const redact = (s) => (typeof s === 'string' ? s.replace(EMAIL_RE, '[email]') : s);

// Only scalars survive. Passing a whole profile or a whole request body can't
// leak anything because the object is dropped rather than serialised.
function safeValue(v) {
  if (typeof v === 'string') return redact(v).slice(0, 200);
  if (typeof v === 'number' || typeof v === 'boolean') return v;
  return undefined;
}

function safeContext(context) {
  const out = {};
  if (!context || typeof context !== 'object') return out;
  for (const [k, v] of Object.entries(context)) {
    if (isPiiKey(k)) continue;
    const val = safeValue(v);
    if (val !== undefined) out[k] = val;
  }
  return out;
}

// Recursive scrub for anything already attached to an event.
function scrub(node, depth = 0) {
  if (depth > 6 || !node || typeof node !== 'object') return;
  for (const key of Object.keys(node)) {
    if (isPiiKey(key)) { delete node[key]; continue; }
    const val = node[key];
    if (typeof val === 'string') node[key] = redact(val);
    else if (val && typeof val === 'object') scrub(val, depth + 1);
  }
}

// ── Noise the free tier shouldn't pay for ─────────────────────────────────
const IGNORE = [
  /ResizeObserver loop/i,                       // benign layout warning, not a bug
  /^AbortError/i,                               // fetch cancelled — usually navigating away
  /The (user )?aborted a request/i,
  /the operation was aborted/i,
  /Non-Error promise rejection captured/i,
  /Extension context invalidated/i,
];
const EXTENSION_RE = /(chrome|moz|safari|safari-web)-extension:\/\//i;

function isNoise(event) {
  const values = (event.exception && event.exception.values) || [];
  const text = [event.message, ...values.map((v) => `${v.type}: ${v.value}`)].filter(Boolean).join(' ');
  if (IGNORE.some((re) => re.test(text))) return true;
  // Anything thrown from inside a browser extension isn't ours to fix.
  return values.some((v) =>
    ((v.stacktrace && v.stacktrace.frames) || []).some((f) => EXTENSION_RE.test(f.filename || ''))
  );
}

// ── Duplicate suppression ─────────────────────────────────────────────────
// A crash inside a render or a poll fires on a loop. Same message + same top
// frame within a minute is one event, not sixty.
const DEDUPE_MS = 60000;
const recent = new Map();

function isDuplicate(event, now) {
  const v = ((event.exception && event.exception.values) || [])[0] || {};
  const frame = (((v.stacktrace && v.stacktrace.frames) || []).slice(-1)[0]) || {};
  const key = [event.message || '', v.type || '', v.value || '', frame.filename || '', frame.lineno || ''].join('|');
  const last = recent.get(key);
  if (last && now - last < DEDUPE_MS) return true;
  recent.set(key, now);
  // Bounded — this map lives for the life of the tab.
  if (recent.size > 200) {
    for (const [k, t] of recent) if (now - t > DEDUPE_MS) recent.delete(k);
  }
  return false;
}

// ── The one that matters ──────────────────────────────────────────────────
/**
 * Everything an event has to survive before it leaves the device: the noise
 * filter, the duplicate filter, and the privacy scrub. Returns null to drop it.
 *
 * Exported and pure (bar the dedupe clock) so it can be exercised directly —
 * "no email, name or weight in the payload" is the one thing here that must be
 * checkable rather than taken on trust.
 */
export function scrubEvent(event, now = Date.now()) {
  try {
    if (isNoise(event)) return null;
    if (isDuplicate(event, now)) return null;

    // Never more than an opaque id, whatever anyone set upstream.
    event.user = event.user && event.user.id ? { id: event.user.id } : undefined;

    scrub(event.extra);
    scrub(event.tags);
    if (event.contexts) {
      for (const key of Object.keys(event.contexts)) {
        if (!SENTRY_CONTEXTS.includes(key)) scrub(event.contexts[key]);
      }
    }
    if (event.message) event.message = redact(event.message);
    ((event.exception && event.exception.values) || []).forEach((v) => { v.value = redact(v.value); });
    (event.breadcrumbs || []).forEach((b) => {
      b.message = redact(b.message);
      scrub(b.data);
    });
    return event;
  } catch (e) {
    // A broken scrubber must not send an unscrubbed event.
    return null;
  }
}

// ── Init ──────────────────────────────────────────────────────────────────
let started = false;   // initMonitoring has run
let armed = false;     // a DSN exists and this environment reports
let Sentry = null;     // the SDK, once its chunk has landed

// Anything reported between init and the chunk arriving. Bounded — if the chunk
// never loads (offline, blocked), this must not grow for the life of the tab.
const QUEUE_MAX = 20;
let queue = [];
let pendingUser;       // undefined = never set; null = signed out

function enqueue(entry) {
  if (queue.length < QUEUE_MAX) queue.push(entry);
}

// Our own handlers, installed synchronously so the window before the SDK loads
// isn't a blind spot. Removed the moment Sentry's own take over.
function onEarlyError(ev) {
  // Resource load failures (a broken <img>) also fire 'error' and aren't ours.
  if (ev.target && ev.target !== window) return;
  const err = ev.error instanceof Error ? ev.error : (ev.message ? new Error(ev.message) : null);
  if (err) enqueue({ kind: 'error', err, context: { action: 'window-error', earlyBoot: true } });
}
function onEarlyRejection(ev) {
  const r = ev.reason;
  const err = r instanceof Error ? r : new Error(String(r && r.message ? r.message : r));
  enqueue({ kind: 'error', err, context: { action: 'unhandled-rejection', earlyBoot: true } });
}
function addEarlyHandlers() {
  window.addEventListener('error', onEarlyError, true);
  window.addEventListener('unhandledrejection', onEarlyRejection);
}
function removeEarlyHandlers() {
  window.removeEventListener('error', onEarlyError, true);
  window.removeEventListener('unhandledrejection', onEarlyRejection);
}

/**
 * Arms monitoring once. Safe to call from anywhere, any number of times.
 *
 * Returns true if events will be reported. The SDK itself loads asynchronously,
 * so a true return means "armed", not "already sending" — calls made in the
 * meantime are queued and replayed, so callers never need to care.
 */
export function initMonitoring() {
  if (started) return armed;
  started = true;
  try {
    if (!DSN || typeof window === 'undefined') return false;
    const host = window.location.hostname;
    const isLocal = host === 'localhost' || host === '127.0.0.1';
    // Dropped by never loading the SDK at all, so dev sessions make zero
    // network calls and don't even download the chunk.
    if (isLocal && !ALLOW_LOCAL) return false;

    armed = true;
    addEarlyHandlers();

    import('@sentry/browser')
      .then((sdk) => {
        sdk.init({
          dsn: DSN,
          environment: isLocal ? 'local' : 'production',
          sendDefaultPii: false,   // NON-NEGOTIABLE
          tracesSampleRate: 0,     // errors only — no performance monitoring
          ...(RELEASE ? { release: RELEASE } : {}),
          beforeSend: (event) => scrubEvent(event),
        });
        Sentry = sdk;
        // Its globalHandlers integration is live now, so stand ours down. An
        // error landing in both during this handover is caught by the 60s
        // duplicate filter in scrubEvent.
        removeEarlyHandlers();
        flush();
      })
      .catch(() => {
        // The chunk didn't load. Nothing is reportable, so let the queue go
        // rather than hold errors in memory forever.
        armed = false;
        queue = [];
        removeEarlyHandlers();
      });

    return true;
  } catch (e) {
    armed = false;
    return false;
  }
}

function flush() {
  try {
    if (pendingUser !== undefined) { identifyUser(pendingUser); pendingUser = undefined; }
    const pending = queue;
    queue = [];
    for (const entry of pending) {
      if (entry.kind === 'error') captureError(entry.err, entry.context);
      else breadcrumb(entry.message, entry.data);
    }
  } catch (e) { /* no-op */ }
}

// Every entry point self-initialises, so ordering between modules never matters.
function active() {
  if (!started) initMonitoring();
  return armed;
}

/**
 * Report a caught error.
 *
 * @param err     the caught value
 * @param context scalars only — { screen, action, endpoint, status, ... }.
 *                Field NAMES, never field values: `{ fields: 'weight,goalWeight' }`
 *                is fine, the numbers themselves are not.
 */
export function captureError(err, context) {
  try {
    if (!active()) return;
    if (!Sentry) { enqueue({ kind: 'error', err, context }); return; }
    const safe = safeContext(context);
    const { screen, action, endpoint, ...extra } = safe;
    Sentry.withScope((scope) => {
      if (screen) scope.setTag('screen', screen);
      if (action) scope.setTag('action', action);
      if (endpoint) scope.setTag('endpoint', endpoint);
      if (Object.keys(extra).length) scope.setExtras(extra);
      Sentry.captureException(err instanceof Error ? err : new Error(String(err)));
    });
  } catch (e) { /* monitoring must never break a screen */ }
}

/**
 * A trail marker for the next stack trace. The message is a fixed string —
 * never user data — and `data` goes through the same scalar-only scrub.
 */
export function breadcrumb(message, data) {
  try {
    if (!active()) return;
    if (!Sentry) { enqueue({ kind: 'crumb', message, data }); return; }
    Sentry.addBreadcrumb({ category: 'gymdogs', level: 'info', message, data: safeContext(data) });
  } catch (e) { /* no-op */ }
}

/** The signed-in user, as an opaque id and nothing else. */
export function identifyUser(userId) {
  try {
    if (!active()) return;
    // Not queued like the rest — only the latest value matters, and it must be
    // set before any queued error is replayed.
    if (!Sentry) { pendingUser = userId; return; }
    Sentry.setUser(userId ? { id: String(userId) } : null);
    Sentry.setTag('signedIn', !!userId);
  } catch (e) { /* no-op */ }
}

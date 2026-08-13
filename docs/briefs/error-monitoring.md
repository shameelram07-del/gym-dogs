# Brief: error monitoring — stop losing crashes

**Written:** 2026-08-13 in Cowork · **Status:** blocked on one manual step, then ready to build
**Hand to Claude Code with:** `implement docs/briefs/error-monitoring.md`

Two bugs found on 13 Aug had been live for weeks. Both were **caught and discarded** — the
dashboard's `loadDashboardData` threw a `TypeError` on every single load and the `catch` ate it, so
the screen just quietly did half its job. Five people use this app daily and the only detection
mechanism is someone mentioning it in the gym.

The point of this brief is **not** "install Sentry". It's that the app throws away its own
evidence. Installing the SDK is 20 lines; the work is the sweep.

---

## Shameel does this first

1. Sign up at sentry.io (free tier, 5k events/month — this app will use a handful).
2. Create a project, platform **Browser JavaScript** (not Next.js — see below).
3. Copy the **DSN**. It's safe in client code by design; it only allows writes.
4. Add it in two places, same pattern as `NEXT_PUBLIC_PROFILES_API_KEY`:
   - `.env.local` for local dev
   - a **GitHub Actions secret** called `NEXT_PUBLIC_SENTRY_DSN`, and reference it in the workflow

Without the DSN the app must behave exactly as it does today — see "If the DSN is missing" below.

---

## Use `@sentry/browser`, not `@sentry/nextjs`

This app is `output: 'export'` — a static bundle on Azure Static Web Apps. There is no Next.js
server, no server components doing runtime work, no API routes. `@sentry/nextjs` exists to
instrument the server half and drags in build plugins and middleware that have nothing to do here.
`@sentry/browser` is smaller and is the whole of what's needed.

Bundle size matters — this runs on phones on gym wifi. Keep the integration list minimal:
no session replay, no profiling, no tracing. Errors only.

---

## Init

A small client component (`src/components/ErrorMonitor.js`) rendered inside `MsalProvider.js`
alongside `EmailCapture`, so it's live app-wide.

```js
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: window.location.hostname === 'localhost' ? 'local' : 'production',
  sendDefaultPii: false,          // NON-NEGOTIABLE — see Privacy
  tracesSampleRate: 0,            // no performance monitoring
  release: <the git SHA if available at build, else omit>,
})
```

Set the user as **`{ id: userId }` only** — never name, never email.

---

## The actual work: the catch sweep

Go through every `catch` in `src/` and decide, one by one:

- **Swallows silently** (`catch {}`, `catch(e) {}`, `.catch(() => {})`) → add
  `Sentry.captureException(err)`. This is the whole point of the brief.
- **Already shows the user something** → still capture it, but add context: which endpoint, which
  screen, which action.
- **Genuinely expected** (a barcode not found, a user cancelling a file picker) → leave it, and add
  a one-line comment saying it's deliberate so the next sweep doesn't re-add it.

Known offenders from the 13 Aug audit — start here, don't stop here:

- `dashboard/page.js` — the outer catch around `loadDashboardData`, the one that hid the crash
- `workout/page.js` — `handleSave`, and the live auto-save `.catch`
- `nutrition/page.js` — `saveProfile`, and the coach-note call
- `lib/food.js` — `postAI` timeout and network branches
- `components/EmailCapture.js` — the profile POST
- `community/page.js`, `progress/page.js`, `onboarding/page.js` — the save paths

Add a breadcrumb where it's cheap and useful: which screen, which API call, whether the user was
signed in. Breadcrumbs are what make a stack trace answerable a week later.

---

## Privacy — this is real user data

His crew's names, emails, weights and food logs move through this app. None of it belongs in an
error report.

- `sendDefaultPii: false`, always.
- A `beforeSend` hook that strips `email`, `name`, `weight`, `weighIns`, `goalWeight` and
  `nutritionLog` from any attached context, and redacts anything that looks like an email address
  in an error message.
- Never attach a whole profile object or a whole request body as context. Attach the field names
  that mattered, not the values.
- Never put user data in the breadcrumb message.

---

## Don't burn the free tier

- `beforeSend` drops duplicates: same message + same stack within 60s → one event.
- Skip errors that aren't ours: browser extension noise, `ResizeObserver loop limit exceeded`,
  and network aborts the user caused by navigating away.
- `environment: 'local'` events should be **dropped entirely** unless a
  `NEXT_PUBLIC_SENTRY_LOCAL=1` flag is set — otherwise every `npm run dev` session floods it.

## If the DSN is missing

No DSN → `Sentry.init` never runs, no network calls, no console noise, and **every capture call is
a no-op**. Wrap it so a missing DSN can never throw. Someone cloning this repo without a Sentry
account must see identical behaviour to today.

---

## Out of scope

- No source-map upload yet. It needs an auth token in CI and it's a separate job — traces will be
  minified until then. Note it in `docs/status.md` as a follow-up.
- No session replay, no performance monitoring, no alerting rules (Shameel sets those in the
  Sentry UI).
- Nothing on the Azure Functions side. The API has its own logging; this brief is the frontend.

## Files

- `package.json` — add `@sentry/browser`
- `src/components/ErrorMonitor.js` — new
- `src/components/MsalProvider.js` — render it
- every screen and lib with a `catch` — the sweep
- `.env.local` and the GitHub Actions workflow — the DSN

## Done when

`npm run build` passes, then:

1. With **no DSN set**, the app behaves exactly as today — check the network tab for zero Sentry
   requests.
2. With the DSN set, `throw new Error('gym dogs test')` from a screen appears in Sentry within a
   minute, with breadcrumbs showing which screen.
3. Break the API key in `.env.local` → the failed fetch is captured, **and** the user still sees
   the friendly message rather than a crash.
4. Confirm in the Sentry event payload that **no email, name or weight appears anywhere.** Check
   this properly — it's the one failure that matters more than the feature.

Then stop for Shameel to test.

## Notes back to Cowork

Anything the brief got wrong, or a call you had to make.

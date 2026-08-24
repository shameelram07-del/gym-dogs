# Status

The handoff line between Cowork and Claude Code. **Newest entry at the top.**

- **Claude Code:** add an entry when you finish a brief — what shipped, what it touched, and
  crucially whether an **API redeploy** or a **new app setting** is still outstanding.
- **Cowork:** read this before writing the next brief, and before updating the tracker or a
  handover doc. Don't re-ask Shameel things that are answered here.

Keep entries short. Long explanations belong in the brief, not here.

---

## Waiting on Shameel — pick these up when he's ready

### Move the AI to Claude — **PAUSED, his call, revisit from Fri 14 Aug 2026**
The code is already written and deployed; the app is running normally on `gpt-4o-mini`. The only
missing piece is a working endpoint. **Do not retry the Microsoft Foundry path** — Azure will not
provision a partner model on his personal pay-as-you-go subscription, and that dead end cost two
hours already.

To finish it: buy US$5 of credit at console.anthropic.com, create a key, then

```
az functionapp config appsettings set -g gym-dogs-playground -n gymdogs-api \
  --settings CLAUDE_ENDPOINT=https://api.anthropic.com CLAUDE_KEY="sk-ant-..." -o none
```

`CLAUDE_MODEL=claude-opus-5`, `AI_PROVIDER=claude` and the NZ$20/month cap are already set. No
redeploy needed. If credits run out the API 401s and `foodAI` falls back to gpt-4o-mini, so nothing
breaks. `providerNote` in the response says which provider answered.

Still open on that job: the frontend doesn't send `userId` to `foodAI`, so the per-user daily cap
is inert. Small change in `src/lib/food.js` and its callers.

### NEXT UP — Gym Daddy on a timeline (Shameel's idea, 13 Aug, paused to 14 Aug)
Replace the change-triggered coach note with **four timed slots**: morning, midday, evening, and an
**11pm wrap** that closes the day out. One note per slot, so max four calls, naturally paced, and
the last one is a real summary instead of another running total. Supersedes the 6-call cap in
`docs/briefs/nutrition-coach-card.md`.

The catch he needs to decide on: this is a static web app with no push, so an 11pm note **only
appears if someone opens the app before midnight**. Making it land means emailing it from a timer
function — same shape as `weighInReminder` — which is an API change and a zip redeploy.
**Undecided: client-side slots only, or slots plus the emailed wrap.** Ask him before building.

### Other open items
- **Test runner.** `CLAUDE.md` claimed `src/lib/nutrition.js` was unit-tested; it isn't — no jest,
  no vitest, no test script anywhere in the repo. The pure functions take the clock as an argument
  specifically so they can be tested. Adding a framework is a real dependency decision, not
  something to slip into a UI brief.
- **Bad dates already in Cosmos.** The `TODAY` fix stops new logs landing on the wrong day, but
  workouts already saved with yesterday's date stay wrong. Needs a count and a one-off cleanup.
- ~~**No error monitoring.**~~ Done 14 Aug — see the entry below. **Needs the DSN from Shameel
  before it does anything**, and source-map upload is still outstanding.
- **Sweep item 4** — UTC date-string parsing in profile/progress/dashboard. Correct at UTC+12,
  wrong anywhere else. Deliberately skipped.
- **Progress tab goals** — blocked on Shameel deciding what the goal tracks.
- **SendGrid free trial ends 12 Sep 2026** — move to the free plan before then.

---

## Format

```
### YYYY-MM-DD — <what>
Built by: Claude Code | Cowork
Shipped: <one or two lines>
Touched: <files>
Still needed: <frontend push / API zip redeploy / app setting / nothing>
```

---

### 2026-08-14 — error monitoring + the catch sweep (error-monitoring.md)
Built by: Claude Code
Shipped: `@sentry/browser` (not `@sentry/nextjs` — no server half to instrument), wired through a
new `src/lib/monitoring.js`. **72 `catch` sites across 16 files were gone through one at a time**:
61 now report, 11 are documented as deliberate (localStorage in private mode, the per-frame barcode
decode, our own 45s AI timeout). New `src/components/ErrorMonitor.js` renders inside `MsalProvider`
and sets the user to `{ id }` only, plus a screen breadcrumb per route.

The SDK is loaded with a **dynamic `import()`**, so it becomes its own chunk that is only fetched
when a DSN is actually configured — first-load JS on `/dashboard` is 920 KB vs 915 KB before this
brief, i.e. **+5 KB**, where a static import cost +83 KB. Because the SDK's own global handlers
aren't installed until that chunk lands, `monitoring.js` installs its own `error` /
`unhandledrejection` listeners synchronously and replays anything they catch once it does, then
stands them down. Calls made during that gap are queued (bounded at 20) rather than lost.

Privacy is enforced in `scrubEvent()`, which is exported and was verified directly against a
deliberately poisoned event: **no email, name, weight, goalWeight, weighIns or nutritionLog can
reach Sentry** — values are dropped, emails in messages redacted, `event.user` reduced to an id.
Only field *names* are ever attached (`fields: 'weighIns,weight'`). Quota control: same
message+stack within 60s is one event, extension noise and aborts dropped, and localhost doesn't
initialise at all unless `NEXT_PUBLIC_SENTRY_LOCAL=1`.

Also fixed while sweeping: `dashboard/page.js` referenced an out-of-scope `account` variable, so it
threw a `ReferenceError` on **every single load** and an inner catch ate it. That block is now
removed — `EmailCapture` has done the job app-wide since 13 Aug. `MsalProvider` had no `.catch()`
on `msalInstance.initialize()`; if it ever fails the whole app is a blank screen, so that now
reports.

Touched: `package.json`, `src/lib/monitoring.js` (new), `src/components/ErrorMonitor.js` (new),
`MsalProvider`, `EmailCapture`, `AddFoodSheet`, `BarcodeScanner`, `EditItemSheet`, `ThemeToggle`,
`lib/food.js`, and the dashboard, workout, nutrition, community, progress, coach, profile,
onboarding and history screens. Workflow gains `NEXT_PUBLIC_SENTRY_DSN` + `NEXT_PUBLIC_COMMIT_SHA`.

Still needed: **frontend push**, and two things only Shameel can do — (1) create the sentry.io
project (platform **Browser JavaScript**), put the DSN in `.env.local` and add it as the GitHub
Actions secret `NEXT_PUBLIC_SENTRY_DSN`; (2) set alert rules in the Sentry UI. No API redeploy, no
`FIELDS` change. Until the DSN exists the app behaves exactly as before — no init, no network
calls, every capture a no-op. **Untested in the browser — Shameel to run `npm run dev`.**

Follow-up for Cowork: **source-map upload is out of scope and not done**, so stack traces will be
minified until it's built. It needs a Sentry auth token in CI and is a separate job.

### 2026-08-13 — Coach Dog card on Nutrition (nutrition-coach-card.md)
Built by: Claude Code
Shipped: a live AI read of the day between the calorie ring and "Your daily burn", styled as the
dark AI panel with an `--ice` COACH DOG eyebrow. Two new pure functions in `lib/nutrition.js`:
`coachFallback` (the deterministic sentence) and `buildCoachPrompt` (~430 tokens, well under the
600 budget). Cost controls as specified: cached in `nutrition.coachNote`, regenerated only when
item count changes or kcal moves >150, 8s debounce, hard cap of 6 calls/day, zero calls on an empty
day or an unchanged reopen.
Touched: `src/app/nutrition/page.js`, `src/lib/nutrition.js`
Still needed: frontend push. **No API redeploy, no `FIELDS` change** — `coachNote` rides inside the
existing `nutrition` object, same trick as `components` in the meal-logging brief.
Watch: all four `profile.nutrition` writes now go through one `nutritionPayload()` helper. Building
that object inline anywhere would drop the cached note — and a dropped cache is a paid model call.

### 2026-08-13 — workout, profile, coach + radii sweep (ui-slate.md, phase 4 of 4) — **SLATE COMPLETE**
Built by: Claude Code
Shipped: workout gained the `Reveal` stagger and eyebrow labels — applied to the header, stats card
and exercise-list *container*, deliberately not per card (see brief notes). Profile got its stagger
and gradient stat numbers; coach got `var(--grad)`, `.gd-shine` on Publish, `.gd-shimbar` while the
AI generates, and 26px cards. Shameel extended scope to the 22px radii on dashboard and progress,
which pulled in their leftover violet-era hexes (`#C9C5FF`, `#D9D9E3`, `rgba(122,90,248,…)`,
`#140E24`) — all now `--on-dark`, `--on-dark-2`, `--on-dark-soft`, `--hero-btn`, `--hero-btn-ink`.
Touched: workout, profile, coach, dashboard, progress, `components/TargetsSetup.js`,
`components/QuoteCard.js`, `globals.css`
Still needed: frontend push. No API redeploy across all four phases.
**End state, verified by grep:** zero raw brand hex outside `globals.css`, zero card radii under
26px, zero `--mag` or magenta anywhere. All eleven screens carry `.gd-disp`, `Reveal` and eyebrow
labels; every screen except history carries `var(--grad)` directly (history gets it via `heatStyle`).

### 2026-08-13 — exercise, history, community, nutrition (ui-slate.md, phase 3 of 4)
Built by: Claude Code
Shipped: new `src/lib/heat.js` — one intensity ramp (`heatLevel`/`heatMax`/`heatStyle`) now shared by
the progress heatmap and the history calendar, which previously disagreed about what a trained day
looks like. History's flat dot is gone; days are shaded by volume with a Less→More legend.
Exercise: 26px cards, display heading, ice/ember/quiet chip vocabulary, `Reveal`. Community: the
`.gd-disp` gap closed, avatars and podium on `var(--grad)`, medals moved to new `--silver`,
`--bronze`, `--gold-deep`, `--gold-soft`, `--on-gold` tokens. Nutrition: `Reveal` on every card,
the calorie ring now runs the `--grad` stops, and an estimate shimmer bar while the AI is thinking.
Touched: `lib/heat.js` (new), `globals.css`, exercise, history, community, nutrition, progress,
`components/AddFoodSheet.js`
Still needed: frontend push. No API redeploy. **Phase 4 not started.**
Deviation: macro bars kept their three distinct hues rather than all becoming `var(--grad)` — the
P/C/F letters in `MacroLine` are colour-matched to them, and one gradient for all three breaks that.

### 2026-08-13 — login + onboarding (ui-slate.md, phase 2 of 4)
Built by: Claude Code
Shipped: login is off the old green/teal brand entirely — the logo tile now runs the same
ice→steel→deep-steel as `--grad` (SVG stops read CSS vars), the paw uses `--logo-ink`, the glows are
slate, the wordmark is `.gd-disp .gd-grad-text`, and the hand-rolled `gd-rise-1..4` `<style>` block
is gone in favour of `Reveal`. Onboarding gained `.gd-disp` headings, gradient headline tail,
`var(--grad)` on both progress bars and the Next button, `.gd-shimbar` on "Building your plan…",
26px cards and a per-step `Reveal` stagger. No raw hex left on either screen.
Touched: `login/page.js`, `onboarding/page.js`, `components/Reveal.js`, `globals.css`
Still needed: frontend push. No API redeploy. **Phases 3-4 not started.**
Note: `Reveal` now takes an optional `style` prop — it renders a real div, and wrapping a flex child
without passing width/flex down collapses the layout. Additive; existing callers unaffected.

### 2026-08-13 — SLATE palette (ui-slate.md, phase 1 of 4)
Built by: Claude Code
Shipped: dark token block replaced with SLATE; shared gradient now ice → steel → deep steel.
`--mag` renamed to `--steel` with no alias (4 call sites). All six raw magenta orphans gone — the
dashboard hero mesh, heatmap ramp and trophy coins became tokens (`--hero-mesh`, `--heat-1/2`,
`--coin-*`) rather than being re-inlined. Aurora orbs retuned to ice/deep-steel, still frozen.
`gdbounce` moved out of exercise's inline `<style>` into `globals.css` as `gdBounce`; login's logo
float capped at 3 iterations. Reduced-motion is now a blanket reset — the old targeted rules could
never reach the inline `animation` styles the pages actually use.
Touched: `globals.css`, dashboard, profile, progress, workout, exercise, login, `CLAUDE.md`
Still needed: frontend push. No API redeploy. **Phases 2-4 not started.**
Watch: **light mode**. The dark gradient starts at ice `#8DE9F8`, unreadable as text on white, so
`--grad` now has a `[data-theme="light"]` override. Both need changing together from here on.

### 2026-08-13 — whole-meal logging + Estimate ignoring the photo
Built by: Claude Code
Shipped: brief `docs/briefs/meal-logging.md`, both parts. (1) Estimate now sends the attached photo
via `aiFromPhoto(photo, typedText)` instead of dropping it; the button enables on a photo alone and
relabels to "Estimate photo"; the preview has a × and clears after any commit; picking a photo no
longer auto-fires an estimate. (2) A 2+ item result offers **Log as one meal** — one entry with
summed macros, an editable pre-filled name, and the breakdown kept in `components` inside the
existing `nutritionLog` JSON. "Add as N separate items" remains as a secondary link. The day list
shows component names under a meal; `EditItemSheet` gains a "Tell me what to change" box that
recomposes the meal through the existing `aiFromText` mode.
Touched: `lib/food.js` (new pure `sumItems`, `mealNameFrom`, `describeMealCorrection`),
`components/AddFoodSheet.js`, `components/EditItemSheet.js`, `app/nutrition/page.js`
Still needed: frontend push. **No API redeploy, no `FIELDS` change** — `components` rides inside
the existing `nutrition`/`nutritionLog` JSON. **Untested — Shameel to run `npm run dev`.**

### 2026-08-13 — date, res.ok and silent-save sweep
Built by: Claude Code
Shipped: (1) `workout/page.js` module-scope `const TODAY` removed — now `useState(todayISO())` with
an `onDayChange` subscription. This was writing sets and `lastWorkoutDate` to **yesterday's date**
for any session logged before noon NZ. (2) `lib/food.js` — `res.ok` now checked before parsing.
(3) Ten save sites across seven files no longer report success on a failed write.
Touched: workout, progress, nutrition, onboarding, community, dashboard, EmailCapture, lib/food.js
Still needed: frontend push. No API redeploy. **Untested — Shameel to run `npm run dev`.**

### 2026-08-13 — dashboard load silently dying half way
Built by: Claude Code
Shipped: `const todayISO` local was shadowing the imported `todayISO()`, throwing inside
`loadDashboardData` and getting swallowed by the catch — so "done today", the email save, the
onboarding nudge and the coach note never ran. Renamed to `todayStr`. Added a `getJson` helper and
routed the four unguarded `.json()` calls through it.
Touched: `src/app/dashboard/page.js`
Still needed: frontend push. No API redeploy.

### 2026-08-13 — repo set up for the Cowork ↔ Claude Code loop
Built by: Cowork
Shipped: `CLAUDE.md` with the stack rules, the two-deploy split, Azure account gotcha and the traps
that have already caused real bugs. Added `docs/briefs/` with a template, this file, and both
approved mockups under `docs/design/`.
Touched: `CLAUDE.md`, `docs/briefs/_TEMPLATE.md`, `docs/status.md`, `docs/design/*.html`
Still needed: frontend push (docs only, nothing user-facing)

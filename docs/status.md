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

### Gym Daddy on a timeline — **BUILT 25 Aug, waiting on the API redeploy**
Slots plus the emailed wrap, both built (see the entry below). The frontend half is inert until the
API half ships: `dayWrap` has to be zipped and deployed, and `wrapEmail` has to reach the `FIELDS`
allowlist. **Nothing here is live until Shameel runs the zip deploy.**

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

### 2026-08-25 — challenges the coach actually runs (coach-challenges.md)
Built by: Claude Code
Shipped: challenges have a lifecycle. A challenge is now a normal doc with its own id and a
`status`, not one hardcoded singleton auto-created in code and never ended — which is why the
100,000 kg club sat at "0 days left" against a target roughly 3× what the pack lifts in a month.
New **Challenges** tab in Coach HQ: start (name, prize, target, dates), edit, end early, live
standings, and a list of past ones. The suggested target is the pack's real 30-day volume, rounded,
and the screen says what it is based on. At most one runs at a time, refused server-side with a
message. A challenge whose end date has passed is closed **on read**, freezing final standings and
recording the winner or who got closest. Community shows a finished challenge with final standings
and no countdown/progress bar/join button, keeps it for 7 days, then shows nothing at all rather
than an empty shell. Coach-only is enforced server-side, not just by hiding the tab.
Also fixed the three **UTC date bugs** in `communityPosts` via a new `gymdogs-api-v2/lib/day.js`.
The one that bit: `today <= endDate` decides whether someone can still win, and as a UTC date it
flipped at midday NZ — so on the final day the window shut half a day early and a target beaten in
the afternoon would not have been credited.
**`gymdogs-api-v2` is now a git repo** — it was production source with no undo. A patch script
truncated `communityPosts/index.js` to 0 bytes during this build; recovered and independently
verified byte-identical against the deploy zip by Cowork. Baseline is the as-deployed code.
Touched: `gymdogs-api-v2/communityPosts/index.js`, `gymdogs-api-v2/lib/day.js` (new),
`gymdogs-api-v2/.gitignore` (new), `src/app/coach/page.js`, `src/app/community/page.js`,
`scripts/migrate-challenge-doc.js` (new)
Still needed: **API zip redeploy** (13 function folders, preflight clean) — nothing works until
then. After deploying, run `node scripts/migrate-challenge-doc.js` (dry run) then `--apply` to give
the 100,000 kg club its status and standings. Not run yet. **Untested end to end — needs the
deploy.** Frontend push also needed.

---

### 2026-08-25 — retired sessions were showing up as saved drafts
Built by: Claude Code
Shipped: `workoutPlans` listed drafts as "isActive = false and not archived", but publishing a plan
deactivates the one it supersedes — so all twelve retired sessions back to 13 July came back as
drafts. The POST handler now writes `published: true` whenever a plan goes live and never unsets it
(it survives deactivation and a client that omits it); the drafts query excludes published plans.
Also fixed `createdAt` being restamped on every upsert, which reset a draft's age each time it was
edited — it is now written only for a genuinely new doc, with `updatedAt` for the rest.
Added `scripts/mark-published-plans.js` to backfill docs written before the flag existed. **Nothing
inside the `plans` container separates a draft from a retired session** — all twelve carried an
identical field set. The script reads the two traces the publish path leaves elsewhere instead: the
`posts` announcement ("New session published: …") and `Workouts` rows carrying `planId`. Dry run
against production: 12 of 12 matched (all 12 announced, 8 also logged), **zero genuine drafts**.
`--before=YYYY-MM-DD` is there as a cutoff fallback if the traces are ever not trusted.
Touched: `gymdogs-api-v2/workoutPlans/index.js`, `scripts/mark-published-plans.js` (new)
Still needed: **API zip redeploy** (13 function folders, unchanged count) — until then the drafts
list stays full. Then run `node scripts/mark-published-plans.js` (dry run) and `--apply`. Not run
yet. Not pushed.

---

### 2026-08-25 — pick the muscle groups, then generate (ai-session-generator.md)
Built by: Claude Code
Shipped: the Coach screen now has a TARGET picker above the generate button — five day presets
(Push/Pull/Legs/Upper/Full body) that fill a multi-select row of the 8 muscle groups, which is the
source of truth. Generate is disabled until something is picked. The prompt sends only the chosen
groups' exercises with their equipment tags instead of the whole catalogue, so "back day" finally
means back day. A SESSION row adds minutes (drives the exercise count, ~10 min each, overridable
4–8) and people. With 2+ people the session comes back in lettered paired blocks where the two
exercises never need the same station — the model is asked to follow that rule and then **verified
in code**, with an illegal pairing silently repaired. A derived one-line run note ("6 people, 3
blocks — pair up and alternate…") shows under the draft and is merged into the plan's `notes` at
publish. Member side gets block letters and a "Superset A" header only — logging is untouched. The
offline template was rebuilt to follow the selection and to pair up too. Model stays on
`gpt-4o-mini` as the brief instructs; both output flaws it names are handled in code — `sets` is
coerced with `Number()` and `reps` validated (gpt-5 returns `"4"` as a string), extras are trimmed
and a **short** answer is topped up from the selected groups rather than publishing a session that
doesn't match what was asked for. Pairing is most-constrained-first, not front-to-back: the greedy
version wasted partners and left two people idle on a six-exercise pull day when a clean three-pair
answer existed.
Touched: `src/lib/session.js` (**new** — all the pure logic), `src/app/coach/page.js`,
`src/app/workout/page.js`
Still needed: nothing — pushed 25 Aug. No API change, nothing stored. The 25 Aug catalogue cleanup
in `src/lib/exercises.js` shipped alongside it.

---

### 2026-08-25 — Gym Daddy on a timeline (gym-daddy-timeline.md)
Built by: Claude Code
Shipped: the coach note is now gated by the time of day, not by change. Three in-app slots —
morning 05:00–11:00, midday 11:00–17:00, evening 17:00–23:59 — one note each, at most three model
calls a day, down from six. `COACH_KCAL_DELTA` and `COACH_MAX_CALLS` are gone; the 8s debounce
stays. Before 05:00 generates nothing. The cache moved from `nutrition.coachNote` to
`nutrition.coachNotes { date, slots }` and reads the old single-object shape as a spent slot, so
nobody pays for a fresh call on their first load. New `dayWrap` timer function emails the
end-of-day wrap at `0 0 10 * * *` (UTC — 22:00 NZST / 23:00 NZDT, deliberately not 11, which lands
at midnight in daylight saving and would describe the wrong day). It skips anyone with no email,
`wrapEmail === false`, or an empty day, falls back to a deterministic summary if the model call
fails, and heartbeats itself so `costTest` can see it ran.
Touched: `src/lib/nutrition.js`, `src/app/nutrition/page.js`, `CLAUDE.md`,
`gymdogs-api-v2/dayWrap/{index.js,function.json}` (new), `gymdogs-api-v2/userProfiles/index.js`
Still needed: **frontend push AND an API zip redeploy** — the zip must now contain **13** function
folders. Without the redeploy, `wrapEmail` is silently dropped and no wrap email is ever sent.
**Untested against real data — Shameel to run `npm run dev`.**

---

### 2026-08-24 — unknown macros stop being logged as zero
Built by: Claude Code
Shipped: an Open Food Facts product with calories but no macro breakdown used to log as a confident
`0g` protein/carbs/fat with nothing on screen to say so. A macro the database doesn't have is now
**null** end to end, and the app says which one is missing.

- `scaleToGrams` preserves null instead of `(x || 0) * f`; new `missingMacros()` derives the gap
  from the per-100g nulls, so it works **whether or not the API is redeployed**.
- Search rows say "No protein and fat on record". The portion editor shows those macros as empty
  editable inputs (**per 100g**, so they rescale with the portion); left blank they stay unknown.
- Day arithmetic still treats null as 0 — there's nothing else to add — but `summariseDay` now
  carries `unknown: ['protein', …]` on the row, the macro tiles show `+?`, and per-item lines show
  `?` rather than `0`.
- `buildCoachPrompt` sends `P?` and warns the model the total is a floor; `coachFallback` takes an
  optional 4th arg and says "at least Xg" instead of inventing a shortfall. Gym Daddy was the worst
  offender here — it read the fabricated zero as measured and told the user protein was low.
- Also fixed the same coercion where it would have undone the above: `EditItemSheet.save()` (blank
  macro → null, matching what `grams` already did) and `toCustomFood` (an unknown stayed unknown
  rather than being baked into one of your own foods as 0).

Verified: `npm run build` passes; 38 ad-hoc checks over the pure functions in `src/lib` (scratch
script, not committed — there's still no test runner here). **Untested in the browser.**

Touched: `src/lib/food.js`, `src/lib/nutrition.js`, `src/components/AddFoodSheet.js`,
`src/components/EditItemSheet.js`, `src/app/nutrition/page.js`

Still needed: frontend push, **plus an API zip redeploy** — `gymdogs-api-v2` is changed on disk and
not yet deployed. `foodLookup/index.js` now returns a `missing` array, and `foodAI` label mode
returned `0` for a macro it couldn't read, which is the same bug at the API layer; it now returns
null and its own `missing` array. **No `FIELDS` change** — the nulls ride inside the existing
`nutrition` object. The frontend degrades cleanly until that deploy happens.

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

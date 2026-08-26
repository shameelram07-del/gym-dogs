# Status

The handoff line between Cowork and Claude Code. **Newest entry at the top.**

- **Claude Code:** add an entry when you finish a brief — what shipped, what it touched, and
  crucially whether an **API redeploy** or a **new app setting** is still outstanding.
- **Cowork:** read this before writing the next brief, and before updating the tracker or a
  handover doc. Don't re-ask Shameel things that are answered here.

Keep entries short. Long explanations belong in the brief, not here.

---

### 2026-08-27 — app sweep: nine defects from the 26 Aug drive-through
Built by: Claude Code
Shipped: brief `docs/briefs/app-sweep-fixes.md`. **Eight of the nine fixed; item 14 was a mirage.**

**1. Gym Daddy was never generating sessions.** Root cause confirmed as briefed: `catalogueFor`
prints the catalogue as `Name [Equipment]`, the prompt says to copy names exactly, so the model
returned `"Plate-Loaded High Row [Plate Loaded]"` and `findExercise` matched nothing — every row
null, `parsed.length >= 3` false, template every time, AI title discarded. `findExercise` now
strips a trailing bracketed tag before the lookup, so every caller benefits. `findExercise`,
`parseAiReply` and `cleanTitle` **moved out of `useSessionBuilder.js` into `lib/session.js`**, which
is pure and was already the place for logic checkable without a browser. Only a trailing
`[square bracket]` is stripped — `Cable Curl (Straight Bar)` keeps its parentheses.
**2. The parse check** is `scripts/check-session-parse.mjs` — `npm run check:session`, 11 checks,
all passing. It feeds a captured 6-exercise reply through `parseAiReply` + `findExercise` and
asserts all six survive. It loads `lib/session.js` by reading the source and importing it as a
data: URL with the `@/lib/…` alias rewritten — there is no test runner and no `"type": "module"`,
so a plain import would be parsed as CommonJS and die on the first `export`. Nothing in the app
changed to make it runnable.
**3. Dashboard challenge card** now reads `data.challenge` from `communityPosts` (the same source
Community uses) and renders its name, prize and target. It does **not** render when nothing is
running, and an ENDED challenge — which that endpoint keeps handing back for a week — is filtered
out, so the teaser is only ever a live one. Costs the dashboard one extra GET on load.
**4. Progress "Weekly volume"** headline is now `chartedVolume`, the sum of the four bars beneath
it, not the all-time figure. All-time still sits in the "kg lifted" stat where it belongs. Added a
local `fmtKg()` so the headline, the bar labels and `calcTotalVolume` all write kg the same way.
**5. PR count — kept 22, the Profile definition.** Not two definitions: both screens already
counted distinct exercises you have moved weight on. Progress was printing `prs.length` on a list
it had already cut to `.slice(0, 5)` for display, so its stat was really "rows that fit in the
card". One PR per exercise is now in **new `lib/prs.js`** (`personalBests`, `prCount`), used by both
screens; it also matches Profile's "First PR" / "5 PRs set" badges, and it grows as you train.
Progress still lists only the heaviest five.
**6. "3.6kkg"** — `volStr` in `workout/page.js` now carries its own unit (`3.6k kg` / `850 kg`) and
both the PR and non-PR post branches stopped appending `kg`.
**7. "1 exercises"** — new `exCountLabel()` in `useSessionBuilder.js`. Old posts left alone.
**8. Service accounts out of the coach client list.** They are not accounts: the API's
`lib/heartbeat.js` stamps a doc into the `users` container per timer function so a dead timer can be
noticed, and `clients/index.js` selects `c.name` with no type filter, so `costReport`, `dayWrap`,
`weighInReminder` and `keepWarm` arrived looking like four members who had never trained. **Used
the flag that already exists** — those docs carry `type: "heartbeat"` and a userId of
`heartbeat_<function>`; `type` is not selected so it never reaches the browser, but the userId does,
so `isRealMember` filters on the `heartbeat_` prefix. Filtered in `coach/page.js` where the list is
fetched, so `ClientList`'s counts, the publish "Goes out to" and `audienceLabel` all see the same
list. No new field, no API change needed.
**9. Nutrition slot catch-up.** Partly a mirage: the effect *did* already schedule the current
slot's note on open. What it also did was show the earlier slot's note for the 8-second debounce
first — which is exactly the "at 258 kcal" against a header reading 882 that was reported. Now,
when the cached note belongs to an earlier slot than the current one, the stale text is cleared (the
card drops to the deterministic read off live numbers) and the catch-up fires immediately instead of
after 8s. Still one call per slot; the empty-day reset and the pre-05:00 no-slot rule untouched.
Added a `coachInFlight` ref, because the slot is only marked spent when the call returns and a call
can be in the air 20s — without it a 0 ms catch-up plus one more logged item could spend the slot's
one call twice.
**Follow-up, same day:** the generator named every session **"Iron Harvest"** — it was copying the
example. The prompt used that name twice, once as an example and once as the literal value in the
JSON shape line, and the shape line was the stronger pull. Both example titles are gone: the shape
line now reads `{"title":"..."}` and the flavour is described rather than demonstrated (concrete and
physical — metal, weather, work, animals), with an explicit "invent a fresh one for THIS session"
and "do not name the muscle groups back". Left a comment above those lines saying not to put an
example back. If the model ever echoes the `...` placeholder, `cleanTitle` reduces it to empty and
`suggestName(groups)` takes over, so the worst case is the old target-derived name, not a literal
"...". **Needs a live re-test: two Generates should produce two different titles.**

**Second follow-up:** titles then varied but converged — three Pull generations gave "Iron Grip
Session", "Iron Grip Challenge", "Iron Grip Session". Three changes, no extra AI call. (a) Banned
the padding words: the title must not contain Session, Day, Workout, Training or Challenge. (b) It
now names the session after **the exercises it just chose**, not the muscle groups — the groups are
identical on every Pull session, the exercises are not. (c) **The JSON shape now puts `exercises`
first and `title` last.** Without that, (b) was nominal: a reply is written start to finish, so a
title in the first field is picked before a single exercise exists. `parseAiReply` reads both by
key, so the order is free — two new checks in `check:session` cover it (13 checks now).
Also removed the "metal, weather, work, animals" vocabulary list from the flavour line: it was
feeding the convergence, since "metal" plus "back and biceps" is iron and grip every time. The
no-examples comment stands and now covers vocabulary banks too.

**Third follow-up:** "name it after the exercises" then swung the other way — "High Row Hammer
Curl", "High Row Hammer Action", "Rage Against The Machine". The first two are exercise names joined
together. Added: the title must not be built out of the exercise names — do not copy one in, do not
join two — and reframed the line so both halves are explicit: **the lifts are the input, the feeling
is what gets named.** Variety kept, nothing rolled back. The comment above these lines now records
both failure modes (converging on the groups' vocabulary / listing the exercises) with a note not to
delete either half. **Three prompt iterations in one day and no test can catch this one** — the only
check is a few live Generates, so re-read that comment before touching those lines again.

**10. "avg readiness"** label now reads `readiness · 1 of 15` whenever only some of the pack has
reported, and stays `avg readiness` when everyone has.

**Item 14 was a mirage — no change made.** `workout/page.js:792` reads
`Superset {ex.block} &mdash; alternate with your partner`, with the space present in the source.
Compiled that exact line through Next's own SWC: the children come out as
`["Superset ", b, " — alternate with your partner"]`, both spaces intact, so the DOM says
`Superset A — alternate with your partner`. The reported "Superset A—" is an extraction artefact
of joining adjacent text runs, the same class as the three items already dropped from the brief.

Touched: `lib/session.js`, **new** `lib/prs.js`, **new** `scripts/check-session-parse.mjs`,
`components/coach/useSessionBuilder.js`, `components/coach/ClientList.js`, `app/coach/page.js`,
`app/dashboard/page.js`, `app/progress/page.js`, `app/profile/page.js`, `app/workout/page.js`,
`app/nutrition/page.js`, `package.json` (`check:session`)
Still needed: **nothing.** Frontend pushed; `npm run build` passes; lint error count unchanged from
before these edits (28 pre-existing). **No `FIELDS` change. No API redeploy outstanding — see below.**

**The API half is DONE AND LIVE** (deployed the morning of the 27th by Cowork, 13 functions
verified). Both follow-ups this brief raised are closed at source, so do not carry them forward:
1. `clients/index.js` filters the heartbeat docs itself now, and also went through `lib/day.js` for
   today, week start, streak and days-since — it had been computing all four off
   `toISOString()`, which is trap 1 and made it wrong from NZ midnight until noon.
2. `communityPosts/index.js` filters them in **all four** `users` queries, so Community reports
   **15 members**, matching Coach HQ, and "trained today" reads **0/15** correctly against sessions
   dated the 26th.
3. `lib/costCore.js:78` is **deliberately still UTC** — Azure bills in UTC and that query is
   explicitly `T00:00:00Z`. Not a bug; do not "fix" it.

The frontend `isRealMember` filter in `coach/page.js` is now belt-and-braces rather than the only
guard. Left in place: it costs nothing and holds if the API is ever rolled back.

**Verified live before the push:** the generator (status "Session ready", real exercises, Regenerate
gives a different six), titles across three runs (**Strength Unleashed / Power Surge / Grind Through
Grit** — varied, no filler words, not exercise names), Clients at 15, the Progress headline matching
its bars, PRs reading 23 on both Profile and Progress, and the dashboard challenge card naming the
live challenge.
**Not tested live:** the two feed strings (`3.6k kg`, "1 exercise") and the Eat slot catch-up — both
need a real workout finished / a day's food logged, so they are the two to watch first.

Out of scope and untouched, as briefed: publishing a session, posting to the community feed, and the
`--vio` violet on the readiness ring.

---

### 2026-08-26 — session title at the top, What's live is tappable
Built by: Claude Code
Shipped: brief `docs/briefs/session-title-and-live-link.md`, both parts. (1) The name field has
**moved out of `PublishCard` and to the top of the session card** — borderless, `gd-disp`, 20px,
placeholder "Name this session". There is exactly one name field on the screen; publish still
refuses a blank name. The `aiCoach` prompt now asks for `{"title":…,"exercises":[…]}` and a new
`parseAiReply` accepts either that or a bare array, so an old-shaped reply still generates. The
title is cleaned (quotes stripped, anything over 40 chars discarded) and only applied when
`nameTouched` is false — a typed name survives Regenerate. A template session (AI capped or failed)
still falls back to `suggestName(groups)`. (2) `LiveNow` is now a real `<button>` that pushes to
`/workout`, with `gd-card gd-press`; added a `.gd-card.gd-press:active` rule to `globals.css`
because the hover lift outranked `button:active` and the card had no pressed state.
Touched: `components/coach/SessionBuilder.js`, `PublishCard.js`, `LiveNow.js`,
`useSessionBuilder.js`, `app/globals.css`
Still needed: frontend push. **No API redeploy, no `FIELDS` change** — the title is the existing
`plan.name` and the prompt is client-side text. **Untested — Shameel to run `npm run dev`.**

### 2026-08-26 — Coach HQ session builder rebuilt
Built by: Claude Code
Shipped: brief `docs/briefs/coach-hq-rebuild.md`, all of it. `coach/page.js` goes **1217 -> 137
lines** — a tab shell. New `src/components/coach/`: `useSessionBuilder` (all builder state),
`SessionBuilder`, `TargetCard`, `ExerciseRow`, `SwapSheet`, `PublishCard`, `DraftList`, `LiveNow`,
`ClientList`, `ChallengePanel`, `Avatar`, `useNumberDraft`.
The order is now brief -> session -> publish, and **progressive disclosure is what makes it short**:
before you generate, the session and publish sections do not render at all. After generating, the
brief collapses to `Pull · Hypertrophy · 60 min · 2 people`. No step numbers, no locking.
Exercises are **one line each** — number, name, sets x reps, block letter — expanding in place.
Per-row muscle-group and equipment controls are gone; **Swap** replaces them and is aware of blocks,
which they never were: it offers the same muscle group and marks anything sharing a station with the
row's block partner as unavailable, naming the partner. Style loses FULL BODY (a shape, not a style,
and already a day preset). Regenerate warns only when there are hand edits, naming them. Publish
confirms and states the audience and the feed post; Save draft / Publish stay side by side.
Touched also: `Reveal.js` — see the note below.
Deployed: pushed as `e7b3ca3`. No API redeploy, no `FIELDS` change; the published plan document
keeps its exact shape. Build passes; lint 37 problems, **identical to baseline**.

Notes back to Cowork — three things:
1. **The brief's "lift the state OR keep it mounted" hides a trap.** I did both (state in `page.js`,
   panels hidden with `display:none` rather than unmounted, which also protects a half-filled
   challenge form). But an element in a `display:none` subtree has **no layout box, so it can never
   intersect** — and `Reveal` is driven by IntersectionObserver, so every Reveal in a hidden panel
   would have been sitting at `opacity: 0` waiting on an observer that may not fire. `Reveal` now
   reveals immediately when `getClientRects()` is empty. **Anything else that keeps panels mounted
   needs this.** **Verified on localhost before the push** — generated a Pull session, switched to
   Challenges, switched back: all six exercises and the collapsed brief still there, no blank tab.
   The guard holds; this is no longer a theoretical fix.
2. **Swap disables clashing exercises rather than hiding them**, with the reason ("same station as
   Barbell Row"). The brief said exclude. Showing why beats silently shortening the list — but it is
   a deviation, so overrule it if you meant hidden.
3. The `#gd-builder-form` anchor is now `#gd-session` and sits on the session card itself, rather
   than pointing an old name at a new place.

Tested: **Done-when 3 (the tab-switch regression) passes** — Shameel ran it on localhost before the
push. That was the one this whole split risked, and the only one verified so far. Items 1–2 and
4–12 are still unchecked: swap's block-partner filtering, regenerate's warn-on-edits, the publish
confirmation, and the name auto-fill rules.

---

### 2026-08-26 — app-wide design pass: one system instead of twelve copies
Built by: Claude Code
Shipped: not from a brief — Shameel asked for a UI/UX review across all screens. The palette was
never the problem; the **rhythm** was. The app was using **17 distinct corner radii** and **~25 font
sizes** (including 9.5, 10.5, 11.5, 12.5, 13.5, 14.5, 15.5), which is what read as unfinished.
New `src/lib/ui.js` holds the shared look: `eyebrow` had been declared character-for-character in
**twelve files** and `cardStyle` in four — those are now one definition each, imported. Also carries
`R`/`T`/`SP` scales, `chip`, `pill`, `inputStyle`, `btnPrimary/Quiet/Danger` and `banner`. Inline
style objects stay the house style; they just stop being re-typed.
`globals.css`: three-level elevation ramp, `--sheen` (a 1px lit top edge — most of what separates a
considered dark UI from a flat one), radius/type/spacing scales, `.gd-card` primitive, and
**tabular numerals on `.gd-disp`** so every hero number in the app stops shifting sideways as it
changes. `layout.js`: `themeColor` was still `#0A0714`, the **IGNITE violet** — the phone status bar
was painting the old palette above a slate app. Same class of leftover as the magenta.
`BottomNav`: labels went 500 -> 700 weight on selection, and bolder text is wider, so **every tab
label shifted on navigation**. Now fixed weight, with colour and a sliding indicator carrying the
state; also a real `<nav>` with `aria-current`. Hardcoded `#fff`/`#8B5CF6`/`#6EE7F9` replaced with
tokens across six files. `BarcodeScanner` keeps its literal black/white deliberately — it is a
camera viewport over live video, not a themed surface.
Touched: `lib/ui.js` (new), `globals.css`, `layout.js`, `BottomNav.js`, and the eyebrow/cardStyle
import swap in all 11 screens + AddFoodSheet, EditItemSheet, TargetsSetup.
Deployed: pushed as `a58b41a`. No API redeploy, no `FIELDS` change. `npm run build` passes; lint
is at 37 problems, **identical to the pre-change baseline**.
For Cowork: `docs/briefs/coach-hq-rebuild.md` should be built on `lib/ui.js` — `cardStyle`, `chip`,
`fieldLabel` and `banner` already exist, so the rebuild adds `ExerciseRow` rather than new styling.
The Coach **structural** rebuild is deliberately NOT in this diff; mixing a screen rewrite into an
app-wide styling pass would make both unreviewable.
**Untested — Shameel to run `npm run dev`.**

---

### 2026-08-26 — cost cap on aiCoach and dayWrap
Built by: Claude Code
Shipped: brief `docs/briefs/aicoach-cost-cap.md`. `lib/aiBudget` is now wired into **aiCoach** and
**dayWrap**, so every model call in the app is counted and gated. aiCoach checks the budget before
it builds the member snapshot (three Cosmos queries not worth paying for on a refused call) and
records the real `usage` token counts afterwards. A refusal returns **429** with
`{ capped: 'monthly' | 'daily', reply, providerNote }` — the body carries a friendly line in Gym
Daddy's voice, and the status is what makes every existing caller take its deterministic fallback
without changes. dayWrap gates per user inside `aiWrap()`; a refusal returns `''`, which already
means `deterministicWrap()`.
Frontend: the session generator on Coach now sends `userId` (it was posting none) and says
"AI is done for today, so this is a template draft" on a 429. Nutrition, dashboard and workout
notes treat a 429 as a quiet fallback and **no longer report it to monitoring** — a cap doing its
job is not an incident. `lib/food.js` now takes `userId` on `aiFromText` / `aiFromPhoto` /
`aiFromLabel`, threaded from `nutrition/page.js` through `AddFoodSheet` and `EditItemSheet`.
`aiBudget` buckets an unattributed call as **`_anon`** rather than letting it through uncounted, so
there is no longer an uncapped path.
Touched: API — `aiCoach/index.js`, `dayWrap/index.js`, `lib/aiBudget.js`. Frontend —
`app/coach/page.js`, `app/nutrition/page.js`, `app/dashboard/page.js`, `app/workout/page.js`,
`lib/food.js`, `components/AddFoodSheet.js`, `components/EditItemSheet.js`.
Deployed: **fully live, nothing outstanding.** Frontend pushed as `57acb76`. API zip built by Cowork
and deployed by Shameel via `config-zip` on **2026-08-25 21:48 UTC (09:48 NZ on the 26th)**, 13
functions verified after. `aiBudget` is gating and recording in `aiCoach` and `dayWrap` in
production. No `FIELDS` change — the spend doc is `aispend_<month>` in `users` with a matching
`userId`, so `userProfiles` never sees it.
Notes back to Cowork: the brief lists "Gym Daddy's chat on the Coach screen" as a caller — **there
is no chat UI in the app**. Nothing in `src/` matches `chat`, and Coach's only aiCoach call is the
session generator. The four real callers are the session generator, the nutrition slot note, the
dashboard note and the post-session note on workout — all ambient. The friendly refusal is
implemented and returned, but nothing currently displays it. Also: `foodAI`'s OpenAI fallback is
still deliberately uncapped (it records but does not gate) so the cap can only make food estimates
cheaper, never remove them — that predates this brief and was left alone.
**Untested — Shameel to run `npm run dev`.**

---

## Open bugs

### `dayWrap` has never fired — cause unknown
Deployed 24 Aug and carried by two `config-zip` deploys since; `wrapEmail` is in the `FIELDS`
allowlist. **The code is deployed and both previously stated blockers are gone — but this is NOT
verified.** `costTest` on 25 Aug at 22:01 UTC showed heartbeats for `keepWarm`, `costReport` and
`weighInReminder` and **none for `dayWrap`** — and that beat sits outside the try/catch, so it would
be there even if the send had failed. The timer is registered, `isDisabled` false, schedule
`0 0 10 * * *`, and the timer subsystem is alive (`keepWarm` beat two minutes earlier). Shameel has
received no wrap email. Cause unknown — this is live and open, not done.

### `costReport` 429s from the Cost Management API
Failed the same morning (25 Aug) with a **429** from the Azure Cost Management API. Separate from the
`dayWrap` problem — this function does fire, the call is throttled. Needs a retry with backoff
around the Cost Management request.

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
**Update 26 Aug:** both done — deployed 24 Aug, `wrapEmail` is in `FIELDS`. But `dayWrap` has still
never fired; see **Open bugs** above.
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

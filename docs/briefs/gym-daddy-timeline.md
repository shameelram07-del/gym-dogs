# Brief: Gym Daddy on a timeline

**Written:** 2026-08-25 in Cowork · **Status:** ready to build
**Hand to Claude Code with:** `implement docs/briefs/gym-daddy-timeline.md`

---

## Goal

Gym Daddy speaks at four set moments in the day instead of firing every time the day changes, and
the last one is a real wrap-up that arrives by email so it actually gets read.

## Why

Shameel's idea, 13 Aug: *"four timed slots — morning, midday, evening, and an 11pm wrap that closes
the day out. One note per slot, so max four calls, naturally paced, and the last one is a real
summary instead of another running total."*

Today the note is change-triggered — an 8s debounce, a 150 kcal delta gate and a hard ceiling of 6
calls a day (`COACH_DEBOUNCE_MS`, `COACH_KCAL_DELTA`, `COACH_MAX_CALLS` at the top of
`src/app/nutrition/page.js`). It works, but it means the card keeps re-reading a half-finished day
and every note sounds like a running total. This supersedes the 6-call cap in
`docs/briefs/nutrition-coach-card.md`.

The catch Shameel decided on 25 Aug: the app is a static web app with no push, so a note generated
at 11pm only appears if someone opens the app before midnight. **He chose to email it** rather than
let it go unseen.

## Scope

**In:** three in-app slot notes on the Nutrition screen, the per-slot cache, and a new timer
function that emails the end-of-day wrap.

**Out:**
- Push notifications of any kind.
- Slot notes on any screen other than Nutrition.
- Changing what `aiCoach` itself does — the frontend keeps calling it exactly as it does now.
- Rewriting `buildCoachPrompt` for the in-app slots; it gets a slot argument, nothing more.

## Behaviour

### In-app slots

1. Three in-app slots by local time: **morning** 05:00–11:00, **midday** 11:00–17:00, **evening**
   17:00–23:59. Anything before 05:00 counts as the previous evening and generates nothing new.
2. A slot's note is generated at most **once per day**, the first time the user is on Nutrition
   during that slot with at least one item logged. Max three in-app calls per user per day, down
   from six.
3. Keep the existing 8s debounce so three quick adds are still one call. Drop `COACH_KCAL_DELTA` and
   `COACH_MAX_CALLS` — the slot itself is now the gate.
4. The card shows the **most recent slot note generated today**. Earlier slots aren't shown; there's
   no history UI in this round.
5. If a slot passes with nothing logged, no note is generated and none is back-filled later.
6. Each note is written for its slot: morning looks ahead at the day's targets, midday is a
   mid-course check, evening is "what's left and what would finish the day well". Pass the slot name
   into `buildCoachPrompt` and give each a one-line instruction — do not write three separate prompt
   builders.
7. `coachFallback` still covers a failed or timed-out call, and takes the slot too so the
   deterministic text matches the moment.

### The emailed wrap

8. A new timer function emails one wrap-up per day per user.
9. **Schedule `0 0 10 * * *`.** `WEBSITE_TIME_ZONE` is unset on this Function App, so cron is UTC:
   that is 10pm NZST in winter and 11pm NZDT in summer. Deliberately not `0 0 11 * * *`, which would
   land at midnight during daylight saving and describe the wrong day. Say so in a comment.
10. Only email a user who has an email address, has `wrapEmail` not set to `false`, and **logged at
    least one item today**. Never email an empty day — that's nagging, not coaching.
11. Content: the day against target (calories and the three macros), whether they came in over or
    under, their logging streak, and one forward-looking line. Warm, short, same voice as the card.
    Sign-off is Gym Daddy — **never "Coach Dog"**, that name is dead.
12. If any macro on the day is unknown (the `missing`/null work shipped 24 Aug), say so rather than
    presenting a total as complete.
13. If the AI call fails, send a deterministic summary built from the numbers. An email that goes
    out plain is better than no email. If the *send* fails, log per-user like `weighInReminder` does.
14. Heartbeat it via `lib/heartbeat.js`, same as the other timers, so `costTest` can see it ran.

## Files likely touched

- `src/app/nutrition/page.js` — slot detection, the per-slot cache in `noteRef`, the scheduling
  effect around line 354, the constants at lines 28–31
- `src/lib/nutrition.js` — `buildCoachPrompt` and `coachFallback` take a slot; add a `slotFor(hour)`
  helper next to `phaseOfDay`
- `gymdogs-api-v2/dayWrap/` — **new**: `index.js` + `function.json`
- `gymdogs-api-v2/userProfiles/index.js` — add `wrapEmail` to `FIELDS`

## Data and API

- [ ] Frontend only — a `git push` ships it
- [x] New field saved on a profile → **must** be added to `FIELDS` in `userProfiles/index.js`
- [x] New or changed Azure Function → **manual zip redeploy** via Cloud Shell
- [ ] New app setting / secret Shameel has to add in the portal

New fields:
- `wrapEmail` (boolean, default true when absent) — lets someone turn the daily email off. No UI for
  it this round; absent means on.

The per-slot note cache lives **inside the existing `nutrition` object** on the profile, so it needs
no `FIELDS` change. Change `coachNote` to `coachNotes: { date, slots: { morning, midday, evening } }`
and tolerate the old single-object shape on read so nobody's cache breaks on the first load.

**Deploy note:** the API source is at `'Gym dogs'/gymdogs-api-v2` and is NOT a git repo — those
edits are unversioned. After building, run the `function.json` preflight; the zip must contain
**13** function folders once `dayWrap` exists, up from 12.

## Design

Reference mockup: none — the card keeps the styling it has now, the dark AI panel with the `--ice`
GYM DADDY eyebrow.

Tokens to use: unchanged. **Must not change:** the card's position — it sits below Today's food
since the 24 Aug reorder, and that order stays.

## Done when

1. `npm run dev`, open Nutrition in the morning with food logged — a note appears, and it reads like
   a start-of-day note rather than a summary.
2. Add more food. The note does **not** regenerate — the morning slot is spent.
3. Change your machine's clock into the afternoon and reload. A new, different note appears.
4. `costTest` shows a `dayWrap` heartbeat after the timer's first run.
5. The wrap email arrives and the numbers in it match what the app shows for that day.

## Notes back to Cowork

Leave anything discovered while building that the brief got wrong — this is what gets read next
time, alongside `docs/status.md`.

Two things Cowork already knows are open and did **not** put in this brief: SendGrid's free trial
ends **12 Sep 2026**, which this feature now depends on; and the live Cosmos key still hardcoded in
`migrate.js`.

### Built 2026-08-25 — what the brief didn't account for

1. **The wrap email needs the day's targets, and the API has no way to work them out.** The brief
   says "the day against target" but targets are computed client-side by `calculateTargets()` — the
   adaptive TDEE engine, EWMA weight trend, calorie floors and all. Porting that into a timer
   function would have created a second copy of the maths that drifts from the first (`computeLevel`
   already has that problem across two pages). Instead the Nutrition screen now snapshots the four
   numbers it actually showed into `nutrition.targets` when it saves the day, and `dayWrap` quotes
   them. Same trick the brief already chose for the note cache: `nutrition` is in `FIELDS`, so no
   allowlist change. **Consequence:** a day logged *before* this ships has no snapshot, and its wrap
   describes the totals with no target comparison. Self-corrects after one day.

2. **`unknownMacros`, `summariseDay`, `flattenEntries` and `loggingStreak` now exist twice** — once
   in `src/lib/nutrition.js` and once inline in `dayWrap/index.js`, because the API is a separate
   CommonJS codebase with no build step and can't import from the app. They're small and commented
   as mirrors, but they are a drift risk. If the streak rule or the unknown-macro rule changes,
   both need changing. Worth a brief of its own if the API ever grows a shared `lib/nutrition.js`.

3. **The in-app slot is read when the effect runs, not on a ticker.** A phone left open on Nutrition
   across 17:00 with nothing logged in between won't notice the evening slot opened until the next
   render — a reload, or logging something. Everything the brief's "Done when" list checks works;
   it's just worth knowing the boundary isn't watched the way midnight is by `onDayChange`. A slot
   ticker would be a few lines if it turns out to matter.

4. **`dayWrap`'s schedule is only correct while `WEBSITE_TIME_ZONE` stays unset.** If anyone ever
   sets it on the Function App, `0 0 10 * * *` becomes 10am local and the wrap arrives mid-morning
   describing a day that has barely started. `costTest` already warns about this for `costReport`;
   the same warning now covers `dayWrap` for free.

5. **No opt-out UI, as scoped.** `wrapEmail` is in `FIELDS` and honoured, but nothing writes it, so
   turning the email off currently means editing the Cosmos document by hand. Fine for five people;
   needs a Profile toggle before anyone else joins.

6. **`dayWrap` calls OpenAI directly rather than going through `aiCoach`.** Calling our own HTTP
   function from a timer would mean holding a function key in app settings for no benefit. It uses
   the same `OPENAI_ENDPOINT`/`OPENAI_KEY` and the same `gpt-4o-mini` deployment, with a 30s abort
   so a hung call can't drift toward the 5-minute consumption-plan ceiling. It does **not** go
   through `lib/aiBudget.js`, which caps Claude spend specifically — five 300-token calls a day is
   noise, but it is uncapped noise.

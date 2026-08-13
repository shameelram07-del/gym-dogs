# Brief: live AI read on the Nutrition screen

**Written:** 2026-08-13 in Cowork · **Status:** ready to build
**Hand to Claude Code with:** `implement docs/briefs/nutrition-coach-card.md`

Shameel wants the nutrition screen to *talk*: a short coach read of what's been eaten today, how
the last few days have gone, and what that means for the goal. Today the screen shows numbers and
leaves the user to interpret them.

**Frontend only.** It reuses the existing `aiCoach` endpoint — no new Function, no redeploy.

---

## Where it goes

A new card directly **under the calorie ring card**, above "Your daily burn". Style it like the
dashboard's AI panel — `--ai-card-1` → `--ai-card-2` gradient, `--ice` eyebrow reading
**COACH DOG**, `--on-dark` body text. Same 26px radius as everything else.

While it's thinking, show `.gd-shimbar` — not a spinner, and never an empty card.

---

## What it says

Two to three short sentences, conversational, second person. It has three jobs, in priority order:

1. **Read today** against the targets — what's on track, what's short, what's over. Protein is
   usually the interesting one.
2. **Put it in context of the last 7 days** — is this a normal day, a light day, a blowout?
3. **Say what would help, once.** Concrete and small: "a yoghurt and you're there", not a lecture.

It must adapt to the time of day and how much is logged:

- **Nothing logged yet** — no AI call at all. Show a static line: *"Nothing logged yet. Add
  breakfast and I'll tell you how the day's shaping up."*
- **Part way through** — the main case. Talk about what's left and what's realistic.
- **Late, and the day looks done** — summarise, and point at tomorrow.
- **Well over target** — say it plainly and without shaming. One day doesn't matter; the
  seven-day average does. Tone here matters more than anywhere else in the app.

---

## The data it gets

Compose the prompt **client-side** from state the screen already holds — don't add new fetches
beyond the 7-day history:

- today's items: name, kcal, P/C/F, and the time each was logged
- targets: kcal and P/C/F from `TargetsSetup` / profile
- `expenditure` and the goal rate from `src/lib/nutrition.js` (2573 kcal, −0.25 kg/week in the
  screenshot), plus whether it's still the starting estimate or a real adaptive figure
- last 7 days: total kcal and protein per day, from the logs already stored per date
- `goalWeight` and the latest weigh-in if set
- local time of day

Send it through the existing `aiCoach` call the dashboard already uses. Include `userId` so the
backend's member snapshot comes along. Keep the composed prompt under ~600 tokens — summarise the
7-day history as daily totals, never raw item lists.

---

## Cost and call frequency — read this before writing the fetch

The whole app costs about NZ$0.0004/month right now and the ceiling is **NZ$30**. A card that calls
a model every time someone opens the Eat tab would be the first thing in this app to actually spend
money. So:

- **Cache the note for the day** in the profile's nutrition log under a `coachNote` key alongside
  `{ generatedAt, itemCount, kcal }`.
- **Only regenerate when the day materially changed**: item count differs, or logged kcal moved by
  more than 150 since the note was written. Water changes never trigger it.
- **Debounce 8 seconds** after the last edit, so adding three things to a meal is one call.
- **Hard cap 6 calls per user per day.** After that, keep showing the last note. Count it in the
  cached object.
- Opening the screen with no changes since the last note must make **zero** calls.

---

## When it fails

Never show an error where a coach note should be. If `aiCoach` fails, times out, or returns
nothing usable, fall back to a **deterministic sentence built from the numbers** — something like
*"1273 in, 1027 left. Protein's the one to watch: 47g of 160g."* Put that helper in
`src/lib/nutrition.js` as a pure function so it's testable and so the card always has something to
say. Same fallback while offline.

---

## Tone rules — these are not optional

- Never prescribe a deficit beyond what `src/lib/nutrition.js` already calculates. It has calorie
  floors and safety rails; the AI describes what the engine decided, it does not invent targets.
- No moralising about food. No "good"/"bad"/"clean"/"cheat". No guilt for going over.
- Don't comment on body weight beyond the goal the user set themselves.
- If a day is very low on calories, the note should say so kindly and suggest eating more —
  never congratulate a big deficit.

---

## Out of scope

- No changes to `aiCoach` itself or any Azure Function.
- Don't touch the adaptive TDEE maths — read from it, don't modify it.
- No chat thread. This is a one-way read. A back-and-forth is a later brief.

## Files

- `src/app/nutrition/page.js` — the card, the trigger logic, the cache
- `src/lib/nutrition.js` — the deterministic fallback sentence (pure, unit-tested)
- `src/lib/food.js` — only if the `aiCoach` call belongs there for consistency

## Done when

`npm run build` passes, then on a phone-width window:

1. Empty day → static prompt line, and **no** network call to `aiCoach`.
2. Log a couple of items → shimmer, then a note that names the actual foods and the protein gap.
3. Reload the page → the note is still there, and **no** new call fires.
4. Add another item → after ~8 seconds, one call, note updates.
5. Break the API key → the deterministic fallback sentence appears, no error text.
6. Light mode → the card is still readable.

Stop there for Shameel to test.

## Notes back to Cowork

The brief was buildable as written. Five things worth knowing:

1. **The cache had a trap the brief didn't see.** `profile.nutrition` was rebuilt inline as
   `{ date, items, waterMl }` at four separate call sites. Storing `coachNote` inside it means the
   very next logged item would have wiped the cache — and a wiped cache is a paid call. All four
   now go through one `nutritionPayload()` helper. **Don't build that object by hand again.**

2. **A stale note survived midnight.** `onDayChange` cleared items and water but not the note, so a
   new day opened showing yesterday's read against an empty log. The empty-day branch now clears
   it, and the rollover resets the call budget too. Found by tracing, not by running — worth
   confirming if you ever leave the app open overnight.

3. **Failed calls are cached deliberately.** The call count is written even when `aiCoach` errors,
   with an empty `text`. Otherwise a broken endpoint would be retried on every reload, since the
   cap lives in the cached object. Empty text renders the deterministic fallback, so the card still
   reads normally — it just doesn't cost anything more that day.

4. **The 8-second debounce is silent.** During it the card shows the deterministic fallback with no
   shimmer; the shimmer only appears once the call is actually in flight. That means the card says
   something useful instantly and upgrades ~8s later, rather than shimmering for 8 seconds at
   nothing. Different from a literal reading of the brief, and I think better — say if not.

5. **`buildCoachPrompt` went into `lib/nutrition.js` too**, next to the fallback. The brief only
   put the fallback there, but the prompt is pure, is the thing most likely to need wording tweaks,
   and a 30-line template string in the JSX would be worse. Measured at ~433 tokens with 3 items
   and 7 history days.

**One thing CLAUDE.md claims that isn't true:** it says `src/lib/nutrition.js` "is unit-tested".
There is no test runner in the repo — no jest, no vitest, no `test` script, no test files. The two
new functions are pure and take the clock as an argument specifically so they *can* be tested, and
I exercised them against six scenarios via a scratch script, but nothing is committed. Adding a
test framework is a real dependency decision, so I've left it. Worth either a brief or a
correction to CLAUDE.md.

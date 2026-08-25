# Brief: Pick the muscle groups, then generate the session

**Written:** 2026-08-25 in Cowork · **Status:** ready to build
**Hand to Claude Code with:** `implement docs/briefs/ai-session-generator.md`

> Replaces the earlier draft of this file, which put the generator on the member workout screen.
> Shameel redirected on 25 Aug: the generator stays on the **Coach** screen, where the button
> already is, and the missing piece is choosing what you're training before it runs.

---

## Goal

On the Coach screen, Shameel picks the day or the muscle groups he's training, taps generate, and
gets a session built from exactly those groups — ready to review and publish.

## Why

His words: *"see that button generate with AI, I want that working, but before that we should choose
the day it is / muscle group(s) we are targetting, then based on that it creates a plan for the
day."*

`generatePlan()` at `src/app/coach/page.js:191-239` already calls `aiCoach`, parses the JSON array
and maps names back through `findExercise()`. The problem is the prompt at line 194: the only thing
it knows is `planTag` — STRENGTH, HYPERTROPHY, CARDIO, DELOAD, FULL BODY — and it hands the model
**the entire catalogue of 93 exercises across all 8 groups**. So it picks a scattered full-body
session every time. There is no way to say "back day".

## Scope

**In:** a target picker above the generate button on the Coach screen, and a generator that only
draws from the chosen groups.

**Out:**
- Per-set prescriptions, rest timers, weight suggestions. `reps` stays the free-text range string
  the plan shape already uses.
- Changing publish, drafts, assignment, or the announcement email.
- Any restructuring of how the member logs sets. The member screen gets block **labels** only —
  see point 16 — and nothing else.
- Assigning named people to blocks. The session says "pair up"; who pairs with whom is Shameel's
  call in the gym.

## Behaviour

1. Above the existing "Generate strength plan with AI" button, add a **TARGET** section with two
   rows of chips, styled like the existing Session type row at `coach/page.js:495-506`.
2. **Row one — day presets**, each of which just pre-selects groups in row two:
   - Push → CHEST, SHOULDERS, TRICEPS
   - Pull → BACK, BICEPS
   - Legs → LEGS
   - Upper → CHEST, BACK, SHOULDERS, BICEPS, TRICEPS
   - Full body → CHEST, BACK, LEGS, SHOULDERS, CORE
3. **Row two — the 8 muscle groups**, multi-select, toggled independently. Picking a preset fills
   this row; touching any group afterwards just edits the selection and clears the preset highlight.
   This row is the source of truth — the preset is only a shortcut.
4. **Generate is disabled until at least one group is selected**, with the button label saying so
   rather than failing silently.
5. The prompt sends **only the chosen groups' exercises** as the catalogue, not all 93. Keep the
   existing "reply with ONLY a JSON array" instruction and the `[{"name","sets","reps"}]` shape —
   `findExercise()` already maps those back and drops anything not in the library.
6. Ask for a sensible **exercise count**. It is derived from the session length in point 10 rather
   than typed, but keep a small stepper (4–8) so it can be overridden. Tell the model to spread the
   exercises across the chosen groups roughly evenly, and to **order compounds first, isolation
   last**.
7. `planTag` stays and still means something — pass it as the *style*, so STRENGTH biases lower reps
   and bigger movements, HYPERTROPHY mid reps, DELOAD lighter and fewer sets.
8. If the session name is empty, suggest one from the selection — "Back & Biceps", "Push Day",
   "Legs" — the way line 231 already auto-names from the tag.
### How long, and how many of us

10. Add a **SESSION** row beside TARGET with two small number inputs: **minutes** (default 60) and
    **people training** (default 1).
11. **Minutes drives the exercise count.** Budget roughly 10 minutes per exercise for one person —
    45 min → 4, 60 min → 5-6, 90 min → 7-8 — and pass the number of minutes to the model so it can
    also pull sets back on a short session rather than just cutting exercises. The stepper in point
    6 overrides this when Shameel wants it to.
12. **People training changes the shape of the session, not just the picks.** With one person it
    stays a straight list. With **two or more**, the model must build the session in **paired
    blocks**: a primary movement plus a partner exercise that uses completely different equipment,
    so while one person is on the primary the other is working, then they swap. Shameel's words:
    *"the AI can create like a plan with supersets while one person is doing the primary
    movement."*
13. Rules for the pairing, in the prompt:
    - The two exercises in a block must **never need the same station** — a plate-loaded press
      pairs with dumbbells or a cable, never with another plate-loaded machine.
    - Pair a **big compound with something lighter** — a leg press with a cable abduction, not two
      heavy squats back to back.
    - Prefer pairing across **different muscle groups** from the selection, so neither person is
      working the same muscle twice in a row.
    - With an **odd headcount** the last block can be a single exercise, or one people can rotate
      through in threes. Say which.
14. Each exercise gets a **`block`** field — `"A"`, `"A"`, `"B"`, `"B"`, and so on — so the pairs are
    explicit rather than implied by order. Plan docs are not governed by the `FIELDS` allowlist, so
    this needs no API change. A single-person session sets `block` to `null` throughout and renders
    exactly as it does today.
15. The Coach screen shows the block letter on each exercise card and keeps pairs visually together,
    so Shameel can see what he's publishing.
16. **Minimal member-side change, and only this:** on `src/app/workout/page.js`, when the loaded plan
    has blocks, show the letter beside each exercise and a one-line header on the first of each pair
    — "Superset A — alternate with your partner". Do not restructure the logging flow; sets are
    still logged per exercise exactly as now.
17. Add a line under the generated draft saying how the session is meant to run — "6 people, 3
    blocks, pair up and alternate". One sentence, from the model, stored in the plan's existing
    `notes` field so clients see it with the session.
18. **The fallback template must pair up too** when the headcount is 2 or more — pair each machine
    exercise with a dumbbell, cable or bodyweight one from the selected groups. A template session
    that ignored the pairing would be worse than useless for a group.
19. **The fallback template must follow the selection too.** `buildFromTemplate()` at
   `coach/page.js:38-46` is keyed on `planTag` and would hand back a chest/back/legs session after
   the coach asked for arms. Rebuild it to draw from the selected groups, spreading the requested
   count across them. Keep the "fewer than 3 usable exercises → template" rule at line 229, and keep
   saying plainly when a template was used.

## Files likely touched

- `src/app/coach/page.js` — the target chips, the minutes and people inputs, the state behind them,
  `generatePlan()`'s prompt, `buildFromTemplate()`, and the block letter on each exercise card
- `src/app/workout/page.js` — block letters and the superset header, labels only
- `src/lib/exercises.js` — no change; it's the catalogue and it was cleaned up on 25 Aug

The `equipment` field on every library entry is what makes the pairing rule checkable — 'Plate
Loaded', 'Cable', 'Pin Loaded', 'Free Weight', 'Bodyweight'. Send it with each exercise in the
catalogue so the model can honour "never two of the same station in one block", and verify the rule
in code after parsing rather than trusting the model to have followed it.

## Data and API

- [x] Frontend only — a `git push` ships it
- [ ] New field saved on a profile → **must** be added to `FIELDS` in `userProfiles/index.js`
- [ ] New or changed Azure Function → **manual zip redeploy** via Cloud Shell
- [ ] New app setting / secret Shameel has to add in the portal

Nothing is stored. The selection is UI state that shapes one prompt; the plan doc that gets published
is unchanged.

`aiCoach`'s `max_tokens: 500` is **fine** and does not need raising — that caps the *response*, and
the response is a compact JSON array of five short objects. The catalogue is input, not output.
Sending fewer exercises is about answer quality, not token limits.

## Model: stay on gpt-4o-mini — tested 25 Aug

`GymDogAI` also has **gpt-5** and **gpt-4.1-mini** deployed. We ran this brief's exact prompt through
gpt-5 and gpt-4o-mini back to back and **gpt-4o-mini won on value decisively**, so `aiCoach` stays as
it is. Do not switch the model as part of this brief.

- **Both got the superset pairing completely right** — every block paired a machine with dumbbells,
  a barbell or a cable, none shared a station. That was the hard part and the only real reason to
  consider upgrading.
- Speed was a wash: 2.6s for gpt-5, 4.0s for 4o-mini. Within noise.
- gpt-5 costs roughly **8× more on input and 17× more on output** (Azure retail feed, gpt-5-codex
  meter as proxy — the plain gpt-5 meter did not appear in the feed).
- gpt-5 also needs different parameters — it rejects `temperature` and `max_tokens`, wants
  `max_completion_tokens` and `reasoning_effort`. A first attempt at `reasoning_effort: low` with an
  800-token budget returned **an empty string**: it spent all 800 tokens on reasoning and had none
  left to answer with. `minimal` fixed it. Not worth inheriting that complexity here.

**Two real output flaws to handle in code, one from each model. Fix both regardless of model:**

1. **4o-mini returned six exercises when asked for five.** Ask for the exact number firmly, and then
   **enforce it after parsing** — trim the extras, and if it comes back short, top up from the
   selected groups rather than publishing a session that doesn't match what was asked for.
2. **gpt-5 returned `"sets": "4"` as a string, not a number.** Coerce `sets` with `Number()` and
   validate `reps` is a non-empty string on the way in. Never trust the model's types.

Also expect the reply to arrive wrapped in a ```json fence — the existing bracket-match at
`coach/page.js:213` already handles that, so don't "fix" it.

## Design

Reuse the chip styling from the Session type row (`coach/page.js:495-506`) so TARGET looks native.
Selected chips use the same active treatment as that row. The generate button keeps its sparkle and
its position — it just now sits under the target picker.

Must not change: the exercise cards below, publish/draft, or the coach's ability to hand-edit every
row after generating.

## Done when

1. `npm run dev`, Coach screen. TARGET appears above the generate button, and the button is disabled
   until you pick something.
2. Tap **Pull**. BACK and BICEPS light up in the group row.
3. Generate. You get five back and biceps exercises, compounds first, all of them real entries from
   the library — no legs, no chest.
4. Deselect BICEPS, generate again. Back only.
5. Set minutes to 45 and generate. You get fewer exercises than you did at 60.
6. Set people to 2 and generate. The session comes back in lettered pairs, and **no pair needs the
   same machine** — check each block: if both exercises are plate-loaded, it's wrong.
7. Set people to 6 and generate. Same pairing, plus a line under the draft saying how to rotate.
8. Publish it and open the workout screen as a member. The block letters show, with a "Superset A"
   line on the first of each pair, and logging sets works exactly as before.
9. Set people back to 1 and generate. Straight list, no block letters anywhere.
10. Turn your wifi off and generate. You still get a back-only draft from the template — paired if
    people is 2 or more — and it says it used a template.

## Notes back to Cowork

Leave anything discovered while building that the brief got wrong.

Standing item Cowork already knows about and left out on purpose: **`aiCoach` has no cost cap.**
`lib/aiBudget.js` (NZ$20/month, 25 calls per user per day) is wired into `foodAI` only. Worth a
separate job before more people use it.

### Built 2026-08-25 — what the brief didn't account for

> Note: this brief was rewritten mid-build to add the "Model: stay on gpt-4o-mini" section. Both
> flaws it names are handled. The notes below cover the whole feature.

1. **There is a new file: `src/lib/session.js`.** The brief listed only `coach/page.js` and
   `workout/page.js`. But it also says to *verify the pairing rule in code after parsing rather
   than trusting the model* — and that verification, the day presets, the minutes-to-count maths,
   the name suggestion, the count enforcement and the rebuilt template are all pure logic with no
   business being inlined into a 650-line page component. `coach/page.js` holds the UI and the one
   fetch; `session.js` holds everything that decides what a valid session looks like, and it is
   pure and argument-driven so the pairing rule can be checked without a browser.

2. **The catalogue cleanup shipped alongside this** (resolved 25 Aug). It was sitting unstaged
   while this was built. Final count is **92**, from 77 committed — 15 removed (the duplicate
   "Hammer Strength" naming, mostly) and 30 added. Worth knowing that removing names is not free:
   published plans and logged history reference exercises by name, and a plan holding a removed
   name still renders and logs correctly, but the coach builder's Exercise dropdown has no matching
   option for it, so **an old draft reopened for editing shows that row's dropdown blank**. The
   name is still on the plan and still publishes; it just looks unset. Nothing crashes — every
   library lookup in the app uses optional chaining with a fallback.

3. **Greedy pairing was leaving people idle, so the matching is now most-constrained-first.** This
   is the one thing worth reading. Pairing front-to-back looks correct and quietly wastes partners:
   given three plate-loaded machines and three other movements, taking them in order burns two of
   the non-machines on each other and leaves two plate-loaded exercises unpairable — two singles,
   two people standing around, in a feature whose entire point is that nobody does. A perfectly
   good pairing existed. `pairUp()` now places the hardest-to-pair exercise first and gives it the
   partner that is itself hardest to place later, then sorts the blocks back into arrival order so
   a compounds-first answer still reads compounds-first. Six-exercise pull day, two people: three
   clean pairs instead of two pairs and two singles.

4. **The run note is derived in code, not asked for from the model.** Point 17 says "one sentence,
   from the model". Point 5 says keep the "reply with ONLY a JSON array" instruction. Those pull
   against each other — asking for prose alongside a strict JSON array is how the parse starts
   failing intermittently, and a failed parse silently drops to the template. Every fact in that
   sentence (headcount, block count, whether anyone is left over) is one we know exactly, so
   `runNoteFor()` writes it. It reads the same, it is always present, and it works on the offline
   template path too — which point 18 needs and a model call cannot give.

5. **How "never the same station" is actually checked.** Two exercises clash when their `equipment`
   strings match, with one exception: `Bodyweight` occupies no station, so it pairs with anything
   including another bodyweight movement. That means **two `Free Weight` exercises count as a
   clash** — a dumbbell press and a dumbbell curl are treated as competing, stricter than a real
   gym with two racks of dumbbells. Deliberate: `equipment` is the only signal the library carries,
   and being too strict costs a slightly less elegant pairing while being too loose costs someone
   standing around. Easy to relax later.

6. **Both model flaws are handled, and the count is enforced in both directions.** `sets` goes
   through `Number()` and falls back to the library default if it is not a positive number; `reps`
   accepts the range string or a bare number and falls back if empty. Extras are trimmed after
   parsing; a **short** answer is topped up from the selected groups by `fillToCount()`, which then
   re-pairs the whole session because the model's own block letters only covered its own shorter
   list. The prompt also now demands the exact number explicitly. The ```json fence is left to the
   existing bracket-match, as instructed.

7. **The model's answer is filtered, not just parsed.** Anything not in the library, a repeat, or
   an exercise from a group he did not select is dropped before the list is built. "Back day" has
   to mean back day even when the model wanders.

8. **The template fallback does not guarantee compounds-first.** It spreads the count across the
   selected groups and alternates equipment as it picks, because a template that came back as six
   plate-loaded machines leaves nothing legal to pair with. Ordering by compound would fight that.
   The AI path is told to order compounds first and does; the offline draft is a safety net, not a
   well-programmed session.

9. **The run note is merged into `notes` at publish, not typed into the field.** Overwriting a
   safety note he had already typed would be worse than not shipping the line. It is held
   separately, shown under the draft, and prepended at publish — `stripRunNote()` clears an older
   one first so a draft that is reopened and regenerated does not collect a line each time.

10. **Small correction:** the catalogue is **92** exercises, not 93, after the 25 Aug cleanup. The
    number appears twice in this brief.

11. **The exercise-count stepper is one-way.** Once touched it stops following the minutes and
    there is no "back to auto" control; the hint line says which mode it is in, and reloading
    resets it. Worth a tiny "auto" chip if it turns out to matter.

# Brief: Rebuild the Coach HQ session builder

**Written:** 2026-08-26 in Cowork · **Status:** ready to build
**Hand to Claude Code with:** `implement docs/briefs/coach-hq-rebuild.md`

> Built from **your own structural read** of `coach/page.js`, then corrected twice by your critique of
> the mockup. Where we disagreed you were right both times. Approved mockup (v2, three states):
> https://claude.ai/code/artifact/ba9b9352-c891-4b66-9db0-05d97f774e6a

---

## Goal

Shameel can brief a session, read the whole thing at a glance, and publish it — in that order, on a
screen that stays short.

## Why

His words: *"we need to revamp the coach part, it's very unorganised."*

Two causes, in order of how much they hurt:

1. **You can't see the session.** Every exercise renders a full editor — two horizontally-scrolling
   chip rows, a select, sets/reps, and a cue textarea. Six exercises is roughly 2,500px of form.
   Answering "is this a decent pull day?" means thumbing through twelve scrollers to read six names.
2. **Inputs and outputs are mixed together.** The screen doesn't distinguish *what the generator
   consumes* from *facts about a finished session*, and three fields sit on the wrong side of that
   line: Style belongs with the brief; Name, Date and Assign belong after the session.

## Scope

**In:** the Plan builder tab — renamed **Session** — restructured, and the component split that
makes it possible.

**Out:**
- Clients and Challenges, beyond moving the stats strip (point 3).
- Re-homing Challenges to Community. You raised it; it's a bigger move that spreads coach controls
  across two screens. Not now.
- The six side bugs from your read (draft/generator restore, the run-note split, and the rest). They
  get their own brief — **do not fold them in here.** The two that this layout would otherwise make
  worse *are* in scope: publish confirmation, and regenerate destroying hand edits.

## Do the split first

A precondition, not tidying: the tap-to-expand row needs its own state and can't have it while it's
inline JSX inside a `.map()` inside a tab conditional, ninety lines deep.

1. Split `src/app/coach/page.js` into `ChallengePanel`, `ClientList` / `ClientCard`, and
   `SessionBuilder` → `TargetCard` + `ExerciseRow` + `DraftList`. `src/lib/session.js` holds the pure
   logic already and stays as-is. `page.js` should land near 150 lines of tab shell.
2. **The trap you flagged, and it must not bite:** tab switching currently preserves an in-progress
   build because it's conditional rendering over shared state. `{view === 'plans' && <SessionBuilder/>}`
   unmounts on tab switch and silently destroys unpublished work. **Lift the builder state or keep
   the component mounted.** That accidental strength gets protected deliberately.
3. Move the stats strip (trained today / avg readiness / alerts, ~line 615) **inside** Clients. It's
   Clients data taking ~110px of wrong context on two tabs out of three.

## Progressive disclosure — this is what makes it shorter

**The most common state of this screen is "nothing generated yet", and that's the state v1 of the
mockup failed to draw.** Reordering alone would have moved furniture without shortening anything.

4. Before there's a session, the tab shows only: **What's live · The brief · Saved drafts.** The
   session and publish sections **do not render at all** — not as empty cards.
5. Once a session exists, **the brief collapses to a one-line summary** — `Pull · Hypertrophy ·
   60 min · 2 people` — tappable to reopen. The screen never shows a full brief and a full session
   at once.
6. **No wizard chrome.** No step numbers, no locking, no completion ticks. Sections appear when they
   have something in them. "What's live" is ambient status and is **not numbered** — it isn't a step
   in making a session.

## The sections

### What's live
7. The active session, **ungated by date**. Today it only renders when
   `activePlan.date === todayISO()` (~line 918), so publishing for tomorrow leaves the publishing
   screen silent about what's out there. Show name, exercise count, audience, and how long it's been
   live ("22h ago", not a date string).

### The brief — everything the generator consumes, nothing else
8. Target presets and muscle groups, unchanged.
9. **Style moves here** from the metadata card. `STYLE_BRIEF[planTag]` goes straight into the prompt
   — a generator input wearing a label's clothes, and its being misfiled is most of why the screen
   reads as scrambled.
10. **Drop FULL BODY from Style.** Your catch: the comment at line 37 says the tag is now the STYLE,
    not the shape — Full body is a shape and already a day preset. Today, Target = Push with
    Style = Full body tells the model "chest, shoulders, triceps only" and "balanced across the whole
    session" in one prompt. Leaves STRENGTH / HYPERTROPHY / CARDIO / DELOAD.
11. Minutes / People / Exercises under the label **Time & people** — the tab is called Session, so
    the word can't also label a field group inside it. Keep the draft-then-clamp-on-blur inputs.
12. Generate attaches to the bottom of this card, with **"or build it by hand"** beneath it as a
    text link. That path opens the session section with one blank row, so hand-building still exists
    without the generator.

### The session — the result
13. Gym Daddy's run note inline at the top of the card, not floating separately.
14. **Compact rows. Ship this even if nothing else lands.** One line per exercise: number · name ·
    `4 × 8-10` · block letter · chevron. Tap to expand the editor underneath; one row open at a time.
15. The expanded editor holds **Swap · Sets · Reps · cue**, and drops the per-exercise muscle group
    and equipment controls. Muscle group does `{ ...emptyExercise(), muscleGroup }`, wiping name,
    sets, reps and cue — on a generated session it can only cause damage. Equipment narrows a
    dropdown the exercise has already been chosen from.
16. **Swap is the replacement for those cuts, and it must exist** — v1 of the mockup removed the
    filters and left nothing, which was worse than today for the one edit a coach actually makes.
    Swap opens a searchable list of the **same muscle group**, filtered to exclude anything that
    clashes with the equipment its **block partner** is on. The old filters couldn't do that; they
    didn't know about blocks.
17. Regenerate and Add exercise at the foot of the card.
18. **Regenerate confirms when there are hand edits to lose** — it replaces all six exercises, and if
    rows have been edited it says which. An untouched session regenerates with no prompt.

### Publish — only what's true of a finished session
19. Name, **pre-filled from `suggestName(groups)`**. Fixes a live data bug: the auto-name is guarded
    by `if (!planName.trim())` (~line 499) and the field is currently the first thing on screen, so
    it never fires — you can type "Chest & Shoulders", switch Target to Legs, and publish leg day
    under the wrong name. Re-suggest on regenerate **unless Shameel has edited the name himself** —
    track that he touched it rather than diffing strings.
20. **Goes out to** (better label than "Assign to") — the existing assign chips.
21. **When — Today / Pick a date**, rather than a date field filled in every time.
22. Safety notes, with a line noting the run note goes out above it.
23. **Save draft and Publish side by side, as they are today.** Do not promote Publish to a
    full-width primary — v1 of the mockup did, which made the irreversible action the easier tap.
24. **Publish confirms.** It goes live for every member immediately and posts to the community feed;
    the confirmation should say exactly that. Ending a challenge already confirms, and it's the less
    risky action.
25. Saved drafts stay collapsed at the bottom — already right, `66b1e9c` did it deliberately.
26. **Opening a draft lands on the session, not the brief.** You're there to change exercises. The
    existing `#gd-builder-form` scroll anchor should point there.

## Files likely touched

- `src/app/coach/page.js` → tab shell only
- **new** `src/components/coach/`: `SessionBuilder.js`, `TargetCard.js`, `ExerciseRow.js`,
  `SwapSheet.js`, `DraftList.js`, `ChallengePanel.js`, `ClientList.js`
- `src/lib/session.js` — no change expected

## Data and API

- [x] Frontend only — a `git push` ships it
- [ ] New field on a profile → `FIELDS` in `userProfiles/index.js`
- [ ] New or changed Azure Function → manual zip redeploy
- [ ] New app setting / secret

The published plan document keeps its exact current shape. Nothing reaching the member's screen
changes in this brief.

## Design — three token corrections you caught

The mockup uses the app's own SLATE tokens. Three specifics, all of which drifted in v1 and are
fixed in v2:

- **Cards are `26px` radius.** `CLAUDE.md` line 123 names it as one of the five signals every screen
  must carry.
- **Selected chips are `--accent-tint` fill, `--accent` border, `--accent-strong` text** — matching
  `pillOn` in `nutrition/page.js:36`. Not a solid accent fill, which would make Coach stop matching
  the rest of the app.
- **Block letters use `--blue-tint` / `--blue-ink`.** Gold means *challenge* everywhere else.

Eyebrow labels 10px / `letter-spacing: .09em` / `--ink-3`. Run note on the
`--ai-card-1 → --ai-card-2` gradient with an `--ice` eyebrow reading **GYM DADDY**, never "Coach Dog".

Must not change: the Challenges tab's behaviour, publish/draft semantics, or the member's workout
screen.

## Done when

1. `npm run dev`, Coach screen. Tab reads **Session**. Stats strip appears only on Clients.
2. **Before generating, the screen is short** — what's live, the brief, drafts. No empty session or
   publish cards anywhere.
3. Start a build, switch to Challenges, switch back — **your work is still there.** The regression
   to watch.
4. Pick Pull, 60 minutes, 2 people, generate. The brief collapses to one line and the session reads
   as six lines.
5. Tap row 4 — expands in place with Swap, sets, reps, cue. No muscle-group or equipment control.
6. Tap Swap — biceps only, and nothing on the same machine as its block partner.
7. Edit row 4's reps, then Regenerate — it warns you first. Regenerate an untouched session — no
   prompt.
8. Publish — it confirms, and names the audience and the feed post.
9. Leave the name blank and generate: it fills from the target. Change Target to Legs and
   regenerate: the name follows. Type your own and regenerate: yours survives.
10. Style shows four options, no Full body.
11. Publish for tomorrow. What's live still tells you what's currently out.
12. Open a saved draft — you land on the exercises, not the brief.

## Notes back to Cowork

Anything the brief got wrong. **Put it here and tell Shameel** — Cowork overwrote this section once
by rewriting a brief file, so treat it as fragile.

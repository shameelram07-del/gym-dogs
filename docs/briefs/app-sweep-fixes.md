# Brief: fixes from the 26 Aug live app sweep

**Written:** 2026-08-27 in Cowork · **Status:** ready to build
**Hand to Claude Code with:** `implement docs/briefs/app-sweep-fixes.md`

---

## Goal

Nine defects found by driving the running app in Chrome. Item 1 is the one that matters — the AI
session generator has not actually been generating sessions. The rest are wrong numbers and wrong
strings on screens people look at daily.

## Why

Shameel asked for the whole app to be swept before any more features went in. This is what the
sweep found. Every item below was confirmed against page content, network traffic or the source —
**not** by clicking and watching, because the Chrome extension's synthetic clicks silently fail on
his machine and produced three false reports that have been dropped from this list.

## Scope

**In:** the nine numbered items.
**Out:** publishing a session and posting to the community feed — untested, because both reach 19
real people. Don't change those paths in this brief. Also out: the `--vio` violet still on the
readiness ring (raised 26 Aug, Shameel hasn't decided).

## Behaviour

### 1. Gym Daddy silently falls back to a template — the big one

The model is fine. It replies with exactly the right shape, and it does write a title:

```
{"title":"Iron Harvest","exercises":[
  {"name":"Plate-Loaded High Row [Plate Loaded]","sets":4,"reps":"4-8","block":null}, …]}
```

The names come back **with the equipment tag attached**, because `catalogueFor(groups)` prints the
catalogue as `Name [Equipment]` and the prompt says to copy the names exactly. `findExercise` gets
`"Plate-Loaded High Row [Plate Loaded]"`, matches nothing, so every row returns `null`,
`parsed.length >= 3` is false, and `templateSession` runs instead. Because `usedAI` is false the AI
title is thrown away too — which is why the brand-new title field showed "Pull Day".

Two consequences the coach sees: the same six exercises come back on every Regenerate (the template
is deterministic), and the status line reads "Built from template" even though the AI answered 200.

1. Strip a trailing bracketed tag before the library lookup — normalise
   `"Plate-Loaded High Row [Plate Loaded]"` to `"Plate-Loaded High Row"`. Do it inside
   `findExercise` so every caller benefits, not at one call site.
2. Match on the trimmed, case-insensitive name as it already does. Keep the existing behaviour for
   names that never had a tag.
3. **Add a unit-style check you can actually run** — a small node script under `scripts/` that
   feeds the captured reply above through `parseAiReply` + `findExercise` and asserts six rows
   survive. This is the class of bug you can prove without a browser, and it would have been caught
   before it shipped.

### 2. The dashboard challenge card is hardcoded

`dashboard/page.js:705-706` prints the literal strings "100,000 kg club" and "Pack challenge ·
prize: creatine". That challenge **ended on 7 Aug**. The live one is different, and Community shows
it correctly.

4. Read the current challenge the way Community does and render its name, prize and target.
5. If there is no running challenge, don't render the card at all.

### 3. Progress — "Weekly volume" shows the all-time figure

`progress/page.js:542` renders `totalVolume` as the headline of the Weekly volume card. On the test
account that reads 42.9k kg above four bars summing to 20.4k.

6. The headline must be the sum of the weeks actually charted. Leave the all-time number where it
   belongs, in the "kg lifted" stat at `:444`.

### 4. PR count disagrees between two screens

Profile shows 22 (`profile/page.js:339`, `prCount`); Progress shows 5 (`progress/page.js:445`,
`prs.length`). Same account, same moment.

7. Pick one definition, put it in one place, and use it on both screens. Say in `docs/status.md`
   which one you kept and why — 22 looks like every PR row and 5 looks like distinct exercises.

### 5. The community feed says "3.6kkg"

`workout/page.js:586` builds `volStr` as `"3.6k"`, and `:595-596` append `kg`.

8. Fix the join so it reads naturally — `3.6k kg` or `3,600 kg`, your call, but the same treatment
   in both the PR and the non-PR branch.

### 6. The feed says "1 exercises"

`useSessionBuilder.js:479`.

9. Singular when the count is 1. Old posts already in the container stay as they are — don't
   backfill.

### 7. The coach client list includes the service accounts

`costReport`, `dayWrap`, `weighInReminder` and `keepWarm` are scheduled-task accounts. They appear
as clients with "No sessions logged yet" and they are counted in "19 members" and in
"1/19 trained today".

10. Exclude them from the client list and from every count derived from it. Prefer a flag on the
    account over a hardcoded list of names, if one already exists — say which you chose.

### 8. The nutrition coach note can be hours out of date

By design the note fires once per slot (`nutrition/page.js:370-395`), which is right and is not
what this item is about. The gap is that **the effect only runs while the screen is open**, so
opening Eat at 16:00 after logging all day shows the *morning* note: the card said "you're currently
at 258 kcal" against a header reading 882.

11. When the card is showing a note from an earlier slot than the current one, generate the current
    slot's note on open. Still one call per slot — this makes the slot fire on first sight of the
    screen rather than not at all.
12. Don't touch the empty-day reset or the pre-05:00 no-slot rule.

### 9. Two small ones

13. "avg readiness 84" (`ClientList.js:37`) is averaging a single client — everyone else reads
    "— No data". The maths is right; the label isn't. Say what it covers, e.g. `1 of 19 reporting`.
14. `workout/page.js` block header renders `Superset A— alternate with your partner`. Missing a
    space before the em dash.

## Files likely touched

- `src/components/coach/useSessionBuilder.js` — `findExercise` normalising; the feed plural
- `src/app/dashboard/page.js` — challenge teaser reads the live challenge
- `src/app/progress/page.js` — weekly-volume headline
- `src/app/profile/page.js` — PR count, whichever side changes
- `src/app/workout/page.js` — `volStr` join, superset header spacing
- `src/components/coach/ClientList.js` — service accounts, readiness label
- `src/app/nutrition/page.js` — slot catch-up on open
- `scripts/` — the new generator parse check

## Data and API

- [x] Frontend only — a `git push` ships it
- [ ] New field saved on a profile → **must** be added to `FIELDS` in `userProfiles/index.js`
- [ ] New or changed Azure Function → **manual zip redeploy** via Cloud Shell
- [ ] New app setting / secret Shameel has to add in the portal

New fields: none, unless item 7 needs a service-account flag that doesn't already exist — if it
does, say so and stop rather than adding it silently, because that would make this an API job.

## Design

No visual redesign. Existing tokens only. Nothing here should change a layout — these are wrong
values and wrong strings inside layouts that are already right.

## Done when

1. Coach → Session → pick PULL → Generate. The status line says **"Session ready"**, not "Built
   from template", the title is something like "Iron Harvest", and a second Regenerate gives a
   **different** six exercises.
2. The node parse check passes.
3. Dashboard's challenge card names the challenge that is actually running, and disappears when
   none is.
4. Progress: the Weekly volume headline equals the bars beneath it.
5. Profile and Progress show the same number of PRs.
6. Finish a workout → the feed post reads "3.6k kg", not "3.6kkg". (Shameel runs this one — it
   posts to the pack.)
7. Publishing a 1-exercise session says "1 exercise".
8. Coach → Clients: no `costReport`, `dayWrap`, `weighInReminder` or `keepWarm`, and the header
   count drops accordingly.
9. Open Eat in the afternoon after logging all day — the note quotes today's real total.

## Notes back to Cowork

Three items were reported after the sweep and pulled from this brief once the source was read: the
set tick and the water buttons both work (the extension's clicks were not firing), and the
dashboard's "0 READY" was the `CountUp` animation caught mid-flight. Flag it if you find any of the
nine below are the same kind of mirage.

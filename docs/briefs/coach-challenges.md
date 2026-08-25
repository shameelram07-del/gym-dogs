# Brief: Challenges the coach actually runs

**Written:** 2026-08-25 in Cowork · **Status:** ready to build
**Hand to Claude Code with:** `implement docs/briefs/coach-challenges.md`

---

## Goal

Shameel starts, edits and ends community challenges from Coach HQ, and a finished challenge shows a
proper result instead of sitting on the feed at "0 days left" forever.

## Why

The 100,000 kg club expired and is still on the Community screen showing **0 days left**. Nobody
won: 18 members managed 33.7k against a 100,000 kg target, so the number was roughly three times
too high for a month.

Two separate problems, both in `gymdogs-api-v2/communityPosts/index.js`:

1. **There is no lifecycle.** `getChallenge()` (~line 43) auto-creates one singleton doc with
   `id: "challenge_active"` and a 31-day window, then nothing ever ends it, replaces it or reacts to
   the end date passing. Winner detection at ~line 173 is skipped once `today > endDate`, so an
   expired challenge just freezes.
2. **There is no way for Shameel to make one.** It was born in code, once. He has never been able to
   set a name, a prize, a target or a date.

## Scope

**In:** a Challenges section in Coach HQ, a challenge that ends properly, and history so past
challenges are kept.

**Out:**
- Members creating challenges. Coach only, same `COACH_ID` gate the generator uses.
- Team or head-to-head challenges. One target, everyone who joins races it.
- Prizes as anything other than a text label. No fulfilment, no tracking.
- Metrics other than **volume in kg**, which is what `volumeOf(sets_data)` already computes.

## Behaviour

### Data

1. Stop using the single `id: "challenge_active"` doc. A challenge becomes a normal doc in the
   `posts` container with `type: "challenge"` and its own id, so past ones are kept.
2. **At most one challenge may be active at a time.** Enforce it server-side: starting a new one
   while another is running is rejected with a clear message, not silently allowed.
3. Migrate the existing doc rather than orphaning it — it holds real `joinedBy` and the 33.7k of
   history behind it. Keep it as the first, now-ended challenge. Write a dry-run-first script under
   `scripts/` following the same rules as `scripts/mark-published-plans.js`: credentials from env,
   never hardcoded, safe to re-run, and report before writing.
4. Fields: `id`, `type`, `name`, `prize`, `targetKg`, `startDate`, `endDate`, `joinedBy[]`,
   `winnerId`, `winnerName`, `wonAt`, `status`, `createdAt`. `status` is `active` or `ended`.

### Coach HQ

5. A **Challenges** section on the Coach screen, gated on `COACH_ID` like the session generator.
6. It shows the running challenge with live standings, and a list of past ones.
7. **Start a challenge:** name, prize, target kg, start date, end date. Default the dates to today
   and today+30, and default the target to something grounded — take the pack's total volume over
   the last 30 days and suggest roughly that number, rounded. Show what that figure is based on:
   "the pack lifted 33.7k in the last 30 days". **Never default to a number nobody can reach.**
8. **Edit** a running challenge — all fields. **End** it early with a confirm.
9. Starting one posts an announcement to the feed, same shape as the publish announcement in
   `workoutPlans/index.js:94-114`. Ending one posts the result.

### Ending

10. A challenge with `endDate` in the past is **ended**, whether or not anyone hit the target.
    Do this server-side on read, not only when the coach clicks something — nobody should have to
    open Coach HQ for the card to be correct.
11. The Community card for an ended challenge shows the **final standings** — top three and where
    you came — and says plainly either who won, or that nobody reached the target and who got
    closest. It does not show a countdown, a progress bar to a target that will never be met, or a
    join button.
12. An ended challenge stays visible for **7 days** after it ends, then drops off the Community
    screen. Past challenges remain in Coach HQ.
13. When no challenge is active, the Community screen shows nothing where the card was — not an
    empty shell. Shameel sees a "Start a challenge" prompt in Coach HQ instead.

## The date bug to fix while you are in here

`communityPosts/index.js` computes dates in **UTC**, which is a day out for half of every NZ day —
the same class of bug as the workout logs (see `docs/status.md` and `src/lib/day.js`):

- line ~30 — `now.toISOString().split("T")[0]` for the 7-day leaderboard window
- lines ~60-61 — `startDate` / `endDate` when the challenge is created
- line ~172 — `const today = new Date().toISOString().split("T")[0]` for winner detection

All three must use the Pacific/Auckland calendar date. **This one bites in a way the others didn't:**
`today <= challenge.endDate` decides whether someone can still win, so on the last day of a challenge
the UTC date flips to tomorrow at midday NZ and the window shuts half a day early. Someone could beat
the target and not be credited.

There is no shared day helper on the API side — `src/lib/day.js` is frontend only. Add the equivalent
in `gymdogs-api-v2/lib/` and use it here; `clients/index.js:26,91` and `lib/costCore.js:78` have the
same problem and can move to it later.

## Files likely touched

- `gymdogs-api-v2/communityPosts/index.js` — challenge CRUD, the end-on-read rule, the date fixes
- `gymdogs-api-v2/lib/day.js` — **new**, local-date helpers for the API
- `src/app/coach/page.js` — the Challenges section
- `src/app/community/page.js` — the ended state, the 7-day window, the no-challenge state
  (`chDaysLeft` at ~line 231 and the card at ~254)
- `scripts/` — the one-off migration of the existing doc

## Data and API

- [ ] Frontend only — a `git push` ships it
- [ ] New field saved on a profile → `FIELDS` in `userProfiles/index.js`
- [x] New or changed Azure Function → **manual zip redeploy** via Cloud Shell
- [ ] New app setting / secret

Challenge docs live in the `posts` container and are not governed by the `FIELDS` allowlist. The zip
must still contain **13** function folders — run the `function.json` preflight before zipping.

## Design

Reuse the existing challenge card styling on Community; this is a state change, not a redesign. In
Coach HQ reuse the plan builder's form controls, and the number inputs must use the **draft-then-
clamp-on-blur** pattern from the session generator — the naive controlled-number input can't be
typed into. Never write "Coach Dog"; the AI is **Gym Daddy**.

## Done when

1. `npm run dev`, Coach HQ — the expired 100,000 kg club is listed as ended, with final standings.
2. Community shows it as finished, says nobody reached the target and who got closest. No countdown,
   no join button.
3. Start a new challenge from Coach HQ. The suggested target is based on real recent volume and the
   screen says so.
4. It appears on Community with a live countdown, and an announcement lands on the feed.
5. Try to start a second one while it's running — refused, with a message that makes sense.
6. Set its end date to yesterday and reload. It ends by itself, without you touching Coach HQ.
7. Set your machine's clock to 1pm NZ on the challenge's last day. The challenge is still live and
   still winnable — that's the UTC bug, and it should not reappear.

## Notes back to Cowork

Anything the brief got wrong. **Put it here and tell Shameel** — Cowork overwrote this section once
by rewriting the file, so treat it as fragile.

### Built 2026-08-25 — what happened and what the brief didn't account for

0. **Read this first: `gymdogs-api-v2` is now a git repo.** It was production source for a live API
   with no history and no undo. During this build a patch script truncated
   `communityPosts/index.js` to zero bytes and there was nothing to restore from — it was only
   recovered because the full contents had been read earlier in the session, and Cowork
   independently confirmed the reconstruction was byte-identical (MD5
   `d76120673af0b3e0667281c3f1241105`) against the 03:01 deploy zip. It is under git now with the
   as-deployed baseline as the first commit. **Do not let it drift back out of version control.**
   Related: `node --check` passes on an empty file, so it is not a safety net. Check a line count
   or a known symbol.

1. **The migrated doc keeps its `challenge_active` id, deliberately.** The brief asked for "its own
   id". The container is partitioned on `/id`, so renaming means create-new-then-delete-old, and a
   half-finished run would leave TWO challenge docs — in a feature whose whole point is that only
   one runs at a time. Nothing reads that id any more (the API queries on `type` and `status`), so
   it is now just a historical string. The singleton behaviour is gone; only the name is a relic.

2. **The suggested target is the pack's 30-day volume rounded, and Coach HQ says so.** Rounded to
   the nearest 1,000 above 10k, nearest 100 above 1k. On today's data the pack is around 33.7k over
   30 days, so the suggestion lands near there rather than at 100,000.

3. **A mid-challenge win still ends the challenge at its end date, not on the win.** That is the
   existing behaviour ("first to X") and the brief didn't say to change it, so a winner is announced
   when they cross the line and the challenge keeps running to its date. `endChallengeDoc` knows not
   to announce the same win twice on the way out.

4. **`finalStandings` is frozen when the challenge ends.** Otherwise the result would keep shifting
   as late logs land inside the old window — someone could "win" a challenge three days after it
   finished. Community reads `finalStandings` for an ended challenge and live `progress` for a
   running one.

5. **The migration script does not post to the feed.** The API posts a result when it closes a
   challenge itself, but back-dating that here would drop a July result at the top of the feed in
   September. The 100,000 kg club gets its status and standings silently.

6. **Coach-only is enforced server-side now**, not just by hiding the tab. `startChallenge`,
   `updateChallenge` and `endChallenge` return 403 unless the caller is `COACH_ID`, and the
   `?challenges=true` listing does the same. `COACH_ID` is duplicated in three frontend files and
   now the API too — worth a single source of truth at some point.

7. **One new lint diagnostic**, at 37 problems from 36. It is the repo-wide
   `react-hooks/set-state-in-effect` rule that the codebase already violates 27 times; the
   challenges fetch follows the same pattern as the existing plan fetchers. `npm run build` — the
   actual gate — passes.

8. **Untested against a live API.** The challenge work cannot run until the zip is redeployed, so
   nothing here has been exercised end to end. The pure pieces were: `lib/day.js` and the migration
   script's scoring, window filtering, and ended/active decision were all checked directly.
   `Done when` steps 1–7 all need the deploy first.

# Brief: Put a cost cap on Gym Daddy

**Written:** 2026-08-26 in Cowork · **Status:** ready to build
**Hand to Claude Code with:** `implement docs/briefs/aicoach-cost-cap.md`

---

## Goal

Every AI call the app makes is counted against the monthly ceiling and a per-user daily limit, so
nothing can quietly run up a bill — and when a limit trips, the app says something sensible instead
of breaking.

## Why

`lib/aiBudget.js` already exists and does the job properly: a monthly NZD ceiling, a per-user daily
call count, real per-model pricing, NZ calendar dates, and an "assume it's dear if we don't recognise
the model" default. It is wired into **`foodAI` only**.

`aiCoach` has no cap at all — and `aiCoach` is now the busiest AI path in the app. Three separate
things call it:

1. Gym Daddy's chat on the Coach screen
2. the three timed nutrition notes per user per day (shipped 25 Aug)
3. the session generator on the Coach screen (shipped 25 Aug)

`dayWrap` calls the model directly too, and is also uncapped.

Shameel's ceiling is **NZ$30/month**. Nothing threatens it today at five users on gpt-4o-mini, but
the number of AI calls per user per day went up sharply this week and there is no floor under it.

## Scope

**In:** `aiBudget` wired into `aiCoach` and `dayWrap`, and honest behaviour when a limit trips.

**Out:**
- Changing the models. See [[gym-dogs-models]] — we tested gpt-5 on 25 Aug and stayed on
  gpt-4o-mini deliberately.
- Changing the cap values. `CLAUDE_MONTHLY_CAP_NZD` (default 20) and `AI_DAILY_CALLS_PER_USER`
  (default 25) stay as they are; they're app settings and can be tuned without a deploy.
- A spend dashboard. `budget.summary()` already exists — exposing it is a separate job.

## Behaviour

1. Wire `budget.check(userId)` before, and `budget.record({model, usage, userId})` after, every model
   call in `aiCoach/index.js` and `dayWrap/index.js`. Follow how `foodAI/index.js` does it at lines
   ~183 and ~194.
2. `record` needs the real token counts — take them from the API response's `usage` object, not an
   estimate.

### What happens when a limit trips

**This is the part that needs thought, because `foodAI`'s answer doesn't transfer.** When `foodAI`
hits the cap it falls back from Claude to the cheap OpenAI deployment. `aiCoach` is *already* on the
cheap deployment, so there is nothing cheaper to fall back to. Refusing the call is the only option,
which makes the message matter.

Handle the three callers differently — they are not equally important:

3. **The session generator** already falls back to `PLAN_TEMPLATES` when the AI returns nothing
   usable. A capped call should take that same path and say plainly it used a template. Nothing new
   to build; just make sure a cap refusal looks like a failed call, not a crash.
4. **The nutrition slot notes** already fall back to `coachFallback()`, the deterministic read. Same
   deal — a capped call quietly uses it. **Do not show a cap error on that card**; it is ambient, not
   something the user asked for.
5. **The chat** is the one that needs a real message, because the user typed something and is waiting.
   Return a clear, friendly refusal in Gym Daddy's voice — something that says the AI is done for the
   day and will be back tomorrow. Not an error code, and not silence.
6. Return the reason in the response body (e.g. `{ capped: 'monthly' | 'daily' }`) so the frontend can
   tell a refusal apart from a failure. `providerNote` already exists on `foodAI` for this.

### The attribution hole

7. **`userId` is not sent on every call, so the per-user daily cap is partly inert.** The session
   generator posts `{ message, prompt }` with no `userId` (`src/app/coach/page.js` ~line 201). The
   same gap was noted for `foodAI` and never closed. Send `userId` from every caller:
   - the session generator in `coach/page.js`
   - `src/lib/food.js` and its callers
   - check the nutrition note path is passing it too (`dashboard/page.js` had this exact bug on
     24 Aug — `askCoach` read `userId` from state before it was set and posted an empty one)
8. A call with **no `userId` still counts against the monthly ceiling** — attribute it to a
   `"_anon"` bucket for the daily count rather than letting it through uncounted. An uncapped path
   is the thing this brief exists to remove.

## Files likely touched

- `gymdogs-api-v2/aiCoach/index.js` — check / record / refusal
- `gymdogs-api-v2/dayWrap/index.js` — check / record
- `gymdogs-api-v2/lib/aiBudget.js` — only if the `_anon` bucket needs it; otherwise leave it alone,
  it works
- `src/app/coach/page.js`, `src/lib/food.js` and callers — send `userId`
- `src/app/nutrition/page.js` — handle a `capped` response on the note without showing an error

## Data and API

- [ ] Frontend only — a `git push` ships it
- [ ] New field on a profile → `FIELDS` in `userProfiles/index.js`
- [x] New or changed Azure Function → **manual zip redeploy** via Cloud Shell
- [ ] New app setting / secret

The spend document lives in the `users` container under `aispend_<month>` with a matching `userId`,
so `userProfiles` never sees it. No `FIELDS` change. Zip must contain **13** function folders —
exclude `.git/` and `local.settings.json`, and run the `function.json` preflight.

## Done when

1. `npm run dev`. Ask Gym Daddy something on the Coach screen — normal answer.
2. Set `AI_DAILY_CALLS_PER_USER` to 1 in local settings and ask twice. The second gets the friendly
   refusal, not an error and not a blank card.
3. With the limit still at 1, open Nutrition — the note falls back to the deterministic read with
   **no error shown**.
4. With the limit still at 1, generate a session — you get a template draft and it says so.
5. Put the limit back. Check the `aispend_<month>` doc in Cosmos: `calls` went up, `nzd` is a small
   non-zero number, and `byModel` names gpt-4o-mini.
6. Generate a session while signed in as Shameel and confirm the call is attributed to his userId,
   not `_anon`.

## Notes back to Cowork

Anything the brief got wrong. **Put it here and tell Shameel** — Cowork overwrote this section once
by rewriting a brief file, so treat it as fragile.

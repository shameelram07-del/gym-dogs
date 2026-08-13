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

### Other open items
- **Bad dates already in Cosmos.** The `TODAY` fix stops new logs landing on the wrong day, but
  workouts already saved with yesterday's date stay wrong. Needs a count and a one-off cleanup.
- **No error monitoring.** Both bugs found on 13 Aug were invisible because catches swallowed them.
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

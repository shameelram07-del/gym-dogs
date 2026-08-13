@AGENTS.md

# Gym Dogs

Fitness coaching app. Shameel is the coach, AI is the assistant, his gym crew are the users.
Live at **https://gym-dogs.com**. Roughly **5 real people use it daily** — this is production,
not a sandbox. Public launch is still some way off, but breaking `main` breaks real users.

---

## Working with Shameel

- Professional IT engineer. Azure and infrastructure concepts land instantly; **JavaScript and
  React syntax are the gap** — explain those in plain English, no unexplained jargon.
- **One thing at a time.** Build a change, stop, let him test with `npm run dev`, then move on.
  Do not stack five features and hand him a wall of diffs.
- **He runs `git push` himself.** Commit if asked, never push.
- After a change, summarise what moved in one to three sentences.

---

## Stack — these are rules, not preferences

- **Next.js 16, App Router. JavaScript only — never introduce TypeScript.**
- React 19. Tailwind v4 is installed, but **pages are styled with inline style objects** reading
  CSS custom properties from `src/app/globals.css`. Follow that; don't convert pages to Tailwind.
- Static export (`output: 'export'`) → Azure Static Web Apps. No server components doing runtime
  work, no API routes in this repo, no `next start` in production.
- Auth: Microsoft Entra External ID (CIAM) via MSAL, authority `https://gymdogs.ciamlogin.com/`.
- Next.js 16 has breaking changes vs. older training data — see `AGENTS.md` and check
  `node_modules/next/dist/docs/` before reaching for a remembered API.

### Commands

```bash
npm run dev     # what Shameel tests with
npm run build   # THE GATE — must pass before he pushes
npm run lint
```

---

## There are TWO deploys. Do not confuse them.

**1. Frontend — this repo.**
Push to `main` → GitHub Actions → Azure Static Web App `gymdogs-app`. That's it.

**2. Backend API — NOT in this repo.**
The Azure Functions source lives on his machine at
`OneDrive - National Infrastructure\Documents\Claude\Projects\Gym dogs\gymdogs-api-v2`.
It deploys **manually**: build a zip (contents at the zip root, `host.json` on top), upload in
Azure Cloud Shell, then

```bash
az functionapp deployment source config-zip -g gym-dogs-playground -n gymdogs-api --src gymdogs-api-v2.zip
```

Verify afterwards — there should be **12** functions:
`aiCoach, clients, communityPosts, costReport, costTest, foodAI, foodLookup, gymLogs, keepWarm,
userProfiles, weighInReminder, workoutPlans`.

If a frontend change needs a new field saved on a profile, that field must be added to the
`FIELDS` allowlist in `userProfiles/index.js` **and the API redeployed**, or it silently vanishes.

---

## Azure

- Everything is on Shameel's **personal** subscription `4d1461e0-c9be-4081-ba13-31af4dd8be78`,
  resource group `gym-dogs-playground`. His NIFF work login **cannot see it** — `az` must be run
  under his personal account or you get `ResourceGroupNotFound`.
- Data is **Cosmos DB NoSQL** (`GymsDogs`: containers `Workouts`, `users`, `posts`, `plans`).
  **There is no SQL database.** Don't write SQL-server-shaped code.
- API base:
  `https://gymdogs-api-g9d0gve4angygdcj.newzealandnorth-01.azurewebsites.net/api`
- Budget ceiling is **NZ$30/month**. Actual Azure spend currently rounds to ~$0.
- Work network note: NIFF blocks `gym-dogs.com` as a "new domain" — test on the
  `*.azurestaticapps.net` URL from his work laptop.

---

## Traps — every one of these has already caused a real bug

1. **Dates must be LOCAL, never UTC.** `new Date().toISOString().split('T')[0]` returns the *UTC*
   date; NZ is UTC+12, so from midnight until noon it returns **yesterday**. This broke macro
   resets and the workout streak. Always use `src/lib/day.js` — `todayISO()`, `toLocalISO()`,
   `shiftISO()`, `onDayChange()`.
2. **Never cache the date at module scope** (`const TODAY = todayISO()` at the top of a file). A
   phone left open overnight keeps yesterday. Hold it in state and clear on rollover.
3. **Never put `capture="environment"` on an image input.** On iOS it opens the camera straight
   away and removes the Photo Library option, so an existing photo can't be used.
4. **Check `res.ok` before `await res.json()`.** Several screens don't, so any non-JSON error body
   surfaces as `SyntaxError: Unexpected end of JSON input` instead of something useful. Fix these
   when you're nearby — `dashboard/page.js` ~line 296 is a known one.
5. **No raw apostrophes in JSX text** — Turbopack build error. Reword or use `&rsquo;`.
6. **A function folder without `function.json` is skipped silently** by the Functions host. No
   error, no warning — the endpoint just 404s. Preflight every folder before zipping.
7. **Functions consumption plan hard-times-out at 5 minutes.** A slow model call doesn't error, it
   hangs. Client calls to `foodAI` abort at 45s (`AI_TIMEOUT_MS` in `src/lib/food.js`).
8. **A timer function that never fires → check `AzureWebJobsStorage` first.** Its absence killed
   `costReport`, `weighInReminder` and `keepWarm` for weeks while HTTP functions worked fine.
   `keepWarm`'s heartbeat (every 5 min) is the canary for the whole timer subsystem.
9. **New origin → add CORS on the Function App.** Adding the custom domain broke every API call
   until `az functionapp cors add` allowlisted it. Data was never lost; it looked like it was.
10. **Model parameters differ by generation.** gpt-4o-class takes `max_tokens`/`temperature`;
    gpt-5-class rejects both and wants `max_completion_tokens`. Reasoning models at default effort
    blow the 5-minute timeout.

---

## Design system

- **Dark is the default theme**; light via the toggle (`data-theme` on `<html>`, persisted to
  `localStorage` key `gd-theme`).
- Current look is **SLATE**: cool slate background `#080B11`, steel accent `#6C8CB8`, ice highlight
  `#6EE7F9`, ember `#FF7A45`, gradient `--grad` running ice → steel → deep steel.
  History worth knowing: the app was **IGNITE** (ink-violet + magenta `#FF2E93`) until commit
  `9dcbd28` swapped the gradient to steel and left the background violet. SLATE finishes that
  migration. Both `--mag` and every raw magenta are now **gone** — if one reappears it's a
  regression, not a leftover. The token is `--steel`.
- **Use the CSS variables from `globals.css`** — `--bg --card --ink --accent --grad --ember --ice
  --steel` and friends. Never hardcode a hex in a component. Composite values are tokens too:
  `--hero-mesh` (dashboard session hero), `--heat-1/--heat-2` (consistency heatmap ramp, shared by
  progress and history), `--coin-gold/-ice/-ember` + matching `-glow` (trophy coins).
- **The gradient is defined twice.** `--grad --grad-soft --hero-glow --heat-1 --heat-2` have a
  light-mode override in `globals.css` keyed to `[data-theme="light"]`, because the dark run starts
  at ice `#8DE9F8` — about 1.3:1 on a white page, unreadable as `.gd-grad-text`. **Change the
  gradient and you must change both**, or light mode silently loses its headings.
- Every screen should carry the same five signals: `.gd-disp` headings, `Reveal` entrance stagger,
  eyebrow labels, `var(--grad)` for brand fills, and 26px card radius. A screen missing these has
  only inherited the tokens and hasn't been finished.
- Utilities: `.gd-disp` (Space Grotesk display font), `.gd-grad-text` (gradient text),
  `.gd-shine`, `.gd-shimbar`.
- App is capped to a **centred 480px column** (`.app-shell`). `BottomNav` is shared by every screen
  except login and workout.
- **Performance:** no infinite full-screen animations. A drifting blurred background caused
  app-wide scroll jank on phones; the aurora orbs are frozen and animations are capped. Don't
  reintroduce one. Pages declare motion as **inline** `animation` styles, which no CSS selector can
  override — so `prefers-reduced-motion` is enforced by a blanket
  `*, *::before, *::after { animation-iteration-count: 1 !important }` reset in `globals.css`.
  That is the only thing that reaches inline styles; don't replace it with targeted rules.
- `computeLevel()` exists in **both** `dashboard/page.js` and `profile/page.js` — if you change the
  XP maths, change both.

---

## Where things live

```
src/app/          dashboard, workout, progress, profile, community, coach,
                  nutrition, history, exercise, onboarding, login
src/components/   BottomNav, AddFoodSheet, BarcodeScanner, TargetsSetup,
                  EditItemSheet, EmailCapture, MsalProvider, ThemeToggle, ...
src/lib/          day.js (dates), nutrition.js (adaptive TDEE), food.js,
                  exercises.js (catalogue), authConfig.js, quotes.js
```

`src/lib/nutrition.js` is **pure** — no React, no fetch — and is unit-tested. Keep it that way; it
holds the MacroFactor-style adaptive expenditure maths (EWMA weight trend, blended targets,
calorie floors and safety rails). Don't inline nutrition maths into a page.

---

## How work arrives here

Briefs are written in Cowork and land in `docs/briefs/*.md`. Shameel will say
*"implement docs/briefs/<name>.md"*. Read the whole brief first, ask about anything ambiguous
before writing code, and when the work is done append what shipped to `docs/status.md` so Cowork
can pick the thread back up. See `docs/briefs/_TEMPLATE.md`.

---

## Before you call anything done

- `npm run build` passes.
- Dates go through `src/lib/day.js`.
- No hardcoded colours; tokens only.
- `res.ok` checked on any fetch you touched.
- If it needs a new profile field or an API change, **say so explicitly** — that's a separate
  manual deploy Shameel has to run, and forgetting it is how features look broken in production.
- Tell Shameel what to test, and let him push.

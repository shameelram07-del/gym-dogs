# Gym Dogs — Handover v7 (for Claude Code)

Written 17 Nov 2026. Supersedes v4–v6. Read this first, then the CLAUDE.md in whichever repo you're in.

Some of this is unverified since late Aug 2026 (last backend commit 25 Aug, last file edits 27 Aug). Anything marked **(verify)** — check the code or Azure before trusting it.

---

## 1. Working with Shameel

- Professional IT engineer (Azure lands instantly), JavaScript beginner (React/JS syntax doesn't).
- **Short answers. One step at a time. Plain English.** Give exact commands to paste. Offer more only if he asks.
- He runs git push and Azure deploys himself. Don't push or deploy without asking.
- Show, don't tell: build a mockup first, he approves pixels. Screenshots work well for debugging.
- Two terminals — say which one every time:
  - **PowerShell on his PC** (VS Code) — git, npm, Compress-Archive.
  - **Azure Cloud Shell** (bash, browser) — `az` only. If it opens in his work subscription: `az account set --subscription "Gym Dogs"`.

## 2. What it is

Fitness PWA for ~5 mates (Shameel is coach/admin). Workout logging, PRs, community feed + challenges, Coach HQ, nutrition with AI macros, progress/weigh-ins, emails.

| Part | Where |
|---|---|
| Frontend repo | GitHub `shameelram07-del/gym-dogs`, local `C:\Users\shameel.tahir\Documents\gym-dogs` |
| Frontend stack | Next.js static export → Azure Static Web Apps, auto-deploys on push to `main` (GitHub Actions) |
| Live URL | https://gym-dogs.com (Cloudflare DNS) |
| Login | Entra External ID (CIAM) via MSAL |
| Backend repo | `gymdogs-api-v2` folder in the OneDrive "Gym dogs" project folder — local git only, **no GitHub remote** |
| Backend stack | Azure Functions, Node, Consumption plan. App `gymdogs-api`, RG `gym-dogs-playground`, region NZ North |
| API base | `https://gymdogs-api-g9d0gve4angygdcj.newzealandnorth-01.azurewebsites.net/api` |
| Database | Cosmos DB account `gymdogdb`, db `GymsDogs`, containers `Workouts`, `users`, `plans`, `posts` |
| AI | Azure OpenAI gpt-4o-mini (aiCoach, dayWrap, foodAI fallback). Claude via `lib/claude.js` (needs `CLAUDE_KEY`) |
| Email | SendGrid (`lib/sendgrid.js`) |
| Food data | Open Food Facts (via `foodLookup`, no key) |
| Subscription | "Gym Dogs" — only this app, so subscription cost = app cost |

Old memory/docs mentioning Supabase or Netlify are out of date — it moved to Azure.

## 3. Backend functions

| Function | Type | Does |
|---|---|---|
| gymLogs | HTTP | Workout log read/write |
| userProfiles | HTTP | Profile merge-upsert (whitelist FIELDS array). GET returns an **array** |
| workoutPlans | HTTP | Per-user plans (`assignedTo`, empty = everyone) |
| communityPosts | HTTP | Feed, fire/comment, leaderboard, challenges (lifecycle added 25 Aug) |
| clients | HTTP | Coach HQ list of members + stats |
| aiCoach | HTTP | Gym Daddy notes + plan generator. Budget-gated, returns 429 when capped |
| foodAI | HTTP | Macros from photo / text / nutrition label |
| foodLookup | HTTP | Barcode + text search (Open Food Facts) |
| costTest | HTTP | Diagnoses the cost email + timer heartbeats (`?run=1&send=1`) |
| costReport | Timer 20:00 UTC | Daily Azure spend email |
| dayWrap | Timer 10:00 UTC | End-of-day nutrition wrap email |
| weighInReminder | Timer Sun 19:00 UTC | Nudge if no weigh-in for 7 days |
| keepWarm | Timer every 5 min | Stops cold starts; heartbeat canary |

Shared code in `lib/`: `day.js` (NZ dates), `aiBudget.js` (spend cap), `claude.js`, `costCore.js`, `heartbeat.js`, `sendgrid.js`.

**App setting names** (values live in Azure only — never in git): `COSMOSDB_CONNECTION_STRING` or `COSMOS_ENDPOINT`+`COSMOS_KEY`, `OPENAI_ENDPOINT`, `OPENAI_KEY`, `OPENAI_DEPLOYMENT`, `OPENAI_VISION_DEPLOYMENT`, `OPENAI_API_VERSION`, `AI_PROVIDER`, `CLAUDE_ENDPOINT`, `CLAUDE_KEY`, `CLAUDE_MODEL`, `CLAUDE_MONTHLY_CAP_NZD` (default 20), `AI_DAILY_CALLS_PER_USER`, `NZD_PER_USD`, `SENDGRID_API_KEY`, `SENDGRID_FROM`, `COST_EMAIL_TO`, `AZURE_SUBSCRIPTION_ID`, `COACH_ID`, `APP_TIME_ZONE`.

## 4. Deploy

**Frontend:** `git add . ; git commit -m "..." ; git push origin main` → live in ~2 min.
`NEXT_PUBLIC_*` vars are baked at build — they live in `.env.local` AND GitHub Actions secrets. After changing a secret, push an empty commit to rebuild.

**Backend** (manual zip — see `gymdogs-api-v2/DEPLOY.md`):
1. PowerShell: `Compress-Archive -Path "<...>\gymdogs-api-v2\*" -DestinationPath "$HOME\Downloads\gymdogs-api-v2.zip" -Force`
2. Cloud Shell: upload the zip.
3. Cloud Shell: `az functionapp deployment source config-zip -g gym-dogs-playground -n gymdogs-api --src gymdogs-api-v2.zip`
4. Check: `az functionapp function list -g gym-dogs-playground -n gymdogs-api --query "[].name" -o table`

Zip deploy replaces everything. Don't include `node_modules`, `.git`, `_writetest.txt` or `scripts/` in the zip ideally.

## 5. Gotchas (all still bite)

- **Dates:** never `new Date().toISOString().split('T')[0]` — that's UTC, a day ahead from midday NZ. Use `lib/day.js` (backend) / `src/lib/day.js` (frontend).
- **Timer crons run in UTC** (`WEBSITE_TIME_ZONE` is unset). Pick times that stay on the same NZ day across daylight saving.
- **No test account** — anything you test writes to live data. `remove-test-log.js` deletes one named log safely.
- `userProfiles` GET → always `.find(p => p.userId === uid)`, never `[0]`.
- Entra display names can be GUIDs — keep the `looksLikeGuid()` guards.
- JSX apostrophes break Turbopack — use `&rsquo;`.
- Heartbeat + budget docs live in the `users` container with `heartbeat_*`-style ids — don't treat them as users.
- Silent failures were a theme: always check `res.ok`, never swallow errors in an empty catch.
- Microsoft Foundry route for Claude = **confirmed dead end**. Use the Anthropic API directly.

## 6. Open items (priority order)

**Do first**
1. 🟠 **Backend has uncommitted changes** — 7 files (aiCoach, clients, communityPosts, dayWrap, foodAI, foodLookup, lib/aiBudget) + untracked `scripts/`. Review the diff, check whether it's already deployed (verify), then commit. Delete `_writetest.txt`.
2. 🟠 **Push backend to GitHub** — create a private `gymdogs-api` repo and add it as a remote.

**Security — before any public launch** (from code review 22 Jul, `Gym Dogs - Code Review 2026-07-22.md`)
3. 🔴 Cosmos primary key hardcoded in the frontend repo's `migrate.js` and in git history. Rotate in portal, update app settings, remove from file, purge history. (verify — may already be done)
4. 🔴 Functions host key is public in the browser bundle (`NEXT_PUBLIC_*`). Real fix: validate the Entra bearer token in every function, derive `userId` from it. Then rotate the key.
5. 🔴 Coach HQ (`/coach`) has no server-side coach check. Add a `COACH_ID` guard on the page now; enforce on the API with #4.

**Bugs / unfinished**
6. Confirm email capture now saves addresses (tracker #1, fixed 14 Aug, unconfirmed).
7. Fix workouts already filed under the wrong date in Cosmos (pre-14 Aug, pre-noon sessions). Count first, then one-off cleanup.
8. Code review should-fix items #5–#10 (workoutPlans array, stale-merge on profile, remove-exercise volume, `/nutrition` + `/history` rewrites, null sets, community guards) — (verify) which are done.
9. Coach "Edit" scroll fix — made, not pushed (tracker #2).
10. Decide on 5 leftover uncommitted frontend files: authConfig, MsalProvider, migrate.js, staticwebapp.config, workflow yml (tracker #10).

**Features / ops**
11. Sentry: code done. Needs the sentry.io project created + `NEXT_PUBLIC_SENTRY_DSN` in `.env.local` and GitHub secrets. Then source-map upload.
12. Move AI to Claude: code deployed, just needs `CLAUDE_KEY` set on `gymdogs-api`. Monthly cap already in place.
13. SendGrid trial ended 12 Sep 2026 — check it moved to the free plan (verify; emails may be failing).
14. Personalised nutrition targets (still hardcoded 2200 kcal?) (verify).
15. Smarter AI plan generator (muscle focus + time inputs).
16. Add a test runner (vitest). `lib/nutrition.js` and `lib/monitoring.js` are built to be testable.
17. Parked: Play Store (PWABuilder TWA), App Store, Twilio SMS, Stripe, Capacitor.

**Tracker items that look done in code** (update `Gym Dogs - Tracker.xlsx`): food database, barcode lookup, photo → AI macros, Coach Dog timeline (11pm wrap went the email route — `dayWrap`).

## 7. Reference files (OneDrive "Gym dogs" folder)

- `Gym Dogs - Tracker.xlsx` — task list (stale since mid-Aug)
- `Gym Dogs - Code Review 2026-07-22.md` — full pre-launch review. **Contains live secrets in plain text — don't copy it anywhere, and redact it once keys are rotated.**
- `gymdogs-api-v2/DEPLOY.md`, `gymdogs-api-v2/costReport/SETUP.md`
- `gymdogs-wow-mockup.html` — design reference for remaining screen polish (note: app moved to the SLATE design language on 13 Aug — slate bg `#080B11`, steel accent; tokens in `globals.css`)
- `gymdogs-handover-v4/v5/v6.md` — history only, superseded

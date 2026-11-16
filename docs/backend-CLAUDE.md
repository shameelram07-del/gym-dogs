# gymdogs-api — CLAUDE.md

Azure Functions backend for the Gym Dogs app. Full context: the handover (`docs/HANDOVER.md` in the frontend repo) — read it first.

## Working with Shameel
- Short answers, one step at a time, plain English, exact commands.
- He does git push and Azure deploys himself. Ask before committing, never deploy.
- Say which terminal: PowerShell (his PC) or Azure Cloud Shell (`az`).

## Layout
- One folder per function: `function.json` + `index.js` (Node, classic v3 model `module.exports = async function (context, req)`).
- Shared code in `lib/`. Only npm dep is `@azure/cosmos`; the rest use Node built-ins on purpose so a plain zip deploy works. Don't add deps without asking.
- `scripts/*.mjs` = small standalone checks (`node scripts/check-energy.mjs foodLookup/index.js`).

## Rules
- Dates: always `lib/day.js` (NZ time). Never `toISOString().split('T')[0]`.
- Timer crons are UTC. Keep NZ same-day across daylight saving.
- Secrets only in Azure app settings / `local.settings.json` (gitignored). Never write a key into code, docs or commits.
- Every AI call goes through `lib/aiBudget.js` (`check` before, `record` after).
- Timers call `beat()` from `lib/heartbeat.js`.
- HTTP functions use `authLevel: function` and return CORS headers incl. `x-functions-key`.
- No test account — testing hits live Cosmos data. Say so before writing anything.
- Never swallow errors silently; log a reason.

## Deploy (manual zip)
See `DEPLOY.md`. RG `gym-dogs-playground`, app `gymdogs-api`.

## First job
Working tree has uncommitted changes (7 files + `scripts/`). Show Shameel `git status` / `git diff --stat`, confirm what's deployed, then commit. Delete `_writetest.txt`. No GitHub remote yet — offer to set one up.

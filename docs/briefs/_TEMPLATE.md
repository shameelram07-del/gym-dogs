# Brief: <feature name>

**Written:** <YYYY-MM-DD> in Cowork · **Status:** ready to build
**Hand to Claude Code with:** `implement docs/briefs/<this-file>.md`

---

## Goal

One sentence. What the user can do after this that they can't do now.

## Why

The actual problem, in Shameel's words where possible. What someone complained about, or what
looks broken. Skip the business-case padding.

## Scope

**In:** the screens and behaviours this brief covers.
**Out:** things deliberately not in this round — say so explicitly so they don't get built.

## Behaviour

Numbered and testable. Each line should be something you could tick off on a phone.

1.
2.
3.

## Files likely touched

- `src/app/<screen>/page.js` —
- `src/lib/<x>.js` —
- `src/components/<X>.js` —

## Data and API

Tick whichever apply — these decide whether a manual API deploy is needed.

- [ ] Frontend only — a `git push` ships it
- [ ] New field saved on a profile → **must** be added to `FIELDS` in `userProfiles/index.js`
- [ ] New or changed Azure Function → **manual zip redeploy** via Cloud Shell
- [ ] New app setting / secret Shameel has to add in the portal

New fields:

## Design

Reference mockup (if any):
Tokens to use: `--accent`, `--grad`, … · Anything that must NOT change:

## Done when

What Shameel should see when he runs `npm run dev`. Write it as steps he can follow.

1.
2.

## Notes back to Cowork

Leave anything discovered while building that the brief got wrong — this is what gets read next
time, alongside `docs/status.md`.

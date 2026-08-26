# Brief: session title field + tappable What's live card

**Written:** 2026-08-26 in Cowork · **Status:** ready to build
**Hand to Claude Code with:** `implement docs/briefs/session-title-and-live-link.md`

---

## Goal

Two small things on the Coach → Session tab: the coach can name the session at the top (with a
dramatic name written by Gym Daddy that he can type over), and tapping the "What's live" card takes
him to that workout.

## Why

Shameel, on the AI generator: *"the AI generator works great but, i want a free text field to add
the title — i like adding dramatic titles, or the AI can do it and i can edit if needed or don't
like it."*

The field technically exists already — `PublishCard.js` renders `b.planName` — but it is at the
bottom of the screen under Publish, so it reads as a publish setting rather than part of the
session. And `suggestName(groups)` only ever returns `Pull Day` / `Back & Biceps` / `Legs`, which is
not what he means by a title.

Second: *"from the plan builder, under What's Live — I want this card to be clickable and take me to
the workout."* Right now `LiveNow` is inert, so seeing what's live and looking at it are two
different journeys.

## Scope

**In:** the session title field and its AI naming; making the `LiveNow` card navigate.
**Out:** renaming an already-published plan (the card is a link, not an editor). No change to draft
naming beyond it picking up whatever is in the field. No new screen — the card goes to the existing
`/workout`.

## Behaviour

1. Once a session has been generated, a **title row sits at the top of the session section**, above
   the exercise list — a single-line free-text input, session-title sized (bigger than a normal
   field, `gd-disp`), placeholder "Name this session".
2. The input in `PublishCard` is **removed**, not duplicated. There is one title field on the
   screen. Publish still validates it and still refuses to publish a blank name.
3. When Gym Daddy generates a session it also returns a **title** — short, punchy, 2–4 words, no
   quotes, no emoji. Extend the existing `aiCoach` prompt to ask for it and return it alongside the
   exercises; keep the reply parseable, e.g. `{"title":"Iron Harvest","exercises":[...]}`, and keep
   accepting a bare array so an old-shaped reply still works.
4. **A typed name always wins.** `nameTouched` already does this — the AI title must respect it the
   same way `suggestName` does, in `applyGenerated`.
5. If the AI reply has no usable title, or the session came from a template (AI capped or failed),
   fall back to `suggestName(groups)` exactly as today. Never leave the field blank when groups are
   selected.
6. Regenerate gives a **new title** unless he has typed his own.
7. The **What's live card is tappable** — whole card, not a small link. It navigates to `/workout`.
8. It looks tappable: pressed state, and the cursor/affordance the app uses elsewhere for a card
   that navigates. Keep the LIVE pill where it is.
9. It must be a real keyboard-reachable control (button or link), not a `div` with `onClick`.

## Files likely touched

- `src/components/coach/SessionBuilder.js` — render the new title row above the exercise list
- `src/components/coach/PublishCard.js` — remove the name input; keep the blank-name guard
- `src/components/coach/useSessionBuilder.js` — prompt asks for a title; parse it; use it in
  `applyGenerated` behind `nameTouched`
- `src/components/coach/LiveNow.js` — make the card navigate
- `src/lib/session.js` — only if the fallback needs touching; `suggestName` itself stays

## Data and API

- [x] Frontend only — a `git push` ships it
- [ ] New field saved on a profile → **must** be added to `FIELDS` in `userProfiles/index.js`
- [ ] New or changed Azure Function → **manual zip redeploy** via Cloud Shell
- [ ] New app setting / secret Shameel has to add in the portal

New fields: none. The title is the existing `plan.name` — the published plan document keeps its
exact shape. The prompt change is client-side text sent to the existing `aiCoach` endpoint, so there
is no API redeploy.

## Design

Reference mockup: none — this is a small change to the 26 Aug rebuild.
Tokens: existing only. Title row uses `gd-disp`; the live card keeps `--accent-tint` /
`--accent-strong`. Radii from the existing scale (26px on cards).
Must NOT change: progressive disclosure — before a session is generated, nothing new renders. The
title row appears with the session, not before it.

## Done when

1. `npm run dev` → Coach → Session. Before generating, the screen looks exactly as it does today.
2. Pick PULL, tap Generate with Gym Daddy. The session appears with a **dramatic title at the top**,
   not "Pull Day".
3. Type over it. Tap Regenerate. **The typed name survives.**
4. Publish. The plan publishes under that name, and the What's live card shows it.
5. Tap the What's live card → lands on the workout screen showing that session.
6. Clear the title, tap Publish → still blocked with "Give the session a name."

## Notes back to Cowork

Built 2026-08-26. `npm run build` passes; lint is unchanged from baseline (37 pre-existing
problems either way). Three things the brief did not have:

- **The pressed state did not exist to reuse.** `globals.css` already had a `.gd-card.gd-press`
  class — hover lift plus a transition — but **nothing in `src/` used it**, and it had no `:active`
  rule. `button:active { transform: scale(0.975) }` would not have covered it either: the
  `.gd-card.gd-press:hover` rule outranks it, so on desktop a pressed card sat still. Added
  `.gd-card.gd-press:active`. `LiveNow` is the first user of the class.
- **The publish error is now a long way from the field it is about.** Clearing the title and
  tapping Publish still blocks with "Give the session a name." — but the banner renders inside
  `PublishCard` at the bottom of the screen while the empty field is now at the top of the session
  card, roughly a screen apart. It behaves as the brief specifies; whether it should scroll to or
  highlight the field is a separate call.
- **The AI title is best-effort by design.** Nothing validates that the model returns 2–4 words.
  `cleanTitle` strips quotes and discards anything over 40 characters, and a discarded title falls
  through to `suggestName(groups)` — so a rambling reply degrades to "Pull Day" rather than putting
  a sentence in the heading. If the titles come back consistently dull, that is a prompt change,
  not a code one.

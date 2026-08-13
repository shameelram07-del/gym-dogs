# Brief: SLATE palette + finish every screen

**Written:** 2026-08-13 in Cowork · **Status:** ready to build
**Hand to Claude Code with:** `implement docs/briefs/ui-slate.md`

Shameel picked option **C — Slate** from a three-way comparison: keep the calm steel direction, but
bring the background and accents into line so the gradient stops fighting the leftover ink-violet.

Frontend only. No API change, no redeploy, at any point in this brief.

**Work in four phases and STOP after each one** so he can test. Do not run phases together.

---

## Phase 1 — the palette itself

### `src/app/globals.css`, `[data-theme="dark"]`

Replace the whole dark token block with these. The comment on line 64 claiming it "matches
gymdogs-ignite-mockup.html" is no longer true — replace it with `/* SLATE palette */`.

```css
--bg:        #080B11;
--card:      #111823;
--soft:      #1A2331;
--shell-1:   #131C28;
--shell-2:   #060910;

--ink:       #EEF3FA;
--ink-2:     #8C9AAF;
--ink-3:     #5E6C80;

--line:      rgba(255,255,255,0.08);
--line-2:    rgba(255,255,255,0.045);

--accent:        #6C8CB8;
--accent-strong: #A9C6E4;
--accent-tint:   rgba(108,140,184,0.16);
--accent-glow:   rgba(108,140,184,0.34);
--on-accent:     #FFFFFF;

--gold:      #FFD166;
--gold-tint: rgba(255,209,102,0.12);
--card-2:    #131C28;

--orange:      #FF7A45;
--orange-ink:  #FFC0A3;
--orange-tint: rgba(255,122,69,0.16);

--blue:      #6EE7F9;
--blue-ink:  #9FF0FF;
--blue-tint: rgba(110,231,249,0.12);

--violet:    #8B5CF6;
--red:       #F04438;
--red-ink:   #FF9F93;
--red-tint:  rgba(240,68,56,0.18);

--nav-bg:    rgba(8,11,17,0.78);
--ai-card-1: #101823;
--ai-card-2: #1B2738;
```

### The shared gradient block (both themes)

```css
--ember: #FF7A45;
--steel: #6C8CB8;
--ice:   #6EE7F9;
--vio:   #8B5CF6;
--grad:      linear-gradient(135deg, #8DE9F8 0%, #6C8CB8 52%, #3E5273 100%);
--grad-soft: linear-gradient(135deg, rgba(141,233,248,0.14), rgba(108,140,184,0.13) 52%, rgba(62,82,115,0.16));
--glow-grad: 0 8px 32px rgba(108,140,184,0.34);
```

**Rename `--mag` to `--steel`** and update every reference. `--mag` has meant "steel blue" since
commit 9dcbd28 and the name actively misleads. Grep for it; don't leave an alias behind.

### The orphans

Find every hardcoded `rgba(255,46,147,…)` and `#FF2E93` still in `src/` — the audit counted six
across dashboard, workout, profile and progress — and replace with the matching token
(`var(--accent-glow)` for glows, `var(--grad)` for fills). No raw magenta should survive this phase.

Also retune the dark aurora orbs in `globals.css` so they read as slate rather than violet:
ice at low opacity top-right, deep steel bottom-left. Keep them frozen — the drifting version
caused the scroll jank.

### Reduced motion

`globals.css` ~line 241 only guards `body::before/after`, `.gd-shine` and `.gd-shimbar`. Two
infinite animations escape it and both are declared in local `<style>` blocks inside JSX:

- `login/page.js:113` — `gdFloat` on the logo
- `exercise/page.js:127` — `gdbounce` on an 84px emoji

Move both keyframes into `globals.css`, cap or remove the infinite loop, and bring them under the
`prefers-reduced-motion` block.

### Docs

Update the **Design system** section of `CLAUDE.md` to describe SLATE. Cowork has already rewritten
it to the target state — read it first and correct anything that doesn't match what you actually
built rather than assuming it's right.

**Then run `npm run build` and STOP.** This phase changes every screen at once; he needs to look
before you go further.

---

## Phase 2 — login and onboarding

The first two screens a new user sees, and the two furthest from the language.

### `login/page.js` — currently on the *previous* brand

- `:18-25` — logo gradient is hardcoded `#12B76A → #0B8F7A`, the old green/teal. Paw accent
  `#052E1E` appears 5×. All of it goes to tokens.
- `:101, :107` — ambient glows are green `rgba(18,183,106,…)` and blue `rgba(46,144,250,…)`.
  Replace with the slate orbs.
- `:116-122` — the wordmark rolls its own gradient; use `.gd-grad-text`. The `h1` has no
  `.gd-disp`, so it's Inter while every other heading in the app is Space Grotesk. Add it.
- `:85-95` — a local `<style>` block hand-duplicates the `Reveal` component as `gd-rise-1..4`.
  Delete it and use `Reveal`.

### `onboarding/page.js`

- `:239, :158` — headings need `.gd-disp`.
- `:308-313, :185, :223` — flat `var(--accent)` fills where the language wants `var(--grad)` plus
  `--glow-grad`.
- `:184-186` — the "Building your plan…" bar is exactly what `.gd-shimbar` is for.
- Card radii 14/16/20 → **26px**.
- No `Reveal` anywhere. A stepped flow is the obvious place for the stagger — add it per step.
- Eyebrows are hand-rolled inline at `:163, :226`; use the shared eyebrow style.

Build, then **STOP**. He'll sign out and walk the login → onboarding → dashboard path.

---

## Phase 3 — exercise, history, community, nutrition

- **exercise** — `:60` `borderRadius: 22` is unique in the codebase; make it 26. `:90` h1 needs
  `.gd-disp`. Chips should use the ice/ember vocabulary rather than `--blue`/`--violet` raw.
- **history** — `:129-139` renders trained days as a flat `--accent-tint` dot. `progress/page.js`
  already implements the three-level intensity heatmap; **reuse that**, don't write a second one.
  Radius `:108` 20 → 26. Add `Reveal`.
- **community** — the only worked-on screen with zero `.gd-disp`; `:216` `<h1>` and the section
  headings need it. The leaderboard and challenge race track should use `var(--grad)`. Medal
  colours are hardcoded (`#FFD97A, #F7B500, #CD7F32, #B8860B`) — move to `--gold` and friends.
- **nutrition** — second-most-used screen and it has no motion at all. Add `Reveal`, put
  `var(--grad)` on the calorie ring and macro bars, `.gd-shimbar` while a meal is being estimated.

Build, then **STOP**.

---

## Phase 4 — the near-misses

- **workout** — add the `Reveal` stagger (header, volume hero, exercise card, up-next list) and
  eyebrow labels. It's the only screen with neither. Be careful: this screen holds live session
  state, so entrance animation must not re-run on every log.
- **profile** — `Reveal` stagger, and gradient text on the stat numbers.
- **coach** — `.gd-shine` / `.gd-shimbar` and `var(--grad)`, cards to 26px. Lowest priority, it's
  his internal tool.

Build, then stop.

---

## Rules for the whole job

- **No raw hex in a component.** Everything through a token. If a colour is needed that no token
  covers, add the token rather than inlining it.
- **Light theme must still work.** Toggle it on each screen you touch — the shared gradient is used
  by both themes.
- Nothing infinite, nothing full-screen animated, everything under `prefers-reduced-motion`.
- Do not touch API code, `src/lib/nutrition.js`, or any data logic. This is presentation only.
- Append one entry per phase to `docs/status.md`.

## Done when

Every screen carries the same language: Space Grotesk headings, `Reveal` on entry, eyebrow labels,
`var(--grad)` for brand fills, 26px cards, no raw hex. Both themes work. `npm run build` passes at
the end of every phase.

## Notes back to Cowork

### Phase 1 — five calls I had to make

1. **The light theme needed its own gradient.** The brief puts `--grad` in the shared block for
   both themes, and also says light must still work. Those conflict: the new run starts at ice
   `#8DE9F8`, which is ~1.3:1 on a white page and unreadable as `.gd-grad-text`. Dark uses the
   brief's exact values; light gets the same hue journey darkened
   (`#1F8AA6 → #4C6E9B → #2B3A52`) via a `[data-theme="light"]` override, alongside `--grad-soft`,
   `--hero-glow` and the heat ramp. **This is now two places to edit, which is a trap** — flagged in
   CLAUDE.md and status.md.

2. **Reduced motion needed a blanket reset, not a move.** The brief's diagnosis was half right: the
   two animations were declared inline, and an inline `animation` beats *any* CSS selector, so
   moving keyframes into `globals.css` and extending the targeted block would not have worked. It
   also wasn't only those two — `dashboard:422` (`gdFlick` on the streak badge) and workout's
   confetti are inline and infinite too. The fix is the standard
   `*, *::before, *::after { animation-iteration-count: 1 !important }` reset.

3. **The exercise bounce stayed infinite.** It has an explicit ⏸ Pause / ▶ Play control right below
   it — the loop is the feature, and capping it at 3 would make the demo look broken. Keyframes
   moved to `globals.css` as `gdBounce`; the user is the cap, and reduced-motion stops it at one
   cycle. Login's logo float had no such control, so that one is capped at 3 as asked.

4. **Colour is not always one hue.** Hardcoded values that were *stale brand* became tokens
   (`--hero-mesh`, `--heat-1/2`). The trophy coins became tokens too, but kept their distinct gold /
   ice / ember hues — a shelf of four identical steel discs reads as one award. The heatmap went the
   other way: the old ember→magenta→gradient ramp became a single-hue steel climb, which reads far
   better as *intensity*.

5. **CLAUDE.md said dark is default; `globals.css` said light.** `layout.js:53` settles it — it
   stamps `data-theme="dark"` before paint and force-migrated existing users once via
   `gd-theme-v2`. CLAUDE.md was right, the CSS header comment was stale; I corrected the comment and
   keyed the light override to the explicit `[data-theme="light"]` so a pre-hydration frame can't
   flash the light gradient.

### Phase 2 — four calls

1. **`Reveal` needed a `style` prop.** It renders a real `div`, so wrapping login's flex children
   without passing their `width`/`maxWidth` down collapsed the layout. Added an optional `style`
   that merges into the wrapper — purely additive, all existing callers unaffected. Phases 3 and 4
   will want it too (nutrition, workout).

2. **The stepped stagger needs a `key`.** `Reveal` fires once and disconnects its observer, so on a
   stepped flow it would animate on step 1 and never again. The header and body are keyed on
   `currentStep` to force a remount per step. The **progress bar is deliberately outside** it — the
   bar should slide between steps, not fade out and back in.

3. **`--on-dark` / `--on-dark-2` are new.** Onboarding's AI panel had `#C9C5FF` and `#D9D9E3` text on
   `--ai-card-*`, which is dark in *both* themes — so `--ink` can't be used (it flips to near-black
   in light and vanishes). Same reasoning as `--hero-mesh`. **Dashboard has four more copies of
   `#C9C5FF`** that should move to these tokens when phase 4 touches it.

4. **The logo's white became `--on-accent`.** Rather than inventing a token for pure white:
   `--on-accent` already means "content sitting on a brand fill", and the tile is a brand fill.
   `--steel-deep` and `--logo-ink` are genuinely new. SVG `stopColor="var(--…)"` works because the
   SVG is inline in the DOM.

**Interpretation to check:** "card radii 14/16/20 → 26px" — I applied 26 to actual cards (plan
preview, benefit tiles, AI panel) but left the option buttons at 14/16 and the textarea at 14. They
read as form controls, not cards, and 26px on a 78px-tall option tile looks like a pill. Say if you
wanted those too.

### Phase 3 — three calls

1. **"Reuse the progress heatmap" became `src/lib/heat.js`.** The two screens don't share a
   component — progress draws a 5-week Mon→Sun grid, history draws a month calendar — so the
   reusable part is the *ramp*: `heatLevel(volume, max)`, `heatMax(volumes)`, `heatStyle(level)`.
   Both now call it, and the thresholds and colours exist once. Pure, no React, no fetch. History
   measures `max` across all logs rather than per-month, so a heavy day stays a heavy day as you
   page between months. Added a **Less→More legend** — shading with no legend is decoration.

2. **Macro bars kept their three hues.** The brief said `var(--grad)` on "the calorie ring and macro
   bars". The ring now runs the gradient stops. The bars didn't, because `MacroLine`
   (`nutrition:61-66`) colour-codes the P/C/F letters to match those exact bars — making all three
   the same gradient would destroy the mapping. **Flagging rather than assuming**; easy to change if
   you want it.

3. **Neutral black/white alphas were left alone.** Raw *brand* colour is gone from all four screens,
   but `rgba(0,0,0,0.3)` drop shadows and modal scrims remain. They aren't palette decisions and
   tokenising every shadow would add noise. White used as *content on a brand fill* did become
   `--on-accent`, since that's what the token means.

**26px is not universal yet.** Still on 22: `dashboard:162`, `dashboard:645`, `profile:93`,
`progress:152`, `progress:559`, `workout:745`. Profile, workout and coach are phase 4 — but
**dashboard and progress are in no phase at all**, so they'll keep 22 unless you add them.

### Phase 4 — the workout warning was real, and worse than described

**"Entrance animation must not re-run on every log" — the cause isn't re-render, it's remount.**
An exercise card renders as a `<button>` when collapsed and a `<div>` when expanded, under the
**same key**. React remounts on an element-type change, so a per-card `Reveal` would have faded the
card in every single time you tapped one. So `Reveal` wraps only the static chrome — header, stats
card, and the exercise-list *container*. The cards inside change freely without re-animating.
**Don't "improve" this later by moving Reveal onto the cards.**

Two other things while in there: workout's eyebrow labels were hand-rolled uppercase spans in four
places, now the shared style; and its AI coach panel had the same `#C9C5FF`/`#D9D9E3` pair as
onboarding, now `--on-dark`/`--on-dark-2`.

**Profile's stat numbers went gradient, losing three hues.** They were `--ink` / `--orange` /
`--accent-strong`. `.gd-grad-text` makes them read as one set of three, which is what the mockup's
`.stats3` does — the labels underneath carry the meaning. Say if you preferred the colour coding.

### The radii sweep (Shameel added this to phase 4)

Dashboard and progress were in no phase, so their 22px cards would have stayed odd ones out. Fixing
them surfaced the rest of the violet-era colour debt I flagged in phase 2 — `#C9C5FF` ×4,
`#D9D9E3`, `rgba(122,90,248,0.25)` ×2, `#140E24` ×2 — plus two more in `TargetsSetup.js` and stray
radii in `QuoteCard.js` and profile's modal. New tokens: `--on-dark-soft` (chips on dark panels),
`--hero-btn` / `--hero-btn-ink` (the inverse Start pill).

**Verified end state**, by grep across `src/`: no raw brand hex outside `globals.css`, no card
radius under 26px, no `--mag`, no magenta. That closes every "still open" item below except the
light-theme `--orange` mismatch.

### Still open, deliberately not touched in phase 1

- `workout/page.js:866` has local `gdfall`/`gdrise` keyframes duplicating `gdFall`/`gdRise` in
  `globals.css`. Same class of problem as the two the brief named, but workout is phase 4.
- `login/page.js:86` still hand-rolls `gd-rise-1..4`; phase 2 deletes it.
- The **light** token block still carries the old IGNITE ember `#F2542D` for `--orange`, while dark
  is now `#FF7A45`. The brief only specified the dark block. Worth deciding whether light should
  track it.

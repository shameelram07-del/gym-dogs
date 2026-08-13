# Brief: whole-meal logging + fix Estimate ignoring the photo

**Written:** 2026-08-13 in Cowork · **Status:** ready to build
**Hand to Claude Code with:** `implement docs/briefs/meal-logging.md`

Two changes to the AI tab of the food logger. Both are **frontend only** — no API change, no new
profile field, no Function App redeploy. Do part 1 first, it's small.

---

## Part 1 — the bug: Estimate throws away the photo

**What Shameel saw:** he photographed a chocolate bar's nutrition panel, typed
*"Ate 30grams of this"*, pressed **Estimate**, and got back
*"No specific food item was provided for estimation."* The photo was sitting right there on screen.

**Cause** — `src/components/AddFoodSheet.js`:

- `runAiText()` (line ~195) always calls `aiFromText(aiText)`. Text only. `photoPreview` is never
  looked at.
- `onPhoto()` (line ~227) is the only path that sends an image, and it fires from the 📷 button.
- So the preview at line ~478 persists from an earlier photo, and pressing Estimate silently drops
  it. The model gets "Ate 30grams of this" with nothing to look at, and says so.

**Fix:** one button that does the obvious thing.

1. In `runAiText()`, if `photoPreview` is set, call `aiFromPhoto(photoPreview, aiText.trim())`
   instead of `aiFromText(...)`. The `hint` argument already exists for exactly this.
2. Enable Estimate when there's a photo **or** text — right now it's disabled without text
   (line ~470), so a photo alone can't be submitted from that button.
3. Relabel the button to **"Estimate photo"** when a photo is attached, so it's obvious what will
   be sent.
4. Add a small **×** on the photo preview to clear it (`setPhotoPreview(null)`), otherwise a stale
   photo silently attaches itself to the next, unrelated estimate. Clear it after a successful
   `commit` too.
5. `onPhoto()` should no longer auto-run the estimate — picking a photo just attaches it and shows
   the preview. One button, one action.

**Note:** that panel was a *nutrition label*, and there's already a better path for those —
`aiFromLabel` via Scan → "Photograph the label", which returns a per-100g item and lands in the
portion editor. If the photo path returns low confidence on something that looks like a label,
add a one-line hint under the result pointing at Scan. Don't reroute automatically.

---

## Part 2 — log a meal as one thing, not five

**The problem:** cereal and milk came back as two rows with two `+` buttons and landed in the day
as two entries. Shameel wants **one line for the meal**, with the total, and to fix it by telling
the app what was wrong rather than editing each ingredient.

### Behaviour

1. When the AI returns 2+ items, the primary button becomes **"Log as one meal"**.
   Keep the current "Add all N and close" behaviour as a smaller secondary link:
   **"Add as N separate items"**. Neither path is going away — some meals genuinely are one food.
2. "Log as one meal" creates **one** entry:
   - `name` — derived client-side from the item names, first two joined, e.g. `Cereal & whole milk`
     (three or more → `Cereal, whole milk +1`). Editable before saving via a small text input above
     the button, pre-filled.
   - `calories`, `protein`, `carbs`, `fat` — sums of the items, rounded once at the end.
   - `grams` — sum where present, otherwise omit.
   - `components: [...aiResult.items]` — keep the itemised breakdown **inside** the entry. This
     rides along inside the existing `nutritionLog` JSON, so **no `FIELDS` change and no redeploy**.
3. On the nutrition day list, an entry with `components` shows the total on the main line and the
   ingredient names as small dim text underneath. Tapping it opens the existing edit sheet.

### The correction box

In `src/components/EditItemSheet.js`, for an entry that has `components`, add a text input:
**"Tell me what to change"** with placeholder *"it was 3 handfuls of cereal, no milk"*.

On submit, compose a plain-English description from the current components plus his correction and
send it through the **existing** `aiFromText` — no new API mode, no redeploy. Something like:

```
A meal of: cereal (2 handfuls, 240 kcal, P6 C48 F4); whole milk (150 ml, 97 kcal, P5 C7 F5).
Correction from the user: it was 3 handfuls of cereal, no milk.
Return the corrected items.
```

Replace the entry's `components` and totals with what comes back, keep the same entry `id` and
`at` timestamp so it stays put in the day, and keep the name unless the correction clearly changes
the meal. Show the old total struck through next to the new one for a moment so the change is
visible. If the call fails, leave the entry untouched and show the error — never silently wipe a
logged meal.

---

## Out of scope

- No barcode or Scan changes.
- No new Azure Function, no `foodAI` change, no new app setting.
- Don't touch the adaptive TDEE maths in `src/lib/nutrition.js` — totals feed it unchanged.

## Files

- `src/components/AddFoodSheet.js` — both parts
- `src/components/EditItemSheet.js` — the correction box
- `src/app/nutrition/page.js` — day list rendering of a meal entry
- `src/lib/food.js` — only if a `sumItems()` helper belongs there; keep it pure if so

## Done when

Run `npm run build`, then `npm run dev` and check on a phone-width window:

1. Attach a photo, type nothing, press Estimate — it reads the photo.
2. Attach a photo, type "30g of this", press Estimate — it uses both.
3. Clear the photo with ×, type "chicken rice bowl", press Estimate — text-only still works.
4. Estimate a two-item meal → "Log as one meal" → one line in the day with the combined total and
   the ingredients listed small underneath.
5. Tap it, type "it was 3 handfuls of cereal" → the total goes up and the entry stays in place.

Stop there and let Shameel test — don't carry on into other screens.

## Notes back to Cowork

The brief was accurate — the cause in Part 1 was exactly as described. Four judgement calls the
brief left open, all worth a look when Shameel tests:

1. **"Looks like a label" detection.** There's no reliable client-side way to tell a nutrition
   panel from a plate of food. The hint now shows when the estimate **came from a photo AND
   `confidence === 'low'`** — which will occasionally fire on a genuinely hard food photo. It's a
   one-line suggestion, not a reroute, so a false positive is cheap.

2. **The correction doesn't auto-save.** After "Redo the numbers" the sheet updates in place and
   shows `240 kcal → 310 kcal` with the old value struck through, then the user taps **Save**.
   Auto-saving would have closed the sheet instantly (`saveEdit` calls `setEditing(null)`), so the
   strike-through the brief asked for would never have been visible. The strike-through clears
   itself after 6s; the label reads "tap Save to keep it". If you'd rather it committed
   immediately, that's a small change but the strike-through has to go.

3. **Name-keeping rule.** "Keep the name unless the correction clearly changes the meal" is
   implemented as: re-derive only if the current name still equals `mealNameFrom(oldComponents)`,
   i.e. it was auto-generated and untouched. If Shameel renamed it to "Sunday breakfast", his name
   survives the correction.

4. **"Remember this food" on a meal.** That checkbox is still on for meal entries and will mint a
   per-100g custom food from the summed grams if the components had weights. Harmless and arguably
   useful, but it wasn't in scope so I left the behaviour alone — flag it if you want it hidden for
   entries with `components`.

One thing to watch: manually editing a meal's macros in the sheet does **not** update its
`components`, so the breakdown can drift from the total. Not in scope here; worth a future brief.

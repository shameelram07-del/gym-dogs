/**
 * check-session-parse.mjs — does a real Gym Daddy reply survive the parser?
 *
 * WHY THIS EXISTS
 * ---------------
 * The session generator spent weeks answering 200 with a perfectly good session
 * and showing a template instead. `catalogueFor` prints every option as
 * `Name [Equipment]`, the prompt says to copy the names exactly, so the model
 * sent back `"Plate-Loaded High Row [Plate Loaded]"` — and `findExercise` looked
 * for that string, brackets and all, in a library where no name has a bracket in
 * it. Every row resolved to null, `parsed.length >= 3` was false, the template
 * ran, and the AI's title was thrown away with it. Nothing on screen said so
 * beyond a status line reading "Built from template".
 *
 * That is the whole class of bug this file guards: the generator's reply is
 * plain data in, plain data out, so it never needed a browser to check.
 *
 * The reply below is captured verbatim from a live call on 26 Aug 2026.
 *
 * RUN IT
 * ------
 *   node scripts/check-session-parse.mjs
 *
 * Exits 0 when every check passes, 1 with the failures listed when one doesn't.
 *
 * HOW IT LOADS THE LIB
 * --------------------
 * There is no test runner here and no `"type": "module"` in package.json, so
 * `import '../src/lib/session.js'` would be read as CommonJS and die on the
 * first `export`. Loading the source as text and handing it to node as a data:
 * URL sidesteps that, and rewriting the `@/lib/…` alias to a real file URL is
 * the only thing the bundler was doing for us. Nothing here touches the app.
 */
import { readFile } from 'node:fs/promises';

const LIB = new URL('../src/lib/', import.meta.url);
const loaded = new Map();

async function loadLib(name) {
  if (loaded.has(name)) return loaded.get(name);
  const src = await readFile(new URL(`${name}.js`, LIB), 'utf8');
  // Every `@/lib/x` becomes a data: URL of that module, recursively, because a
  // data: URL cannot resolve a relative specifier of its own.
  const deps = [...src.matchAll(/from\s+['"]@\/lib\/([\w-]+)['"]/g)].map((m) => m[1]);
  let rewritten = src;
  for (const dep of deps) {
    const url = (await loadLib(dep)).url;
    rewritten = rewritten.replaceAll(`@/lib/${dep}`, url);
  }
  const url = `data:text/javascript;base64,${Buffer.from(rewritten, 'utf8').toString('base64')}`;
  const mod = { url, ns: await import(url) };
  loaded.set(name, mod);
  return mod;
}

const { ns: session } = await loadLib('session');
const { parseAiReply, findExercise, catalogueFor } = session;

// ── The captured reply ─────────────────────────────────────────────────────
// Tags attached to every name, exactly as the model sends them.
const REPLY = `{"title":"Iron Harvest","exercises":[
  {"name":"Plate-Loaded High Row [Plate Loaded]","sets":4,"reps":"4-8","block":null},
  {"name":"Barbell Bent-Over Row [Free Weight]","sets":4,"reps":"4-8","block":null},
  {"name":"Cable Lat Pulldown [Cable]","sets":3,"reps":"6-10","block":null},
  {"name":"Pull-Up [Bodyweight]","sets":3,"reps":"6-10","block":null},
  {"name":"Dumbbell Hammer Curl [Free Weight]","sets":3,"reps":"8-12","block":null},
  {"name":"Cable Curl (Straight Bar) [Cable]","sets":3,"reps":"10-15","block":null}]}`;

const checks = [];
const check = (label, pass, detail) => checks.push({ label, pass, detail });

// ── 1. The reply parses, title and all ─────────────────────────────────────
const { title, items } = parseAiReply(REPLY);
check('reply parses into 6 items', items.length === 6, `got ${items.length}`);
check('title survives', title === 'Iron Harvest', `got ${JSON.stringify(title)}`);

// ── 2. Every tagged name resolves to a library row ─────────────────────────
const resolved = items.map((i) => findExercise(i.name));
const missed = items.filter((i, n) => !resolved[n]).map((i) => i.name);
check('all 6 tagged names resolve', missed.length === 0, `missed: ${missed.join(', ') || 'none'}`);
// This is the assertion the brief asked for: six rows survive, so
// `parsed.length >= 3` is true and the AI session is the one that gets used.
check('enough rows survive to count as an AI session', resolved.filter(Boolean).length >= 3,
  `${resolved.filter(Boolean).length} of 6`);

// ── 3. The tag is stripped, not carried into the session ──────────────────
const carried = resolved.filter(Boolean).filter((r) => r.name.includes('['));
check('no bracket survives into a row name', carried.length === 0, carried.map((r) => r.name).join(', '));

// ── 4. Names that never had a tag still work, and rubbish still fails ─────
check('an untagged name still resolves', !!findExercise('Cable Lat Pulldown'), 'Cable Lat Pulldown');
check('case and padding still tolerated', !!findExercise('  cable LAT pulldown [Cable]  '), 'padded + mixed case');
// Only a trailing [square bracket] goes. A name that carries its own
// (parentheses) keeps them, or "Cable Curl (Straight Bar)" would stop matching.
check('parentheses in a name are left alone', !!findExercise('Cable Curl (Straight Bar) [Cable]'), '');
check('an unknown name is still rejected', findExercise('Bicep Blaster 5000 [Cable]') === null, '');
check('an empty name is rejected rather than matched', findExercise('') === null && findExercise(null) === null, '');

// ── 5. Field order does not matter ────────────────────────────────
// The prompt asks for the exercises FIRST and the title LAST, so the model has
// actually written the session before it names it. Nothing may depend on the
// old title-first order.
const swapped = parseAiReply('{"exercises":[{"name":"Pull-Up [Bodyweight]","sets":3,"reps":"6-10"}],"title":"Dead Hang"}');
check('an exercises-first reply keeps its title', swapped.title === 'Dead Hang', `got ${JSON.stringify(swapped.title)}`);
check('an exercises-first reply keeps its exercises', swapped.items.length === 1, `got ${swapped.items.length}`);

// ── 6. The catalogue really does print the tag ────────────────────────────
// If this ever stops being true the bug above is gone and so is the reason for
// stripping — better to be told than to keep guarding nothing.
check('catalogueFor still prints Name [Equipment]', /- .+ \[.+\]/.test(catalogueFor(['BACK'])), '');

// ── Report ────────────────────────────────────────────────────────────────
let failed = 0;
for (const c of checks) {
  if (c.pass) console.log(`  ok    ${c.label}`);
  else { failed++; console.log(`  FAIL  ${c.label}${c.detail ? ` — ${c.detail}` : ''}`); }
}
console.log(failed === 0
  ? `\n${checks.length} checks passed.`
  : `\n${failed} of ${checks.length} checks FAILED.`);
process.exit(failed === 0 ? 0 : 1);

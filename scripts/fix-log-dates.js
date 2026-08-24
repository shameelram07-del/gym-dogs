/**
 * fix-log-dates.js — one-off repair for workout logs stamped with the UTC date.
 *
 * Before the 13 Aug 2026 fix, the workout screen stamped `date` from the UTC
 * calendar date instead of the Pacific/Auckland one. NZ is UTC+12 (+13 in
 * daylight saving), so anything logged between midnight and midday NZ was
 * filed under the previous day. The date is also baked into the doc id
 * (`log_${userId}_${date}_${nameKey}`), so fixing it means writing a new doc
 * and deleting the old one — there is no in-place edit.
 *
 * A doc is only touched when it carries the bug's exact signature:
 *
 *     doc.date === the UTC date of updatedAt   AND
 *     doc.date !== the Pacific/Auckland date of updatedAt
 *
 * A log the user legitimately edited later has a recent `updatedAt` and an old
 * `date`, so it matches neither and is skipped. Older docs with no `date` use
 * the `log_${userId}_${week}_${day}_${nameKey}` id scheme and are left alone.
 *
 * Safe to re-run: a repaired doc no longer matches the signature, so a second
 * run finds nothing.
 *
 * Usage — from the repo root, with @azure/cosmos installed (`npm install`):
 *
 *     export COSMOS_ENDPOINT="https://<account>.documents.azure.com:443/"
 *     export COSMOS_KEY="<primary key>"
 *
 *     node scripts/fix-log-dates.js            # DRY RUN — reports, changes nothing
 *     node scripts/fix-log-dates.js --apply    # actually repairs
 *
 * Credentials come from the environment only. Nothing is hardcoded here.
 */

const { CosmosClient } = require('@azure/cosmos');

const DATABASE = 'GymsDogs';
const CONTAINER = 'Workouts';
const ZONE = 'Pacific/Auckland';

const APPLY = process.argv.includes('--apply');

// ── Dates ─────────────────────────────────────────────────────────────────

// Intl does the work so daylight saving is handled properly — NZ is +12 in
// winter and +13 in summer, and hardcoding either would reintroduce the bug
// for half the year.
const nzFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
});

function zonedDate(d) {
  const parts = nzFormat.formatToParts(d);
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

const utcDate = (d) => d.toISOString().slice(0, 10);

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * sets_data is stored as a JSON string. Returns an array, or null if it can't
 * be read — in which case the doc is skipped rather than risk losing sets.
 */
function parseSets(raw) {
  if (raw === undefined || raw === null || raw === '') return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch (e) {
    return null;
  }
}

/** Union of two set lists, comparing whole entries. Existing order is kept. */
function mergeSets(target, incoming) {
  const seen = new Set(target.map((s) => JSON.stringify(s)));
  const merged = target.slice();
  for (const set of incoming) {
    const key = JSON.stringify(set);
    if (!seen.has(key)) { seen.add(key); merged.push(set); }
  }
  return merged;
}

/**
 * The partition key value for a doc, read from the container's own definition
 * rather than assumed. It matters: if the container is partitioned on /id then
 * changing the id moves the doc to a different partition, and the delete has
 * to use the OLD id as its key.
 */
function partitionValueFor(doc, paths) {
  const values = paths.map((path) =>
    path.replace(/^\//, '').split('/').reduce((o, k) => (o == null ? undefined : o[k]), doc)
  );
  return values.length === 1 ? values[0] : values;
}

/**
 * Swap the date inside `log_${userId}_${date}_${nameKey}`. Rebuilt by prefix
 * rather than by splitting on '_', because a userId may contain underscores,
 * and the exercise nameKey is taken from the existing id rather than
 * re-derived — a renamed exercise must not silently change the key.
 */
function correctedId(doc, correctDate) {
  const prefix = `log_${doc.userId}_${doc.date}_`;
  if (!doc.id.startsWith(prefix)) return null;
  return `log_${doc.userId}_${correctDate}_${doc.id.slice(prefix.length)}`;
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const endpoint = process.env.COSMOS_ENDPOINT;
  const key = process.env.COSMOS_KEY;
  if (!endpoint || !key) {
    console.error('COSMOS_ENDPOINT and COSMOS_KEY must both be set in the environment.');
    console.error('  export COSMOS_ENDPOINT="https://<account>.documents.azure.com:443/"');
    console.error('  export COSMOS_KEY="<primary key>"');
    process.exit(1);
  }

  const client = new CosmosClient({ endpoint, key });
  const container = client.database(DATABASE).container(CONTAINER);

  const { resource: def } = await container.read();
  const pkPaths = (def.partitionKey && def.partitionKey.paths) || ['/id'];

  console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} — ${DATABASE}/${CONTAINER}, partition key ${pkPaths.join(', ')}`);
  console.log(`Correcting UTC-stamped dates to ${ZONE}.\n`);

  // Every log doc, paged, so this doesn't depend on the collection being small.
  const iterator = container.items.query({
    query: "SELECT * FROM c WHERE c.type = 'log'",
  }).getAsyncIterator();

  const all = [];
  for await (const page of iterator) all.push(...page.resources);

  const cases = [];
  let legacy = 0;        // no date — the week/day id scheme, left alone
  let noTimestamp = 0;   // can't be judged without updatedAt
  let unparseableTs = 0;
  let oddId = 0;         // has a date, but the id isn't the date scheme

  for (const doc of all) {
    if (!doc.date) { legacy++; continue; }
    if (!doc.updatedAt) { noTimestamp++; continue; }

    const stamped = new Date(doc.updatedAt);
    if (isNaN(stamped.getTime())) { unparseableTs++; continue; }

    const correct = zonedDate(stamped);
    const utc = utcDate(stamped);

    // The bug signature, exactly: filed under the UTC date when the NZ date
    // differed. Anything else — including a later legitimate edit — is left be.
    if (doc.date !== utc || doc.date === correct) continue;

    const newId = correctedId(doc, correct);
    if (!newId) { oddId++; continue; }

    cases.push({ doc, correct, newId });
  }

  // ── Report ──────────────────────────────────────────────────────────────

  console.log(`Log docs:            ${all.length}`);
  console.log(`Bug cases:           ${cases.length}`);
  console.log(`Skipped, no date:    ${legacy} (older week/day id scheme)`);
  if (noTimestamp) console.log(`Skipped, no updatedAt: ${noTimestamp}`);
  if (unparseableTs) console.log(`Skipped, bad updatedAt: ${unparseableTs}`);
  if (oddId) console.log(`Skipped, unexpected id shape: ${oddId}`);

  if (cases.length === 0) {
    console.log('\nNothing to fix.');
    return;
  }

  const wrongDates = cases.map((c) => c.doc.date).sort();
  const users = new Set(cases.map((c) => c.doc.userId));
  console.log(`Date range affected: ${wrongDates[0]} to ${wrongDates[wrongDates.length - 1]}`);
  console.log(`Distinct users:      ${users.size}`);

  console.log('\nSample:');
  for (const c of cases.slice(0, 5)) {
    console.log(`  ${c.doc.id}`);
    console.log(`    date ${c.doc.date} -> ${c.correct}   updatedAt ${c.doc.updatedAt}`);
  }

  if (!APPLY) {
    console.log(`\nDry run — nothing changed. Re-run with --apply to fix ${cases.length}.`);
    return;
  }

  // ── Apply ───────────────────────────────────────────────────────────────

  console.log(`\nApplying ${cases.length} fix${cases.length === 1 ? '' : 'es'}…\n`);
  let fixed = 0, merged = 0, failed = 0, skipped = 0;

  for (const { doc, correct, newId } of cases) {
    const incoming = parseSets(doc.sets_data);
    if (incoming === null) {
      console.log(`  SKIP  ${doc.id} — sets_data is not a JSON array, leaving it alone`);
      skipped++;
      continue;
    }

    try {
      // Is something already sitting at the target id?
      let existing = null;
      try {
        const target = { ...doc, id: newId, date: correct };
        const read = await container
          .item(newId, partitionValueFor(target, pkPaths))
          .read();
        if (read.resource) existing = read.resource;
      } catch (e) {
        if (e.code !== 404) throw e;
      }

      let next;
      if (existing) {
        const targetSets = parseSets(existing.sets_data);
        if (targetSets === null) {
          console.log(`  SKIP  ${doc.id} — target ${newId} has unreadable sets_data, not risking a merge`);
          skipped++;
          continue;
        }
        const union = mergeSets(targetSets, incoming);
        next = { ...existing, sets_data: JSON.stringify(union) };
        console.log(`  MERGE ${doc.id}`);
        console.log(`        into ${newId}: ${targetSets.length} + ${incoming.length} -> ${union.length} sets`);
        merged++;
      } else {
        // Same doc, corrected date and id. updatedAt is deliberately left as it
        // was: it is the evidence the detection rule reads, and rewriting it
        // would make this script unable to recognise its own work.
        next = { ...doc, id: newId, date: correct };
      }

      await container.items.upsert(next);

      // Only once the new doc is confirmed present does the old one go.
      const check = await container
        .item(newId, partitionValueFor(next, pkPaths))
        .read();
      if (!check.resource) throw new Error(`wrote ${newId} but could not read it back`);

      await container.item(doc.id, partitionValueFor(doc, pkPaths)).delete();

      if (!existing) console.log(`  FIXED ${doc.id}\n        -> ${newId}`);
      else console.log(`        old doc ${doc.id} deleted`);
      fixed++;
    } catch (e) {
      console.error(`  FAIL  ${doc.id} — ${e.message}`);
      console.error('        old doc left in place; re-run to retry');
      failed++;
    }
  }

  console.log(`\nDone. ${fixed} moved (${merged} of them merged into an existing doc), ${skipped} skipped, ${failed} failed.`);
  if (failed) process.exitCode = 1;
}

// Only connect to anything when actually run. Requiring this file just exposes
// the helpers, so the detection rule can be checked without touching Cosmos.
if (require.main === module) {
  main().catch((e) => {
    console.error(`\nFailed: ${e.message}`);
    process.exit(1);
  });
}

module.exports = { zonedDate, utcDate, parseSets, mergeSets, correctedId, partitionValueFor };

/**
 * migrate-challenge-doc.js — one-off migration for the original challenge doc.
 *
 * THE BACKGROUND
 * --------------
 * Challenges used to be a single hardcoded doc with `id: "challenge_active"`,
 * auto-created in code with a 31-day window and a 100,000 kg target. Nothing
 * ever ended it, so it sat on the Community screen at "0 days left" — and with
 * no `status` field it has no way of saying it is finished.
 *
 * The API now treats a challenge as a normal doc with `type: "challenge"` and a
 * `status` of "active" or "ended", and closes any running challenge whose end
 * date has passed. This backfills the fields the original doc never had, so it
 * survives as the FIRST, now-ended challenge rather than being orphaned — it
 * holds real `joinedBy` members and the history behind their 33.7k.
 *
 * WHY THE ID IS LEFT ALONE
 * ------------------------
 * `challenge_active` is a strange name for an ended challenge, and renaming it
 * was tempting. It is not worth it: the container is partitioned on /id, so a
 * rename means create-new-then-delete-old, and a half-finished run would leave
 * TWO challenge docs where the whole point of this work is that only one runs
 * at a time. Nothing reads that id any more — the API queries on `type` and
 * `status` — so it is now just a historical string. Left as it is, deliberately.
 *
 * WHAT IT WRITES
 * --------------
 * Only the fields that are missing, and only on docs with `type: "challenge"`:
 *
 *   status         "ended" when the end date has passed, else "active"
 *   finalStandings the frozen result, computed from real logs in the window
 *   winnerId/Name  whoever crossed the target, if anyone did
 *   closestId/Name/Kg  the top scorer, so an unwon challenge can say who got closest
 *   endedAt/endedReason  when a doc is being closed
 *
 * It never changes name, prize, targetKg, the dates, or joinedBy, and it never
 * deletes anything. A doc that already has a `status` is left alone entirely,
 * so this is safe to re-run — a second pass finds nothing.
 *
 * It does NOT post a "challenge over" announcement to the feed. The API does
 * that when it closes a challenge itself; doing it here as well would put a
 * result for a July challenge at the top of the feed in September.
 *
 * Usage — from the repo root, with @azure/cosmos installed (`npm install`):
 *
 *     export COSMOS_ENDPOINT="https://<account>.documents.azure.com:443/"
 *     export COSMOS_KEY="<primary key>"
 *
 *     node scripts/migrate-challenge-doc.js            # DRY RUN
 *     node scripts/migrate-challenge-doc.js --apply    # writes
 *
 * Credentials come from the environment only. Nothing is hardcoded here.
 */

const { CosmosClient } = require('@azure/cosmos');

const DATABASE = 'GymsDogs';
const POSTS = 'posts';
const WORKOUTS = 'Workouts';
const USERS = 'users';
const ZONE = process.env.APP_TIME_ZONE || 'Pacific/Auckland';

const APPLY = process.argv.includes('--apply');

// ── Dates ─────────────────────────────────────────────────────────────────

// Local, not UTC. NZ is UTC+12 (+13 in daylight saving), so the UTC date runs a
// day ahead from midday onwards — and "has this challenge finished?" is exactly
// the kind of question that gets the wrong answer from it.
let formatter = null;
try {
  formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  });
} catch (e) {
  formatter = null;
}
const todayISO = () =>
  formatter ? formatter.format(new Date()) : new Date().toISOString().slice(0, 10);

// ── Scoring ───────────────────────────────────────────────────────────────

/** Volume for one logged exercise. Same maths the API uses. */
function volumeOf(setsJson) {
  try {
    const sets = JSON.parse(setsJson || '[]');
    return sets.reduce((s, x) => s + (parseFloat(x.kg) || 0) * (parseInt(x.reps) || 0), 0);
  } catch (e) {
    return 0;
  }
}

/** The standings a challenge finished on: everyone who joined, biggest first. */
function standingsFor(challenge, logs, nameOf) {
  const start = String(challenge.startDate || '');
  const end = String(challenge.endDate || '');
  const vol = {};
  for (const l of logs) {
    const d = String(l.date || '');
    if (!d || d < start || d > end) continue;
    vol[l.userId] = (vol[l.userId] || 0) + volumeOf(l.sets_data);
  }
  return (challenge.joinedBy || [])
    .map((uid) => ({
      userId: uid,
      name: (nameOf[uid] && nameOf[uid].name) || 'Athlete',
      initials: (nameOf[uid] && nameOf[uid].initials) || 'A',
      kg: Math.round(vol[uid] || 0),
    }))
    .sort((a, b) => b.kg - a.kg);
}

/** What the migrated doc should look like. Pure, so it can be checked directly. */
function migrated(challenge, standings, today) {
  const expired = String(challenge.endDate || '') < today;
  const top = standings[0] || null;
  const crossed = standings.filter((p) => p.kg >= Number(challenge.targetKg || 0));
  const winner = crossed.length > 0 ? crossed[0] : null;

  const next = {
    ...challenge,
    status: expired ? 'ended' : 'active',
    finalStandings: standings.slice(0, 10),
    winnerId: winner ? winner.userId : (challenge.winnerId || null),
    winnerName: winner ? winner.name : (challenge.winnerName || null),
    wonAt: winner ? (challenge.wonAt || null) : (challenge.wonAt || null),
    closestId: top ? top.userId : null,
    closestName: top ? top.name : null,
    closestKg: top ? top.kg : 0,
  };
  if (expired) {
    next.endedAt = challenge.endedAt || new Date().toISOString();
    next.endedReason = challenge.endedReason || 'expired (backfilled)';
  }
  return next;
}

// ── Main ──────────────────────────────────────────────────────────────────

async function fetchAll(container, query) {
  const out = [];
  const iterator = container.items.query(query).getAsyncIterator();
  for await (const page of iterator) out.push(...page.resources);
  return out;
}

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
  const db = client.database(DATABASE);
  const postsC = db.container(POSTS);

  const today = todayISO();
  console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} — ${DATABASE}/${POSTS}`);
  console.log(`Today (${ZONE}): ${today}\n`);

  const challenges = await fetchAll(postsC, "SELECT * FROM c WHERE c.type = 'challenge'");
  const candidates = challenges.filter((c) => c.status !== 'active' && c.status !== 'ended');

  console.log(`Challenge docs:        ${challenges.length}`);
  console.log(`Already have a status: ${challenges.length - candidates.length}`);
  console.log(`To migrate:            ${candidates.length}\n`);

  if (candidates.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  const [logs, users] = await Promise.all([
    fetchAll(db.container(WORKOUTS), "SELECT c.userId, c.date, c.sets_data FROM c WHERE c.type = 'log'"),
    fetchAll(db.container(USERS), 'SELECT c.userId, c.name, c.initials FROM c'),
  ]);
  const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const nameOf = {};
  for (const u of users) {
    const ok = u.name && !GUID_RE.test(String(u.name).trim());
    nameOf[u.userId] = { name: ok ? u.name : null, initials: ok ? u.initials : null };
  }

  const plan = candidates.map((c) => {
    const standings = standingsFor(c, logs, nameOf);
    return { doc: c, standings, next: migrated(c, standings, today) };
  });

  for (const { doc, standings, next } of plan) {
    const target = Number(doc.targetKg || 0);
    console.log(`  ${doc.id}  "${doc.name}"`);
    console.log(`    window ${doc.startDate} → ${doc.endDate}   target ${target.toLocaleString()} kg   joined ${(doc.joinedBy || []).length}`);
    console.log(`    status -> ${next.status}`);
    if (next.winnerName) {
      console.log(`    winner -> ${next.winnerName} (${standings[0].kg.toLocaleString()} kg)`);
    } else if (next.closestName) {
      const pct = target > 0 ? Math.round((next.closestKg / target) * 100) : 0;
      console.log(`    no winner — closest ${next.closestName} on ${next.closestKg.toLocaleString()} kg (${pct}% of target)`);
    } else {
      console.log('    no winner — nobody joined or nobody logged');
    }
    const total = standings.reduce((s, p) => s + p.kg, 0);
    console.log(`    field of ${standings.length}, ${total.toLocaleString()} kg between them`);
    if (standings.length) {
      console.log('    top:', standings.slice(0, 3).map((p) => `${p.name} ${p.kg.toLocaleString()}`).join(', '));
    }
    console.log();
  }

  if (!APPLY) {
    console.log(`Dry run — nothing changed. Re-run with --apply to migrate ${plan.length}.`);
    return;
  }

  console.log(`Migrating ${plan.length} doc${plan.length === 1 ? '' : 's'}…\n`);
  let done = 0;
  let failed = 0;
  for (const { doc, next } of plan) {
    try {
      await postsC.items.upsert(next);
      console.log(`  OK    ${doc.id} -> ${next.status}`);
      done++;
    } catch (e) {
      console.error(`  FAIL  ${doc.id} — ${e.message}`);
      failed++;
    }
  }
  console.log(`\nDone. ${done} migrated, ${failed} failed.`);
  if (failed) process.exitCode = 1;
}

// Only connect to anything when actually run. Requiring this file just exposes
// the helpers, so the migration rule can be checked without touching Cosmos.
if (require.main === module) {
  main().catch((e) => {
    console.error(`\nFailed: ${e.message}`);
    process.exit(1);
  });
}

module.exports = { volumeOf, standingsFor, migrated, todayISO };

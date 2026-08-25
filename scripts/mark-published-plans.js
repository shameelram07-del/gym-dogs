/**
 * mark-published-plans.js — one-off backfill for the `published` flag on plans.
 *
 * THE BUG
 * -------
 * `workoutPlans` listed the coach's drafts as "isActive = false and not
 * archived". But publishing a plan DEACTIVATES the one it supersedes, so every
 * retired session came back as a draft. The Coach screen's drafts list filled
 * up with months of finished workouts.
 *
 * The API now writes `published: true` whenever a plan goes live, and the
 * drafts query excludes it. That fixes everything from here on. Documents
 * written before it have no `published` field at all, and this backfills them.
 *
 * WHAT ACTUALLY SEPARATES A DRAFT FROM A RETIRED SESSION
 * -----------------------------------------------------
 * Nothing inside the `plans` container. All twelve inactive plans in
 * production on 25 Aug 2026 carried an identical field set —
 * id, name, tag, date, notes, exercises, isActive, assignedTo, createdAt,
 * coachId — with no trace of having gone out. The publish path never wrote one.
 *
 * It did, however, leave TWO traces in other containers, and this script reads
 * both rather than guessing from age:
 *
 *   1. `posts` — publishing writes a community announcement,
 *      "New session published: {name} ({n} exercises)". This is written on the
 *      publish path ONLY, so a post is proof the plan went out. It is the
 *      stronger signal: it does not depend on anyone having trained.
 *
 *   2. `Workouts` — a member logging sets writes rows carrying `planId`.
 *      Proof the plan went out AND was used. Narrower (a published session
 *      nobody logged has none) but completely unambiguous, since it matches on
 *      id rather than on a name.
 *
 * A plan is marked published when EITHER matches. Neither is a heuristic about
 * age; both are records the publish path itself created.
 *
 * On the production data, all twelve matched a post and eight of those also had
 * logs. Zero genuine never-published drafts existed.
 *
 * If you would rather not trust the traces, `--before=YYYY-MM-DD` ignores them
 * and marks every inactive plan created before that date instead. The two modes
 * are mutually exclusive and the script says which one it is running in.
 *
 * SAFETY
 * ------
 * Only ever ADDS `published: true`. Never clears it, never touches isActive,
 * archived, exercises or anything else, and never deletes. A plan already
 * carrying the flag is skipped, so this is safe to re-run — a second pass finds
 * nothing.
 *
 * Usage — from the repo root, with @azure/cosmos installed (`npm install`):
 *
 *     export COSMOS_ENDPOINT="https://<account>.documents.azure.com:443/"
 *     export COSMOS_KEY="<primary key>"
 *
 *     node scripts/mark-published-plans.js                     # DRY RUN
 *     node scripts/mark-published-plans.js --apply             # writes
 *     node scripts/mark-published-plans.js --before=2026-08-01 # cutoff instead
 *     node scripts/mark-published-plans.js --before=2026-08-01 --apply
 *
 * Credentials come from the environment only. Nothing is hardcoded here.
 */

const { CosmosClient } = require('@azure/cosmos');

const DATABASE = 'GymsDogs';
const PLANS = 'plans';
const POSTS = 'posts';
const WORKOUTS = 'Workouts';

const APPLY = process.argv.includes('--apply');
const BEFORE = (process.argv.find((a) => a.startsWith('--before=')) || '').slice('--before='.length);

// ── Matching ──────────────────────────────────────────────────────────────

// The exact sentence the publish path writes to the community feed. Captures
// the plan name and the exercise count, which together are enough to tell two
// sessions apart even when someone publishes "Walk on your hands" with one
// exercise and "Walk on Your Hands" with two on the same afternoon.
const ANNOUNCEMENT = /New session published:\s*(.*?)\s*\((\d+)\s+exercises?\)/i;

/** Names are compared loosely — trailing spaces and casing vary in real data. */
const normalise = (s) => String(s == null ? '' : s).trim().toLowerCase().replace(/\s+/g, ' ');

const announcementKey = (name, count) => `${normalise(name)}::${count}`;

/** Every {name, count} pair the community feed says was published. */
function publishedKeysFromPosts(posts) {
  const keys = new Set();
  for (const post of posts) {
    const m = ANNOUNCEMENT.exec(String((post && post.text) || ''));
    if (m) keys.add(announcementKey(m[1], Number(m[2])));
  }
  return keys;
}

/** Every planId that somebody has actually logged sets against. */
function planIdsFromLogs(logs) {
  const ids = new Set();
  for (const log of logs) if (log && log.planId) ids.add(String(log.planId));
  return ids;
}

/**
 * Why this plan counts as published — an array of reasons, empty if none.
 * Kept pure so the rule can be read and checked without touching Cosmos.
 */
function evidenceFor(plan, postKeys, loggedIds) {
  const reasons = [];
  const count = Array.isArray(plan.exercises) ? plan.exercises.length : 0;
  if (postKeys.has(announcementKey(plan.name, count))) reasons.push('announced');
  if (loggedIds.has(String(plan.id))) reasons.push('logged');
  return reasons;
}

/** The date a plan is judged on for --before: its session date, else createdAt. */
const planDay = (plan) => String(plan.date || plan.createdAt || '').slice(0, 10);

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
  if (BEFORE && !/^\d{4}-\d{2}-\d{2}$/.test(BEFORE)) {
    console.error(`--before must be YYYY-MM-DD, got "${BEFORE}".`);
    process.exit(1);
  }

  const client = new CosmosClient({ endpoint, key });
  const db = client.database(DATABASE);
  const plansC = db.container(PLANS);

  console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} — ${DATABASE}/${PLANS}`);
  console.log(
    BEFORE
      ? `Mode: CUTOFF — every inactive plan dated before ${BEFORE} is treated as published.`
      : 'Mode: EVIDENCE — a plan counts as published only if the feed announced it or someone logged it.'
  );
  console.log();

  // Only plans that would show in the drafts list are candidates. An active
  // plan gets its flag from the API on its next write; an archived one is gone
  // from the list either way and is left alone.
  const plans = await fetchAll(
    plansC,
    'SELECT * FROM c WHERE c.isActive = false AND (NOT IS_DEFINED(c.archived) OR c.archived = false)'
  );

  let postKeys = new Set();
  let loggedIds = new Set();
  if (!BEFORE) {
    const [posts, logs] = await Promise.all([
      fetchAll(db.container(POSTS), "SELECT c.text FROM c WHERE c.type = 'post'"),
      fetchAll(db.container(WORKOUTS), "SELECT c.planId FROM c WHERE c.type = 'log'"),
    ]);
    postKeys = publishedKeysFromPosts(posts);
    loggedIds = planIdsFromLogs(logs);
    console.log(`Feed announcements: ${postKeys.size} distinct sessions, from ${posts.length} posts`);
    console.log(`Plans with logs:    ${loggedIds.size}, from ${logs.length} log rows`);
    console.log();
  }

  const already = plans.filter((p) => p.published === true);
  const candidates = plans.filter((p) => p.published !== true);

  const decided = candidates.map((plan) => {
    const reasons = BEFORE
      ? (planDay(plan) && planDay(plan) < BEFORE ? [`dated before ${BEFORE}`] : [])
      : evidenceFor(plan, postKeys, loggedIds);
    return { plan, reasons };
  });

  const toMark = decided.filter((d) => d.reasons.length > 0);
  const leftAlone = decided.filter((d) => d.reasons.length === 0);

  // ── Report ──────────────────────────────────────────────────────────────

  console.log(`Inactive, unarchived plans: ${plans.length}`);
  console.log(`Already flagged published:  ${already.length}`);
  console.log(`Will mark published:        ${toMark.length}`);
  console.log(`Left as genuine drafts:     ${leftAlone.length}`);
  console.log();

  if (toMark.length) {
    console.log('TO MARK');
    for (const { plan, reasons } of toMark) {
      const n = Array.isArray(plan.exercises) ? plan.exercises.length : 0;
      console.log(`  ${planDay(plan)}  ${String(plan.name || '(untitled)').slice(0, 30).padEnd(32)} ${String(n).padStart(2)} ex   ${reasons.join(' + ')}`);
    }
    console.log();
  }

  if (leftAlone.length) {
    console.log('LEFT ALONE — these stay in the drafts list');
    for (const { plan } of leftAlone) {
      const n = Array.isArray(plan.exercises) ? plan.exercises.length : 0;
      console.log(`  ${planDay(plan)}  ${String(plan.name || '(untitled)').slice(0, 30).padEnd(32)} ${String(n).padStart(2)} ex`);
    }
    console.log();
  }

  if (toMark.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  if (!APPLY) {
    console.log(`Dry run — nothing changed. Re-run with --apply to flag ${toMark.length}.`);
    return;
  }

  // ── Apply ───────────────────────────────────────────────────────────────

  console.log(`Flagging ${toMark.length} plan${toMark.length === 1 ? '' : 's'}…\n`);
  let done = 0;
  let failed = 0;

  for (const { plan, reasons } of toMark) {
    try {
      // Spread the doc as read and add one field. Nothing else is rewritten —
      // not isActive, not the exercises, not createdAt.
      await plansC.items.upsert({ ...plan, published: true });
      console.log(`  OK    ${plan.id}  ${plan.name || '(untitled)'}  (${reasons.join(' + ')})`);
      done++;
    } catch (e) {
      console.error(`  FAIL  ${plan.id}  ${plan.name || '(untitled)'} — ${e.message}`);
      failed++;
    }
  }

  console.log(`\nDone. ${done} flagged, ${failed} failed.`);
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

module.exports = { ANNOUNCEMENT, normalise, announcementKey, publishedKeysFromPosts, planIdsFromLogs, evidenceFor, planDay };

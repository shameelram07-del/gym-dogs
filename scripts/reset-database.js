/**
 * reset-database.js — wipe the app's data for a fresh start (Nov 2026).
 *
 * Gym Dogs is single-user now, so Shameel asked for a clean database: every
 * workout log, plan, post and profile goes. The containers themselves stay
 * (same names, same partition keys), so the API keeps working untouched.
 *
 * What it KEEPS, in the `users` container: the system docs the backend writes
 * for itself, i.e. timer heartbeats (keepWarm, costReport, ...) and the AI
 * spend-cap ledger. Deleting those would not break anything, but the monthly
 * AI cap would forget what it has already spent. They are recognised by id
 * (heartbeat / budget / aiBudget / spend prefixes) and listed in the dry run,
 * so you can see exactly what stays.
 *
 * Three safety steps, every time:
 *   1. A full BACKUP of every container is written to ./backups/<timestamp>/
 *      before anything else happens (that folder is gitignored).
 *   2. Without --delete it is a DRY RUN: it backs up and reports what it
 *      would delete and what it would keep, and changes nothing.
 *   3. With --delete it asks you to type RESET before it deletes.
 *
 * Usage, from the repo root (PowerShell):
 *
 *     $env:COSMOS_ENDPOINT = "https://gymdogdb.documents.azure.com:443/"
 *     $env:COSMOS_KEY = Read-Host "Cosmos primary key"
 *     node scripts/reset-database.js            # backup + dry run
 *     node scripts/reset-database.js --delete   # backup + delete (asks first)
 *
 * Credentials come from the environment only. Nothing is hardcoded here.
 */

const { CosmosClient } = require('@azure/cosmos');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const DATABASE = 'GymsDogs';
const CONTAINERS = ['Workouts', 'users', 'plans', 'posts'];
const DELETE = process.argv.includes('--delete');

// System docs the backend keeps in `users`. Matched on id, case-insensitive.
const KEEP_ID = /^(heartbeat|budget|aibudget|ai_budget|ai-budget|spend|cost)/i;
const isSystemDoc = (container, doc) => container === 'users' && KEEP_ID.test(String(doc.id || ''));

// Value of the partition key for a doc, given the container's key path
// (e.g. "/userId"). Cosmos needs it to delete an item.
function partitionValue(doc, pkPath) {
  const parts = pkPath.replace(/^\//, '').split('/');
  let v = doc;
  for (const p of parts) v = v == null ? undefined : v[p];
  return v;
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (a) => { rl.close(); resolve(a); }));
}

async function main() {
  const endpoint = process.env.COSMOS_ENDPOINT;
  const key = process.env.COSMOS_KEY;
  if (!endpoint || !key) {
    console.error('COSMOS_ENDPOINT and COSMOS_KEY must both be set. See the top of this file.');
    process.exit(1);
  }

  const db = new CosmosClient({ endpoint, key }).database(DATABASE);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(process.cwd(), 'backups', stamp);
  fs.mkdirSync(backupDir, { recursive: true });

  const plan = [];
  for (const name of CONTAINERS) {
    const container = db.container(name);
    const { resource: def } = await container.read();
    const pkPath = def.partitionKey.paths[0];
    const { resources: docs } = await container.items.query('SELECT * FROM c', { enableCrossPartitionQuery: true }).fetchAll();
    fs.writeFileSync(path.join(backupDir, `${name}.json`), JSON.stringify(docs, null, 1));
    const keep = docs.filter((d) => isSystemDoc(name, d));
    const remove = docs.filter((d) => !isSystemDoc(name, d));
    plan.push({ name, container, pkPath, keep, remove });
  }

  console.log(`\nBackup written to ${backupDir}\n`);
  for (const p of plan) {
    console.log(`${p.name.padEnd(9)} delete ${String(p.remove.length).padStart(4)}   keep ${p.keep.length}`);
    for (const d of p.keep) console.log(`           keeping: ${d.id}`);
  }
  const total = plan.reduce((n, p) => n + p.remove.length, 0);

  if (!DELETE) {
    console.log(`\nDRY RUN: nothing was deleted. ${total} documents would go.`);
    console.log('Run again with --delete to do it.');
    return;
  }
  if (total === 0) { console.log('\nNothing to delete. Already fresh.'); return; }

  const answer = await ask(`\nThis deletes ${total} documents (backup above). Type RESET to continue: `);
  if (answer.trim() !== 'RESET') { console.log('Cancelled. Nothing was deleted.'); return; }

  let deleted = 0, failed = 0;
  for (const p of plan) {
    for (const d of p.remove) {
      try {
        await p.container.item(d.id, partitionValue(d, p.pkPath)).delete();
        deleted++;
      } catch (e) {
        failed++;
        console.error(`  could not delete ${p.name}/${d.id}: ${e.code || ''} ${e.message.split('\n')[0]}`);
      }
    }
    console.log(`${p.name}: done`);
  }
  console.log(`\nDeleted ${deleted}. Failed ${failed}. Backup: ${backupDir}`);
  if (failed) process.exitCode = 1;
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});

/**
 * migrate.js — list every doc in the Workouts container.
 *
 * A read-only inspection tool, despite the name: it prints id, userId and type
 * for each doc and changes nothing.
 *
 * Usage — from the repo root, with @azure/cosmos installed (`npm install`):
 *
 *     export COSMOS_ENDPOINT="https://<account>.documents.azure.com:443/"
 *     export COSMOS_KEY="<primary key>"
 *
 *     node migrate.js
 *
 * Credentials come from the environment only. Nothing is hardcoded here — this
 * file used to carry the endpoint and primary key inline, which is how a live
 * key came to sit in the repo until it was rotated on 25 Aug 2026. Do not put
 * one back; see scripts/fix-log-dates.js for the same pattern.
 */

const { CosmosClient } = require("@azure/cosmos");

const DATABASE = "GymsDogs";
const CONTAINER = "Workouts";

async function check() {
  const endpoint = process.env.COSMOS_ENDPOINT;
  const key = process.env.COSMOS_KEY;
  if (!endpoint || !key) {
    console.error("COSMOS_ENDPOINT and COSMOS_KEY must both be set in the environment.");
    console.error('  export COSMOS_ENDPOINT="https://<account>.documents.azure.com:443/"');
    console.error('  export COSMOS_KEY="<primary key>"');
    process.exit(1);
  }

  const client = new CosmosClient({ endpoint, key });
  const container = client.database(DATABASE).container(CONTAINER);

  const { resources } = await container.items.query(
    "SELECT c.id, c.userId, c.type FROM c",
    { enableCrossPartitionQuery: true }
  ).fetchAll();

  console.log("Total docs: " + resources.length);
  resources.forEach(r => console.log(r.id + " | userId: " + r.userId + " | type: " + r.type));
}

check().catch(function (err) {
  console.log("Error:", err.message);
  process.exit(1);
});

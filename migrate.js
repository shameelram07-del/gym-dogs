const { CosmosClient } = require("@azure/cosmos");

const ENDPOINT = "https://gymdogdb.documents.azure.com:443/";
const KEY = "kpIb7lJ8hV0HHw3mTbcZ7l0TDxzI2mlTFEIDAOehJBOXFNrUJamNAGa3No0LotpUKwqHdrU1k8euACDbwEqeiQ==";

const client = new CosmosClient({ endpoint: ENDPOINT, key: KEY });

async function check() {
  const container = client.database("GymsDogs").container("Workouts");

  const { resources } = await container.items.query(
    "SELECT c.id, c.userId, c.type FROM c",
    { enableCrossPartitionQuery: true }
  ).fetchAll();

  console.log("Total docs: " + resources.length);
  resources.forEach(r => console.log(r.id + " | userId: " + r.userId + " | type: " + r.type));
}

check().catch(function(err) {
  console.log("Error:", err.message);
});
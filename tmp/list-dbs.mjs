import { MongoClient } from 'mongodb';

const uri = "mongodb+srv://aicdbadmin:3dvwtRMZVKLCthEM@cluster0.fogvkhh.mongodb.net/aicoach?retryWrites=true&w=majority&appName=Cluster0";

async function main() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const adminDb = client.db().admin();
    const dbs = await adminDb.listDatabases();
    console.log("All Databases:", dbs.databases.map(d => d.name));
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

main();

/**
 * One-time cleanup script: drops the old B2B system data.
 *
 * Targets:
 *   1. The entire `aicoach_institutional` database
 *   2. The `institutions` collection inside the `aicoach` database
 *
 * Usage:  node src/scripts/drop-old-b2b.mjs
 */

import { MongoClient } from 'mongodb';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../.env') });

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('❌ MONGODB_URI not found in .env');
  process.exit(1);
}

async function main() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    const ts = () => new Date().toISOString();

    // 1. Drop aicoach_institutional database
    console.log(`[${ts()}] Dropping database: aicoach_institutional ...`);
    try {
      await client.db('aicoach_institutional').dropDatabase();
      console.log(`[${ts()}] ✅ Dropped database: aicoach_institutional`);
    } catch (err) {
      console.warn(`[${ts()}] ⚠️  Could not drop aicoach_institutional:`, err.message);
    }

    // 2. Drop institutions collection from aicoach
    console.log(`[${ts()}] Dropping collection: aicoach.institutions ...`);
    try {
      await client.db('aicoach').collection('institutions').drop();
      console.log(`[${ts()}] ✅ Dropped collection: aicoach.institutions`);
    } catch (err) {
      if (err.codeName === 'NamespaceNotFound') {
        console.log(`[${ts()}] ℹ️  Collection aicoach.institutions did not exist — nothing to drop.`);
      } else {
        console.warn(`[${ts()}] ⚠️  Could not drop aicoach.institutions:`, err.message);
      }
    }

    // 3. Verify
    const dbs = await client.db().admin().listDatabases();
    const still = dbs.databases.find(d => d.name === 'aicoach_institutional');
    if (still) {
      console.error(`[${ts()}] ❌ aicoach_institutional still exists!`);
    } else {
      console.log(`[${ts()}] ✅ Verified: aicoach_institutional no longer exists.`);
    }

    const cols = await client.db('aicoach').listCollections({ name: 'institutions' }).toArray();
    if (cols.length > 0) {
      console.error(`[${ts()}] ❌ aicoach.institutions still exists!`);
    } else {
      console.log(`[${ts()}] ✅ Verified: aicoach.institutions collection no longer exists.`);
    }

    console.log(`\n[${ts()}] 🏁 Old B2B teardown complete.`);
  } finally {
    await client.close();
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

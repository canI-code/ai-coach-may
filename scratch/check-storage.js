const { MongoClient } = require('mongodb');

async function listCollections() {
  const uri = "mongodb+srv://aicdbadmin:3dvwtRMZVKLCthEM@cluster0.fogvkhh.mongodb.net/aicoach?retryWrites=true&w=majority&appName=Cluster0";
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db('aicoach');
    
    const collections = await db.listCollections().toArray();
    for (const coll of collections) {
      if (coll.type === 'collection') {
        const stats = await db.command({ collStats: coll.name });
        console.log(`Collection: ${coll.name}, Count: ${stats.count}, AvgSize: ${stats.avgObjSize || 0} bytes`);
      }
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.close();
  }
}

listCollections();

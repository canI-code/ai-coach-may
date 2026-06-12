import { MongoClient } from 'mongodb';

const uri = "mongodb+srv://aicdbadmin:3dvwtRMZVKLCthEM@cluster0.fogvkhh.mongodb.net/aicoach?retryWrites=true&w=majority&appName=Cluster0";

async function main() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('aicoach');
    
    const collections = await db.listCollections().toArray();
    console.log("Collections in aicoach db:", collections.map(c => c.name));
    
    const count = await db.collection('institute_registry').countDocuments();
    console.log("Total institute_registry docs count:", count);
    
    const pending = await db.collection('institute_registry').find({ status: 'pending' }).toArray();
    console.log("Pending B2B requests status:", pending.map(p => ({
      _id: p._id,
      collegeName: p.collegeName,
      status: p.status,
      createdAt: p.createdAt
    })));
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

main();

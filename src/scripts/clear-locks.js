const { MongoClient, ObjectId } = require('mongodb');
const uri = 'mongodb+srv://aicdbadmin:3dvwtRMZVKLCthEM@cluster0.fogvkhh.mongodb.net/aicoach?retryWrites=true&w=majority&appName=Cluster0';

async function clear() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('aicoach');
    
    console.log('--- CLEARING LOCKS ---');
    const res = await db.collection('user_profile').updateMany({}, { 
      $unset: { 
        lastEducationEditAt: "", 
        lastInterestsEditAt: "" 
      } 
    });
    
    console.log(`Successfully cleared lock timestamps for ${res.modifiedCount} profile(s).`);

  } catch (err) {
    console.error('Error updating MongoDB:', err);
  } finally {
    await client.close();
  }
}

clear();

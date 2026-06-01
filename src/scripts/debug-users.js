const { MongoClient, ObjectId } = require('mongodb');
const uri = 'mongodb+srv://aicdbadmin:3dvwtRMZVKLCthEM@cluster0.fogvkhh.mongodb.net/aicoach?retryWrites=true&w=majority&appName=Cluster0';

async function check() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('aicoach');
    
    console.log('--- FETCHING ALL USERS ---');
    const users = await db.collection('users').find({}).toArray();
    
    users.forEach(u => {
      console.log(`User: ${u.fullName}, ID: ${u._id}, Phone: ${u.phone}, Email: ${u.email}`);
    });

    console.log('\n--- FETCHING ALL PROFILES ---');
    const profiles = await db.collection('user_profile').find({}).toArray();
    
    profiles.forEach(p => {
      console.log(`ProfileID: ${p._id}, UserID: ${p.userId}, lastEdu: ${p.lastEducationEditAt}, lastInt: ${p.lastInterestsEditAt}`);
    });

    if (profiles.length === 0) {
      console.log('No profiles found for these users.');
    }

  } catch (err) {
    console.error('Error querying MongoDB:', err);
  } finally {
    await client.close();
  }
}

check();

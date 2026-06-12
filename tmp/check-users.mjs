import { MongoClient } from 'mongodb';

const uri = "mongodb+srv://aicdbadmin:3dvwtRMZVKLCthEM@cluster0.fogvkhh.mongodb.net/aicoach?retryWrites=true&w=majority&appName=Cluster0";

async function main() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('aicoach');
    
    const users = await db.collection('users').find({}).toArray();
    console.log("Users in aicoach db:");
    console.log(users.map(u => ({
      _id: u._id,
      fullName: u.fullName,
      email: u.email,
      phone: u.phone,
      role: u.role,
      sessions: u.sessions
    })));
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

main();

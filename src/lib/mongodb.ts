import { MongoClient, MongoClientOptions } from 'mongodb';

const uri = process.env.MONGODB_URI as string;

// Optimized options for a Next.js development environment
const options: MongoClientOptions = {
  // Conservative pool size for local development
  maxPoolSize: 10,
  // Fail fast in development if the server is not reachable
  serverSelectionTimeoutMS: 5000,
  // Help debug issues by logging more information if needed
  connectTimeoutMS: 10000,
};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (!process.env.MONGODB_URI) {
  // Log a clear error to the console to help the user identify the missing config
  console.error('❌ MONGODB_URI is missing from your environment variables.');
  console.error('Please ensure you have a .env file with MONGODB_URI defined.');
  // We still throw to prevent the app from trying to use an undefined URI
  throw new Error('Please add your Mongo URI to .env');
}

if (process.env.NODE_ENV === 'development') {
  // In development mode, use a global variable so that the value
  // is preserved across module reloads caused by HMR (Hot Module Replacement).
  let globalWithMongo = global as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>;
  };

  if (!globalWithMongo._mongoClientPromise) {
    client = new MongoClient(uri, options);
    globalWithMongo._mongoClientPromise = client.connect()
      .then((client) => {
        console.log('✅ Connected to MongoDB');
        return client;
      })
      .catch((err) => {
        console.error('❌ Failed to connect to MongoDB:', err.message);
        throw err;
      });
  }
  clientPromise = globalWithMongo._mongoClientPromise;
} else {
  // In production mode, it's best to not use a global variable.
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

export default clientPromise;

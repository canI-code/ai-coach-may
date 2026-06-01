/**
 * Seed `interview_questions` with VALIDATED questions for every taxonomy role so the
 * Cache_Seeder fills the pool from the DB (no live LLM generation needed) — lets you
 * test the interview flow now. Re-runnable (clears prior `source:'seed'` docs first).
 *
 * Run:  node src/scripts/seed-interview-questions.mjs
 */
import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const DB_NAME = process.env.MONGODB_DB_NAME || 'aicoach';
const COLLECTION = 'interview_questions';

// Mirrors src/lib/taxonomy.ts (roles the setup UI offers; seeder matches `role` exactly).
const TAXONOMY = {
  'Computer Science': ['Algorithms', 'Data Structures', 'Operating Systems', 'Database Management', 'Computer Networks', 'Software Engineering', 'AI/ML', 'Cybersecurity', 'Cloud Computing', 'System Design'],
  Electronics: ['Digital Electronics', 'Microprocessors', 'Embedded Systems', 'VLSI Design', 'Signal Processing', 'Communication Systems'],
  Management: ['Marketing', 'Finance', 'Human Resources', 'Operations', 'Project Management', 'Entrepreneurship'],
};

// 30 generic interview stems → 30 distinct questions per role, difficulty cycled 1..5
// (covers the 45-min cap of 25 with headroom). Refine later with real content.
const STEMS = [
  'To start, can you give an overview of your experience with {role}?',
  'What are the core concepts every {role} practitioner must understand?',
  'Walk me through a challenging {role} problem you solved and how you approached it.',
  'How do you stay current with developments in {role}?',
  'Explain a key {role} concept as if to a non-technical stakeholder.',
  'What tools or technologies do you rely on most for {role} work, and why?',
  'Describe a time a {role} project did not go as planned. What did you learn?',
  'How do you evaluate trade-offs when making {role} decisions?',
  'What is the most common mistake people make in {role}, and how do you avoid it?',
  'How would you design a solution for a typical {role} scenario from scratch?',
  'Compare two common approaches in {role} and explain when you would use each.',
  'How do you measure success or quality in your {role} work?',
  'Describe how you would debug or troubleshoot a difficult {role} issue.',
  'What scalability or performance considerations matter most in {role}?',
  'How do you collaborate with others on a {role} project?',
  'Tell me about a {role} concept you found difficult to learn and how you mastered it.',
  'What are the security or risk considerations relevant to {role}?',
  'How would you optimize an existing {role} system that is underperforming?',
  'Explain the fundamentals that underpin advanced {role} topics.',
  'What recent trend in {role} excites you the most, and why?',
  'How do you prioritize tasks when working on a complex {role} problem?',
  'Describe the end-to-end lifecycle of a typical {role} project.',
  'What metrics would you track to assess a {role} solution in production?',
  'How do you handle ambiguity or incomplete requirements in {role} work?',
  'Give an example of how you applied {role} knowledge to deliver business value.',
  'What are the limitations of common {role} approaches, and how do you mitigate them?',
  'How would you mentor a junior colleague getting started in {role}?',
  'Describe a situation where you made a {role} decision under time pressure.',
  'What does a robust, production-ready {role} solution look like to you?',
  'How do you validate and test your work in {role}?',
];

function questionsForRole(role) {
  const now = new Date();
  return STEMS.map((stem, i) => ({
    questionText: stem.replaceAll('{role}', role),
    idealAnswer: `A strong answer demonstrates solid ${role} fundamentals, concrete real-world examples, clear trade-off reasoning, and awareness of edge cases. (Seed placeholder — refine later.)`,
    role,
    difficulty: (i % 5) + 1,
    tags: [role, 'fundamentals'],
    status: 'validated',
    is_validated: true,
    source: 'seed',
    createdAt: now,
  }));
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set (.env.local / .env).');

  const client = new MongoClient(uri);
  await client.connect();
  const col = client.db(DB_NAME).collection(COLLECTION);

  await col.createIndex({ role: 1, difficulty: 1, status: 1 });
  await col.createIndex({ status: 1, rejected: 1 });

  const removed = await col.deleteMany({ source: 'seed' });

  const docs = [];
  for (const skills of Object.values(TAXONOMY)) {
    for (const role of skills) docs.push(...questionsForRole(role));
  }
  const res = await col.insertMany(docs);

  const roleCount = Object.values(TAXONOMY).reduce((n, s) => n + s.length, 0);
  console.log(`✅ Removed ${removed.deletedCount} old seed docs; inserted ${res.insertedCount} validated questions across ${roleCount} roles (${STEMS.length} each).`);

  await client.close();
}

main().catch((err) => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});

import { generateRawQuestions } from '../../lib/ai-generator';
import * as dotenv from 'dotenv';
dotenv.config();

async function runGeneratorTest() {
  console.log('🧪 Testing generateRawQuestions with gemini-2.5-flash...');
  try {
    const start = Date.now();
    const questions = await generateRawQuestions('Algorithms', 2, 'Hard');
    const duration = Date.now() - start;
    console.log(`\n✅ Generated successfully in ${duration}ms!`);
    console.log('Resulting Questions:', JSON.stringify(questions, null, 2));
  } catch (e: any) {
    console.error('❌ Generation test failed:', e.message);
  }
}

runGeneratorTest();

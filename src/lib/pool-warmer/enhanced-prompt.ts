/**
 * Maps difficulty to Bloom's Taxonomy cognitive level
 */
export function getBloomLevel(difficulty: 'Easy' | 'Medium' | 'Hard' | 'Expert'): string {
  switch (difficulty) {
    case 'Easy': return 'Remember (tests basic terminology, recall of facts, direct definitions)';
    case 'Medium': return 'Understand & Apply (tests conceptual grasp, simple calculations, basic code trace, connecting 2 concepts)';
    case 'Hard': return 'Analyze (tests multi-step tracing, comparing designs, tracing complex edge cases, identifying bugs)';
    case 'Expert': return 'Evaluate & Create (tests system design trade-offs, architectural limits, optimization critiques, complex scenarios)';
    default: return 'Understand';
  }
}

/**
 * Returns suggested sub-topics based on taxonomy to give the LLM structural focus
 */
export function getSuggestedTopics(interest: string): string[] {
  // Map commonly seen interests to specific subtopics
  const subtopicMap: Record<string, string[]> = {
    'Algorithms': ['Sorting algorithms', 'Search algorithms', 'Dynamic programming', 'Greedy algorithms', 'Divide and conquer', 'Recursion'],
    'Data Structures': ['Arrays', 'Linked Lists', 'Stacks', 'Queues', 'Binary Trees', 'Hash Tables', 'Graphs', 'Heaps'],
    'Operating Systems': ['Processes & Threads', 'Scheduling algorithms', 'Memory management', 'Virtual memory', 'Deadlocks', 'File systems'],
    'Database Management': ['Relational model', 'SQL queries', 'Normalization & 1NF/2NF/3NF', 'Indexing (B-Trees)', 'ACID transactions', 'NoSQL scaling'],
    'Computer Networks': ['TCP/IP model', 'OSI layers', 'IP routing', 'DNS lookup', 'HTTP/HTTPS protocols', 'Sockets'],
    'Software Engineering': ['Design patterns', 'SOLID principles', 'Agile methods', 'Testing strategies', 'System boundaries', 'Git workflow'],
    'AI/ML': ['Supervised learning', 'Neural networks', 'Loss functions', 'Overfitting & Bias', 'Decision trees', 'Clustering'],
    'Cybersecurity': ['Cryptography (AES/RSA)', 'SQL injection', 'XSS attacks', 'Network firewalls', 'OWASP Top 10', 'Access controls'],
    'Cloud Computing': ['IaaS vs PaaS', 'Serverless execution', 'Containers & Docker', 'Virtualization', 'Load balancing', 'Storage systems'],
    'System Design': ['Load balancers', 'Caching strategies', 'Sharding databases', 'Message queues', 'Microservices', 'CDN delivery'],
  };

  return subtopicMap[interest] || [interest.toLowerCase()];
}

export interface PromptArgs {
  interest: string;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Expert';
  count: number;
}

export class EnhancedPromptBuilder {
  /**
   * Generates highly detailed structural prompts for robust, high-quality question generation
   */
  public static buildPrompt({ interest, difficulty, count }: PromptArgs): string {
    const bloom = getBloomLevel(difficulty);
    const subTopics = getSuggestedTopics(interest);
    
    return `You are a professional educational assessment developer and exam author specializing in "${interest}".
Your task is to write exactly ${count} multiple-choice questions (MCQs) for this topic.

DIFFICULTY LEVEL TARGET: "${difficulty}"
COGNITIVE EXPECTATION (Bloom's Taxonomy):
${bloom}

SUGGESTED FOCUS TOPICS (include at least 2 of these inside this batch):
- ${subTopics.join('\n- ')}

STRICT QUESTION SPECIFICATION:
1. Question text should be clear, professional, and grammatically impeccable.
2. Provide exactly 4 choices (a, b, c, d).
3. Distractors (incorrect choices) must be highly plausible, representing common developer/student misconceptions.
4. Distractors must NOT be obviously fake or contain grammatical giveaways.
5. Provide exactly one single clear correct choice.
6. Provide a robust, educational explanation of why the correct answer is right and why other choices are wrong.
7. Tag each question with 1 to 3 specific subtopics.

Strictly output ONLY a JSON array containing exactly ${count} question objects. Do not wrap the JSON in markdown fences, backticks, or write any introductory or concluding text.

JSON Schema format:
[
  {
    "text": "Question text here...",
    "choices": [
      { "id": "a", "text": "Choice A text", "correct": false },
      { "id": "b", "text": "Choice B text", "correct": true },
      { "id": "c", "text": "Choice C text", "correct": false },
      { "id": "d", "text": "Choice D text", "correct": false }
    ],
    "explanation": "High-quality detailed explanation...",
    "topics": ["sorting", "arrays"],
    "bloomLevel": "${difficulty === 'Easy' ? 'Remember' : difficulty === 'Medium' ? 'Understand' : difficulty === 'Hard' ? 'Apply' : 'Analyze'}"
  }
]
`;
  }
}

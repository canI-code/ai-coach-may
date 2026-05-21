import { ObjectId } from 'mongodb';

export type ProficiencyLevel = 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';

export interface Question {
  _id?: ObjectId;
  interest: string;
  text: string;
  choices: {
    id: string;
    text: string;
    correct?: boolean; // Optional on client, required in DB
  }[];
  difficulty: string;
  createdAt: Date;
}

export interface UserAssessmentAttempt {
  _id?: ObjectId;
  userId: ObjectId;
  status: 'draft' | 'completed';
  questionIds: ObjectId[];
  answers: {
    questionId: ObjectId;
    chosenChoiceId: string;
    timeSpentSeconds: number;
    isCorrect?: boolean;
    score?: number;
  }[];
  totalScore?: number;
  scorePercentage?: number;
  levelDetermined?: ProficiencyLevel;
  startedAt: Date;
  completedAt?: Date;
}

export interface UserAssessmentStats {
  _id?: ObjectId;
  userId: ObjectId;
  currentLevel: ProficiencyLevel;
  totalScore: number;
  scorePercentage: number;
  scoreByInterest: Record<string, number>;
  questionsAttempted: number;
  questionsCorrect: number;
  questionsWrong: number;
  questionsSkipped: number;
  averageTimePerQuestion: number;
  lastAssessmentAt: Date;
  attemptId: ObjectId;
}

export interface AIGenerationJob {
  _id?: ObjectId;
  interest: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  resultQuestionIds?: ObjectId[];
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExamSession {
  _id?: ObjectId;
  userId: ObjectId;
  sessionType: 'initial' | 'practice';
  interests: string[];
  questionCount: number;
  status: 'active' | 'completed';
  startedAt: Date;
  completedAt?: Date;
  retakeOf?: ObjectId;
}

export interface ExamAttempt {
  _id?: ObjectId;
  userId: ObjectId;
  sessionId: ObjectId;
  attemptNumber: number;
  questionIds: ObjectId[]; // Array of question IDs in order
  answers: {
    questionId: ObjectId;
    chosenChoiceId: string | 'skipped';
    timeSpentSeconds: number;
    isCorrect?: boolean;
    score?: number;
    difficulty_at_time: string;
  }[];
  totalScore?: number;
  scorePercentage?: number;
  levelAchieved?: ProficiencyLevel;
  inSessionLevelSequence?: string[];
  avgDifficultyAchieved?: number;
  numDifficultyChanges?: number;
  startedAt: Date;
  completedAt?: Date;
}

// ==========================================
// NEW SYSTEM ARCHITECTURE INTERFACES (PHASE 1)
// ==========================================

export interface PoolQuestion {
  _id?: ObjectId;
  text: string;
  choices: {
    id: string;
    text: string;
    correct: boolean;
  }[];
  explanation?: string;
  interest: string;
  domain: string;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Expert';
  difficultyNumeric: number; // 1.0 (Easy) to 4.0 (Expert)
  topics: string[];
  bloomLevel: 'Remember' | 'Understand' | 'Apply' | 'Analyze' | 'Evaluate';
  source: 'curated' | 'ai_generated';
  generationModel?: string;
  contentHash: string; // SHA-256 hash of normalized text for unique identification
  qualityScore: number; // Quality coefficient (0.0 to 1.0)
  timesServed: number;
  timesCorrect: number;
  timesSkipped: number;
  avgTimeToAnswer: number;
  status: 'active' | 'review' | 'retired';
  createdAt: Date;
  lastServedAt: Date;
}

export interface InterestProficiency {
  interest: string;
  abilityRating: number; // Elo scale: 400 - 2400 (starts at 1000)
  ratingConfidence: number; // Confidence factor 0.0 - 1.0
  currentLevel: ProficiencyLevel;
  recentAccuracy: number; // Recent rolling correctness (0.0 - 1.0)
  recentAvgTime: number; // Seconds
  topicStrengths: Record<string, number>; // Tag strengths, e.g. { "sorting": 0.85 }
  lastPracticedAt: Date;
  decayFactor: number; // Decay multiplier (0.5 - 1.0) based on elapsed time
  effectiveRating: number; // abilityRating * decayFactor
  questionsAttempted: number;
  questionsCorrect: number;
}

export interface UserProficiency {
  _id?: ObjectId;
  userId: ObjectId;
  overallLevel: ProficiencyLevel;
  overallConfidence: number;
  interestProfiles: Record<string, InterestProficiency>;
  learningVelocity: number; // Average Elo improvement per session
  consistencyScore: number; // Performance standard deviation metric
  totalQuestionsAttempted: number;
  totalSessionsCompleted: number;
  lastActiveAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface GenerationJob {
  _id?: ObjectId;
  interest: string;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Expert';
  count: number;
  bloomLevel?: 'Remember' | 'Understand' | 'Apply' | 'Analyze' | 'Evaluate';
  topicFocus?: string[];
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'partial';
  priority: number; // 1 (Critical) to 5 (Low/Background)
  triggeredBy: 'cron' | 'event' | 'manual' | 'pool_depleted';
  triggerDetail?: string;
  generatedCount?: number;
  insertedCount?: number;
  duplicatesFound?: number;
  qualityRejected?: number;
  resultQuestionIds?: ObjectId[];
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  retryCount: number;
  maxRetries: number;
  lastError?: string;
}


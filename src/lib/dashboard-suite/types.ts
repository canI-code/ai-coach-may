// Feature: candidate-dashboard-suite
// Presentation DTOs and contracts for the dashboard suite

export type ReportStatus = 'pending' | 'ready' | 'failed' | 'not-found';

export interface ReportStatusResponse {
  status: ReportStatus;
}

export interface CategoryScore {
  label: string;
  value: number;
  maxValue: number;
}

export interface Resource {
  title: string;
  url: string;
  rationale?: string;
}

export interface TimelineEntry {
  tSeconds: number;
  event: string;
}

export interface PerTurnRow {
  turnIndex: number;
  transcript?: string;
  questionText?: string;
  questionOrigin?: 'generated' | 'database' | 'cover';
  evaluation: {
    strengths: string[];
    improvements: string[];
    technicalAccuracy?: number;
    communication?: number;
    voiceCi?: number;
    bodyCi?: number;
  } | null;
}

export interface ReportReadyResponse {
  status: 'ready';
  report: {
    confidenceIndex: number;
    categoryScores: CategoryScore[];
    weaknessTags: string[];
    resources: Resource[];
    resourcesStatus: 'ok' | 'query_failed';
    narrative: string;
    behavioralTimeline: TimelineEntry[];
    perTurnHistory: PerTurnRow[];
    strengths: string[];
    improvements: string[];
  };
}

export interface CiTrendPoint {
  sessionId: string;
  ci: number;
  timestamp: Date;
}

export interface WeaknessTagCount {
  tag: string;
  count: number;
}

export interface DashboardSessionSummary {
  sessionId: string;
  timestamp: Date;
  hasReport: boolean;
  reportLink?: string;
}

export type RecommendationState =
  | { type: 'resources'; resources: Resource[]; nextSteps: string }
  | { type: 'no-weaknesses' }
  | { type: 'no-matched-resources' }
  | { type: 'resource-unavailable' }
  | { type: 'preparing' };

export interface PollState {
  status: 'preparing' | 'ready' | 'failed' | 'still-preparing' | 'status-unavailable';
  shouldPoll: boolean;
  consecutiveFailures: number;
  elapsedPendingMs: number;
}

export type PollEvent =
  | { type: 'pending' | 'not-found'; elapsedMs: number }
  | { type: 'ready' }
  | { type: 'failed' }
  | { type: 'transient-failure' };

export interface ReportPdfModel {
  title: string;
  confidenceIndex: number;
  categoryScores: CategoryScore[];
  weaknessTags: string[];
  resources: Array<{ title: string; url: string }>;
  narrative: string;
}

export type ExportActionState = 'hidden' | 'enabled' | 'in-progress-disabled';

export interface CohortMetrics {
  institutionCode: string;
  candidateCount: number;
  averageCi: number | null;
  skillClusterFrequency: WeaknessTagCount[];
}

export interface ProfilePayload {
  personalDetails: {
    name: string;
    email: string;
  };
  interviewPreferences: {
    persona: string;
    difficulty: number;
  };
  institutionCode: string | null;
  notificationPreferences: {
    emailNotifications: boolean;
  };
  cumulativeStats: {
    averageCi: number | null;
    bestCi: number | null;
  };
}

export interface ProfileUpdate {
  name?: string;
  email?: string;
  persona?: string;
  difficulty?: number;
  institutionCode?: string | null;
  emailNotifications?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
  validatedFields: Partial<ProfileUpdate>;
}

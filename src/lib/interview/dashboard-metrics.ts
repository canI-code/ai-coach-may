/**
 * Dashboard metrics — pure aggregation of interview performance for the b2c dashboard.
 *
 * Aggregates `coaching_reports` + `interview_sessions` into the `DashboardMetrics` DTO
 * the dashboard renders. All functions here are PURE (plain inputs → DTO), so the route
 * (`/api/interview/dashboard`) maps DB docs into the `ReportInput`/`SessionInput` shapes
 * and calls `computeDashboardMetrics`. This keeps the math unit/property-testable with
 * no DB.
 *
 * Shared contract: UI chart/panel components and the route all import TYPES from this
 * file. Do not import React/DB here — it must stay environment-agnostic.
 */

// ── Shared value types ────────────────────────────────────────────────────────

export interface CategoryScores {
  technicalAccuracy: number;
  communication: number;
  voiceCi: number;
  bodyCi: number;
}

export interface DashboardResource {
  id: string;
  title: string;
  url: string;
  tags: string[];
}

export interface CiTrendPoint {
  /** ISO timestamp of the report. */
  date: string;
  /** CI score 0..100 at that point. */
  ciScore: number;
  /** Short display label, e.g. "May 31". */
  label: string;
}

export type SessionStatusValue = 'seeding' | 'active' | 'completed' | 'abandoned';

export interface DashboardSessionSummary {
  sessionId: string;
  role: string;
  ciScore: number | null;
  status: SessionStatusValue;
  reportId: string | null;
  createdAt: string;
  durationMinutes: number | null;
  categoryScores?: CategoryScores | null;
}

export interface WeaknessTagCount {
  tag: string;
  count: number;
}

/** The full dashboard payload returned by `/api/interview/dashboard`. */
export interface DashboardMetrics {
  /** Latest ready report's CI, or null when there are no ready reports. */
  confidenceIndex: number | null;
  /** Latest CI minus the previous report's CI; null when < 2 reports. */
  confidenceTrend: number | null;
  /** Average CI across all ready reports; null when none. */
  averageCi: number | null;
  /** Best (highest) CI across all ready reports; null when none. */
  bestCi: number | null;
  totalSessions: number;
  sessionsThisWeek: number;
  avgDurationMinutes: number | null;
  /** Consecutive-day streak of interview activity ending today. */
  streakDays: number;
  /** Longest streak of interview activity. */
  longestStreak: number;
  /** Mean of each category across ready reports; null when none. */
  categoryAverages: CategoryScores | null;
  /** Chronological CI points (oldest → newest) for the trend chart. */
  ciTrend: CiTrendPoint[];
  /** Most frequent weakness tags across ready reports, descending. */
  topWeaknessTags: WeaknessTagCount[];
  /** Most recent sessions (newest first), capped. */
  recentSessions: DashboardSessionSummary[];
  /** Deduped resources from recent ready reports, capped. */
  recommendedResources: DashboardResource[];
  /** False when the candidate has no interview history yet (drives empty state). */
  hasData: boolean;
}

// ── Pure aggregation inputs (DB-doc-agnostic) ─────────────────────────────────

export interface ReportInput {
  sessionId: string;
  reportId: string;
  ciScore: number;
  categoryScores: CategoryScores;
  weaknessTags: string[];
  resources: DashboardResource[];
  /** ISO; when the report became ready (preferred ordering key). */
  readyAt: string | null;
  /** ISO; report creation time (fallback ordering key). */
  createdAt: string;
}

export interface SessionInput {
  sessionId: string;
  role: string;
  status: SessionStatusValue;
  reportId: string | null;
  /** ISO; session start. */
  createdAt: string;
  /** ISO; session end (updatedAt / last turn) for duration; null if unknown. */
  endedAt: string | null;
}

export interface ComputeOptions {
  /** Cap for recentSessions (default 6). */
  recentLimit?: number;
  /** Cap for ciTrend points (default 10). */
  trendLimit?: number;
  /** Cap for topWeaknessTags (default 5). */
  weaknessLimit?: number;
  /** Cap for recommendedResources (default 5). */
  resourceLimit?: number;
}

// ── Internal date helpers (pure) ──────────────────────────────────────────────

/** Parse an ISO string to epoch ms, or null when missing/invalid. */
function toTimeOrNull(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

/** Ordering key for a report: prefer readyAt, fall back to createdAt, else epoch. */
function reportOrderTime(r: ReportInput): number {
  const ready = toTimeOrNull(r.readyAt);
  if (ready !== null) return ready;
  const created = toTimeOrNull(r.createdAt);
  return created !== null ? created : 0;
}

/** Ordering key for a session by createdAt; invalid dates sort to epoch. */
function sessionOrderTime(s: SessionInput): number {
  const t = toTimeOrNull(s.createdAt);
  return t !== null ? t : 0;
}

/**
 * Duration of a session in minutes, or null when it cannot be trusted:
 * missing/invalid endedAt or createdAt, negative spans, or implausible
 * (> 180 min) spans. Used by both the average and per-session summaries.
 */
function sessionDurationMinutes(createdAt: string, endedAt: string | null): number | null {
  if (!endedAt) return null;
  const start = toTimeOrNull(createdAt);
  const end = toTimeOrNull(endedAt);
  if (start === null || end === null) return null;
  const minutes = (end - start) / 60000;
  if (minutes < 0 || minutes > 180) return null;
  return Math.round(minutes * 1000) / 1000;
}

/** Local calendar-day key (year-month-day) for streak bucketing. */
function calendarDayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

// ── Pure aggregation helpers (exported for unit/property tests) ───────────────

/**
 * Element-wise mean of each category across reports. Returns null for an empty
 * list. Given inputs in [0,100], every field stays within [0,100].
 */
export function meanCategoryScores(reports: ReportInput[]): CategoryScores | null {
  if (!reports || reports.length === 0) return null;

  let technicalAccuracy = 0;
  let communication = 0;
  let voiceCi = 0;
  let bodyCi = 0;

  for (const r of reports) {
    technicalAccuracy += r.categoryScores.technicalAccuracy;
    communication += r.categoryScores.communication;
    voiceCi += r.categoryScores.voiceCi;
    bodyCi += r.categoryScores.bodyCi;
  }

  const n = reports.length;
  return {
    technicalAccuracy: Math.round((technicalAccuracy / n) * 1000) / 1000,
    communication: Math.round((communication / n) * 1000) / 1000,
    voiceCi: Math.round((voiceCi / n) * 1000) / 1000,
    bodyCi: Math.round((bodyCi / n) * 1000) / 1000,
  };
}

/**
 * Count of consecutive calendar days with at least one session, ending today
 * (or yesterday) relative to `now`. Returns 0 when there is no activity today
 * or yesterday. Invalid dates are skipped. Does not mutate `now`.
 */
export function computeStreakDays(sessionDates: Date[], now: Date): number {
  const days = new Set<string>();
  for (const d of sessionDates) {
    if (d instanceof Date && !Number.isNaN(d.getTime())) {
      days.add(calendarDayKey(d));
    }
  }
  if (days.size === 0) return 0;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  let cursor: Date;
  if (days.has(calendarDayKey(today))) {
    cursor = today;
  } else if (days.has(calendarDayKey(yesterday))) {
    cursor = yesterday;
  } else {
    return 0;
  }

  let streak = 0;
  while (days.has(calendarDayKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/**
 * Count the longest consecutive-day streak of interview activity.
 */
export function computeLongestStreakDays(sessionDates: Date[]): number {
  const days = new Set<string>();
  for (const d of sessionDates) {
    if (d instanceof Date && !Number.isNaN(d.getTime())) {
      days.add(calendarDayKey(d));
    }
  }
  if (days.size === 0) return 0;

  const uniqueDates = Array.from(days).map(dayStr => {
    const [y, m, d] = dayStr.split('-').map(Number);
    return new Date(y, m, d);
  });
  uniqueDates.sort((a, b) => a.getTime() - b.getTime());

  let longestStreak = 0;
  let currentStreak = 0;
  let prevTime: number | null = null;

  for (const d of uniqueDates) {
    const time = d.getTime();
    if (prevTime === null) {
      currentStreak = 1;
    } else {
      const diffDays = Math.round((time - prevTime) / (24 * 60 * 60 * 1000));
      if (diffDays === 1) {
        currentStreak++;
      } else if (diffDays > 1) {
        if (currentStreak > longestStreak) {
          longestStreak = currentStreak;
        }
        currentStreak = 1;
      }
    }
    prevTime = time;
  }

  if (currentStreak > longestStreak) {
    longestStreak = currentStreak;
  }

  return longestStreak;
}

/**
 * Chronological CI trend points (oldest → newest) ordered by readyAt (fallback
 * createdAt), keeping only the last `limit` points. Labels render like "May 31".
 */
export function buildCiTrend(reports: ReportInput[], limit: number): CiTrendPoint[] {
  if (!reports || reports.length === 0 || limit <= 0) return [];

  const sorted = [...reports].sort((a, b) => {
    const timeDiff = reportOrderTime(a) - reportOrderTime(b);
    if (timeDiff !== 0) return timeDiff;
    return a.sessionId.localeCompare(b.sessionId);
  });
  const start = Math.max(0, sorted.length - limit);

  return sorted.slice(start).map((r) => {
    const t = reportOrderTime(r);
    const d = new Date(t);
    return {
      date: d.toISOString(),
      ciScore: Math.round(r.ciScore * 1000) / 1000,
      label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    };
  });
}

/**
 * Frequency of weakness tags across all reports, sorted by count (desc) then
 * tag (alphabetical), capped at `limit`.
 */
export function countWeaknessTags(reports: ReportInput[], limit: number): WeaknessTagCount[] {
  if (!reports || reports.length === 0 || limit <= 0) return [];

  const counts = new Map<string, number>();
  for (const r of reports) {
    const tags = r.weaknessTags ?? [];
    for (const tag of tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  const result: WeaknessTagCount[] = [];
  for (const [tag, count] of counts) {
    result.push({ tag, count });
  }
  result.sort((a, b) => (b.count - a.count) || a.tag.localeCompare(b.tag));
  return result.slice(0, limit);
}

// ── Top-level dashboard aggregation ───────────────────────────────────────────

/**
 * Aggregate already-ready `reports` and `sessions` into the `DashboardMetrics`
 * DTO. Pure: no DB, no React, no `Date.now()` — all "now"-relative math uses the
 * passed `now`. Tolerates empty arrays and invalid date strings.
 */
export function computeDashboardMetrics(
  reports: ReportInput[],
  sessions: SessionInput[],
  now: Date,
  opts?: ComputeOptions,
): DashboardMetrics {
  const safeReports = reports ?? [];
  const safeSessions = sessions ?? [];

  const recentLimit = opts?.recentLimit ?? 6;
  const trendLimit = opts?.trendLimit ?? 10;
  const weaknessLimit = opts?.weaknessLimit ?? 5;
  const resourceLimit = opts?.resourceLimit ?? 5;

  // Confidence index + trend from the two most recent reports.
  const reportsAsc = [...safeReports].sort((a, b) => {
    const timeDiff = reportOrderTime(a) - reportOrderTime(b);
    if (timeDiff !== 0) return timeDiff;
    return a.sessionId.localeCompare(b.sessionId);
  });
  const latest = reportsAsc.length > 0 ? reportsAsc[reportsAsc.length - 1] : null;
  const previous = reportsAsc.length >= 2 ? reportsAsc[reportsAsc.length - 2] : null;
  const confidenceIndex = latest ? Math.round(latest.ciScore * 1000) / 1000 : null;
  const confidenceTrend =
    latest && previous ? Math.round(latest.ciScore - previous.ciScore) : null;

  // Session counts.
  const totalSessions = safeSessions.length;
  const nowMs = now.getTime();
  const weekAgoMs = nowMs - 7 * 24 * 60 * 60 * 1000;
  let sessionsThisWeek = 0;
  for (const s of safeSessions) {
    const t = toTimeOrNull(s.createdAt);
    if (t !== null && t >= weekAgoMs && t <= nowMs) sessionsThisWeek++;
  }

  // Average duration over sessions with a trustworthy span.
  let durationSum = 0;
  let durationCount = 0;
  for (const s of safeSessions) {
    const m = sessionDurationMinutes(s.createdAt, s.endedAt);
    if (m !== null) {
      durationSum += m;
      durationCount++;
    }
  }
  const avgDurationMinutes =
    durationCount > 0 ? Math.round((durationSum / durationCount) * 10) / 10 : null;

  // Streak over session start dates.
  const streakDays = computeStreakDays(
    safeSessions.map((s) => new Date(s.createdAt)),
    now,
  );
  const longestStreak = computeLongestStreakDays(
    safeSessions.map((s) => new Date(s.createdAt)),
  );

  const categoryAverages = meanCategoryScores(safeReports);
  const ciTrend = buildCiTrend(safeReports, trendLimit);
  const topWeaknessTags = countWeaknessTags(safeReports, weaknessLimit);

  // Report lookups for matching sessions → ciScore (by reportId, then sessionId).
  const reportById = new Map<string, ReportInput>();
  const reportBySessionId = new Map<string, ReportInput>();
  for (const r of safeReports) {
    if (r.reportId) reportById.set(r.reportId, r);
    if (r.sessionId) reportBySessionId.set(r.sessionId, r);
  }
  const findReportForSession = (s: SessionInput): ReportInput | null => {
    if (s.reportId) {
      const byId = reportById.get(s.reportId);
      if (byId) return byId;
    }
    const bySession = reportBySessionId.get(s.sessionId);
    return bySession ?? null;
  };

  const recentSessions: DashboardSessionSummary[] = [...safeSessions]
    .sort((a, b) => {
      const timeDiff = sessionOrderTime(b) - sessionOrderTime(a);
      if (timeDiff !== 0) return timeDiff;
      return b.sessionId.localeCompare(a.sessionId);
    })
    .slice(0, recentLimit)
    .map((s) => {
      const rep = findReportForSession(s);
      return {
        sessionId: s.sessionId,
        role: s.role,
        ciScore: rep ? Math.round(rep.ciScore * 1000) / 1000 : null,
        status: s.status,
        reportId: rep ? rep.reportId : null,
        createdAt: s.createdAt,
        durationMinutes: sessionDurationMinutes(s.createdAt, s.endedAt),
        categoryScores: rep ? rep.categoryScores : null,
      };
    });

  // Recommended resources: dedupe by id across the most recent reports.
  const reportsDesc = [...safeReports].sort((a, b) => {
    const timeDiff = reportOrderTime(b) - reportOrderTime(a);
    if (timeDiff !== 0) return timeDiff;
    return b.sessionId.localeCompare(a.sessionId);
  });
  const seenResourceIds = new Set<string>();
  const recommendedResources: DashboardResource[] = [];
  for (const r of reportsDesc) {
    if (recommendedResources.length >= resourceLimit) break;
    const resources = r.resources ?? [];
    for (const res of resources) {
      if (recommendedResources.length >= resourceLimit) break;
      if (res && res.id && !seenResourceIds.has(res.id)) {
        seenResourceIds.add(res.id);
        recommendedResources.push(res);
      }
    }
  }

  const averageCi = safeReports.length > 0
    ? Math.round((safeReports.reduce((sum, r) => sum + r.ciScore, 0) / safeReports.length) * 1000) / 1000
    : null;
  const bestCi = safeReports.length > 0
    ? Math.round(Math.max(...safeReports.map(r => r.ciScore)) * 1000) / 1000
    : null;

  return {
    confidenceIndex,
    confidenceTrend,
    averageCi,
    bestCi,
    totalSessions,
    sessionsThisWeek,
    avgDurationMinutes,
    streakDays,
    longestStreak,
    categoryAverages,
    ciTrend,
    topWeaknessTags,
    recentSessions,
    recommendedResources,
    hasData: safeSessions.length > 0,
  };
}

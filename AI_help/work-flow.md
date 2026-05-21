## Student Entry Flow — Machine-Readable Spec

TL;DR
Convert the FigJam onboarding chunk (start → B2C student → login/signup → profile → dashboard) into REST endpoints, DB events, state transitions, and minimal JSON schemas so any AI model can implement the backend.

Flow Overview (high-level sequence)
1. Start → Select `B2C_STUDENT` role
2. UI: show `Login` screen
3. Decision: Does user have an account?
   - Yes → Login (phone) → OTP flow
   - No  → Signup flow
4. Signup Flow:
   - Collect phone number → POST `/api/auth/signup-phone` (returns pendingOtpId)
   - Send OTP (dev: fake OTP allowed) → POST `/api/auth/otp/send`
   - Verify OTP → POST `/api/auth/otp/verify` (on success create user basic record)
   - On OTP success: collect `fullName`, `dob` → PATCH `/api/students/profile/basic`
   - Assign user state `REGISTERED` + return auth token
5. After login/registration → Redirect to `Dashboard` (GET `/api/students/dashboard`)
6. Dashboard checks profile completion:
   - If incomplete → show profile completion modal/CTA
   - If complete → show full dashboard
7. Profile Completion Flow (repeatable until complete):
   - Username (mandatory): PATCH `/api/students/profile/username` → POST `/api/auth/username-verify`
   - Education details (mandatory): degree, course, current marks → PATCH `/api/students/profile/education`
   - Interests (mandatory): choose 1 main field + minimum 3 interests → PATCH `/api/students/profile/interests`
   - On each successful sub-step, evaluate completeness; when all mandatory fields complete, mark profile `PROFILE_COMPLETE` and emit `profile:completed` event
8. Persist final profile in `user_profile` collection; user ready for practice sessions and MCQ tests

State Machine (user onboarding)
- ANONYMOUS (no account)
- AWAITING_OTP (phone submitted, awaiting verification)
- REGISTERED (phone verified; basic user record created; basic profile fields filled)
- PROFILE_INCOMPLETE (needs username, education, interests)
- PROFILE_COMPLETE (all mandatory fields filled; ready for full dashboard + practice)
- ACTIVE (actively using platform)

Primary Collections (DB)
- `users` — { _id: ObjectId, phone: string (unique, indexed), role: 'student'|'mentor'|'admin', state: string (enum above), createdAt: date, updatedAt: date }
- `user_profile` — { _id: ObjectId, userId: ObjectId (ref users._id, unique, indexed), fullName: string, dob: date, username: string (unique, indexed), avatarUrl?: string, education: { degree: string, course: string, currentMarks: string }, mainField: string, interests: string[], completed: boolean, completedAt?: date, createdAt: date, updatedAt: date }
- `otps` — { _id: ObjectId, userId?: ObjectId, phone: string, code: string, expiresAt: date, attempts: number, verified: boolean, createdAt: date }

Key REST Endpoints (implementation-ready)
- POST `/api/auth/signup-phone`
  - payload: { phone: string }
  - response: { pendingOtpId: ObjectId }
  - action: create or find user by phone; create OTP record; enqueue send-otp job
  
- POST `/api/auth/otp/verify`
  - payload: { pendingOtpId: ObjectId, code: string }
  - response: { userId: ObjectId, token: string, state: string }
  - action: verify OTP, mark `otps.verified=true`, create/update `users` record if new, return session token
  
- PATCH `/api/students/profile/basic`
  - auth required (bearer token)
  - payload: { fullName: string, dob: string (YYYY-MM-DD) }
  - response: { profile: {...} }
  - action: update or create `user_profile` with basic info; set state to `PROFILE_INCOMPLETE`
  
- PATCH `/api/students/profile/username`
  - auth required
  - payload: { username: string }
  - validation: username alphanumeric + underscore, 3-20 chars, unique across users
  - response: { username: string, verified: boolean }
  - action: check uniqueness; if valid, update `user_profile.username`
  
- PATCH `/api/students/profile/education`
  - auth required
  - payload: { degree: string, course: string, currentMarks: string }
  - response: { profile: {...} }
  
- PATCH `/api/students/profile/interests`
  - auth required
  - payload: { mainField: string, interests: string[] }
  - validation: `interests.length >= 3`, `mainField` must be one of allowed taxonomy
  - response: { profile: {...} }
  - action: on success, check if `completed` flag should be set to true (username + education + interests all filled)
  
- GET `/api/students/dashboard`
  - auth required
  - response: { profile: {...}, completionStatus: { isComplete: boolean, pendingFields: string[] }, metrics: {...}, suggestedPractice: [...] }
  - action: return aggregated user data for dashboard widget population

Events & Background Jobs
- send-otp job: deliver OTP (dev: return code in response or log)
- profile-completion-checker: on profile update compute `completed` flag and emit `profile:completed` event
- email-verification job: send verification email

Validation & Security Notes
- OTP attempts limit (e.g., max 5); expire after X minutes; rate-limit `signup-phone` per IP/phone
- Ensure idempotency keys on OTP requests for safe retries
- Store DOB but mark as sensitive; require consent for sharing
- Development mode: fake OTP allowed; production: hook to SMS/email provider

Minimal JSON Schemas (examples)
- `user_profile` (submitted fields):
  - fullName: string (required)
  - dob: string (ISO date, required)
  - degree?: string
  - course?: string
  - currentMarks?: string
  - mainField?: string
  - interests?: array<string> (minItems 3)

APIs: sample payloads
- POST `/api/auth/signup-phone` { "phone": "+911234567890" }
- POST `/api/auth/otp/verify` { "pendingOtpId": "abc123", "code": "0000" }
- PATCH `/api/students/profile/interests` { "mainField": "Computer Science", "interests": ["Algorithms","System Design","ML"] }

Developer Notes
- Reuse existing `getCurrentUser()` auth helper and cookie/session pattern.
- Store `user_profile` separate from `users` to allow lighter auth queries.
- Emit simple events (e.g., `user.created`, `profile.updated`) for workers to pick up.

Decisions & Clarifications
- **ID type**: Use MongoDB ObjectId throughout.
- **Username**: Mandatory but set AFTER signup/initial login. Username entry is first profile completion step.
- **Plan types**: Deferred. For MVP, all users have full access to all features (no tier restrictions).
- **Signup flow**: Phone-only (no email during signup).
- **Profile completion**: Username + Education + Interests are all mandatory; each has its own PATCH endpoint.

Open Questions
1. Should username be case-insensitive or case-sensitive for uniqueness?
2. Do we need to normalize/slugify usernames or keep as-is?
3. For interests taxonomy: is it a flat list, hierarchical, or free-form strings from the client?
4. Should email be added to `users` collection in a later flow, or defer email entirely for MVP?

---

## Initial Assessment Flow — Machine-Readable Spec

**Trigger**
After profile completion (username + education + interests), user is redirected to initial assessment before accessing main dashboard. This is mandatory and one-time only. Purpose: determine user's initial proficiency level and prevent starting from zero despite existing expertise.

**Flow Overview**
1. User completes profile (username, education, interests)
2. System triggers assessment prep: `POST /api/students/assessment/prepare`
   - For each selected interest: fetch 4 questions
   - Use tiered question source: Non-AI QS → AI QS → AI Prompting
   - AI prompting runs queue-with-timeout (async-first, sync-fallback) to avoid blocking
3. Once all 4N questions are ready, user is presented with assessment UI
4. User answers questions: `POST /api/students/assessment/submit-answer` (per question or batch)
5. On final submission: `POST /api/students/assessment/complete`
   - Compute score with time-bonus formula
   - Determine proficiency level (Beginner | Intermediate | Advanced | Expert)
   - Store results in `user_assessment_stats` and update user state to `PROFILE_COMPLETE`
   - Emit `assessment:completed` event
6. Redirect to dashboard; all features unlocked

**Assessment Parameters**
- Questions per interest: 4
- Total questions: 4 × (number of selected interests)
- Time limit per question: none (but time is tracked for scoring bonus)
- Retakes: NO (one-time only for initial assessment; later assessments allow unlimited retakes)

**Scoring & Time Bonus Formula**
- Base points per question: 1.0 (if correct)
- Time bonus multiplier: `multiplier = 1.0 - (timeSpentSeconds / maxTimeSeconds)`
  - Example: if max time is 120s and user takes 60s, multiplier = 1.0 - (60/120) = 0.5
  - Final points = basePoints × multiplier (capped at 0.0, max 1.0 per question)
  - Wrong/Skipped: 0 points (no deduction)
  - Round to 2 decimal places
- Total score: sum of all question scores
- Score percentage: (totalScore / maxPossibleScore) × 100

**Proficiency Levels (score-based tiers)**
- Beginner: 0–30% (needs foundational learning)
- Intermediate: 31–65% (competent but gaps remain)
- Advanced: 66–85% (strong fundamentals, ready for interviews)
- Expert: 86–100% (exceptional; can mentor others)

**Question Source Logic (tiered fetch, pre-exam)**
1. For each interest, query Non-AI QS collection (static questions)
2. If insufficient questions (< 4), query AI QS collection
3. If still insufficient, invoke AI prompting via queue-with-timeout:
   - Async: spawn AI job to generate questions + store in AI QS
   - Timeout: if generation takes > X seconds, return cached/fallback question
   - Once AI job completes, add to AI QS collection for reuse
4. Fetch all questions BEFORE test starts (assessment prep phase) to avoid exam lag

**Primary Collections (new/updated)**
- `questions_non_ai` — { _id: ObjectId, interest: string, text: string, choices: [{id, text, correct: bool}], difficulty: string, tags: [], createdAt }
- `questions_ai` — { _id: ObjectId, interest: string, text: string, choices: [{id, text, correct: bool}], difficulty: string, generatedAt: date, aiModel: string, createdAt }
- `user_assessment_attempts` — { _id: ObjectId, userId: ObjectId, attemptNumber: 1 (always 1 for initial), questionIds: [ObjectId], answers: [{questionId, chosenChoice, timeSpentSeconds}], totalScore: number, scorePercentage: number, levelDetermined: string, completedAt: date, createdAt: date }
- `user_assessment_stats` — { _id: ObjectId, userId: ObjectId, currentLevel: string (Beginner|Intermediate|Advanced|Expert), totalScore: number, scorePercentage: number, scoreByInterest: {interest: score}, questionsAttempted: number, questionsCorrect: number, questionsWrong: number, questionsSkipped: number, averageTimePerQuestion: number, lastAssessmentAt: date, attemptId: ObjectId (ref user_assessment_attempts._id) }

**REST Endpoints**
- POST `/api/students/assessment/prepare`
  - auth required
  - payload: { } (uses profile.interests)
  - response: { assessmentId, questionCount, questions: [{ _id, text, choices: [{id, text}] }] }
  - action: fetch/generate questions, enqueue AI jobs if needed, return assessment session

- POST `/api/students/assessment/submit-answer`
  - auth required
  - payload: { assessmentId, questionId, chosenChoiceId, timeSpentSeconds }
  - response: { received: true }
  - action: store answer in temporary session (not final scoring yet)

- POST `/api/students/assessment/complete`
  - auth required
  - payload: { assessmentId }
  - response: { levelDetermined, scorePercentage, stats: {...} }
  - action: finalize answers, compute score + time bonuses, determine level, persist in user_assessment_stats, emit event

- GET `/api/students/assessment/status`
  - auth required
  - response: { canRetake: false, completedAt: date, levelDetermined: string, scorePercentage: number } (or 404 if not taken)

**Background Jobs**
- `ai-question-generation-job` — Given an interest + difficulty, call LLM to generate 1-4 questions, store in AI QS collection, mark as ready
- `queue-with-timeout-orchestrator` — Manage queued AI jobs; return fallback/cached question if timeout exceeded

**Validation & Security Notes**
- Rate-limit question generation (e.g., max 10 parallel jobs) to control LLM costs
- Time spent is logged per question; cap unreasonable values (e.g., if > 1800s, flag as suspicious)
- One-time assessment: ensure endpoint rejects retakes with `error: 'assessment_already_taken'`
- Store all answers immutably; do not allow updates after submission

**Events Emitted**
- `assessment:prepared` — questions ready, assessment session created
- `assessment:submitted` — individual answer received
- `assessment:completed` — scoring done, level determined, stats stored
- `user:level_determined` — user promoted to proficiency level

**Developer Notes**
- Reuse auth token from earlier signup flow
- Use transactional writes when persisting assessment results + updating user state
- Pre-fetch all questions in `prepare` phase (batched DB query) to minimize exam-time latency
- AI prompting should be logged (which questions were generated, by which model, cost)

**Next Actions (after user approval)**
- Generate OpenAPI spec (YAML) with full endpoint contracts + JSON schemas
- Create MongoDB migration script (collections + indexes)
- Produce endpoint handler stubs (TypeScript)
- Design AI prompting template/prompt + LLM integration
- Generate seed data: initial Non-AI QS bank across interests
- Create integration test: full profile → assessment prep → submit → complete flow

---

## Dashboard & Practice Exam Flow — Machine-Readable Spec

**Trigger**
After initial assessment completes and user level is determined, user is redirected to main dashboard. Dashboard shows:
- Exam (practice sessions + history)
- Interview (deferred, placeholder)
- Report (full analytics)
- Recommendation (deferred, placeholder)
- Profile (user settings)

**Entry Point Logic**
- If `new-user` (just completed initial assessment): show instant report card, then "Full report" page
- If existing user: show dashboard with exam history + recommendation widgets

**Exam History & Retake Behavior**
1. User views exam history (all past attempts including initial assessment)
2. Per attempt, show: date, score%, level achieved, duration, question count
3. Retake button behavior:
   - DISABLED for initial assessment (locked forever)
   - ENABLED for all practice exam sessions (retake up to 2 times per day)
4. Retake generates new attempt record (keeps history, does not replace)

**Practice Exam Session Creation & Adaptive Difficulty**
1. User creates NEW exam session: `POST /api/students/exam/session/create`
   - Select interests (subset of profile interests)
   - Select question count (10–30, default ~20)
   - System auto-fetches user's current `overall_level` from stats
   - System starts session at that level
2. User answers questions: `POST /api/students/exam/session/:sessionId/answer` (per question)
3. **Adaptive Difficulty During Session**:
   - Difficulty adjusts after every 20–30% of questions (checkpoint)
   - Example: 20 Qs → adjust every 4–6 Qs; 30 Qs → adjust every 6–9 Qs
   - Threshold: if accuracy_since_last_checkpoint >= 75% → promote difficulty; if < 50% → demote; else stay
   - In-session level updates; overall level does NOT change until session completes
4. User completes session: `POST /api/students/exam/session/:sessionId/complete`
   - Compute final score (accuracy% + time bonus + difficulty weighting)
   - Calculate final in-session average difficulty achieved
   - Determine new overall level based on (average_difficulty + accuracy%)
   - Persist all tracking data
   - Emit `exam:completed` event
5. Retakes use same logic: fresh questions (mix of same+new from DB), same adaptive rules, 2/day max

**Difficulty Levels**
- Level 1: Easy
- Level 2: Medium
- Level 3: Hard
- Level 4: Expert

**Scoring for Practice Exams**
- Base: same as initial assessment (correct=1pt × time_multiplier)
- Time multiplier: `1.0 - (timeSpent / maxTime)` (capped 0–1)
- Difficulty weighting: apply multiplier based on difficulty level
  - Easy: 0.5× multiplier
  - Medium: 0.75× multiplier
  - Hard: 1.0× multiplier
  - Expert: 1.25× multiplier (bonus for attempting hardest questions)
- Final score% = (totalPoints / maxPossiblePoints) × 100

**Level Calculation (from session)**
- Average difficulty achieved: mean of all difficulty levels encountered
- Final level: map (average_difficulty + accuracy%) to proficiency level
  - Beginner: average_difficulty < 1.5 OR accuracy% < 50%
  - Intermediate: average_difficulty 1.5–2.5 AND accuracy% 50–75%
  - Advanced: average_difficulty 2.5–3.5 AND accuracy% 75–90%
  - Expert: average_difficulty > 3.0 AND accuracy% > 85%

**Real-Time Tracking During Session**
- Per question: {answer, correct, timeSpent, difficulty, timestamp}
- Per checkpoint: {accuracySinceLastCheckpoint%, difficultyAdjustment, questionsAnswered}
- Session summary: {totalAccuracy%, avgDifficultyAchieved, difficultySequence, numDifficultyChanges}

**Primary Collections (new/updated)**
- `exam_sessions` — { _id: ObjectId, userId: ObjectId, sessionType: 'initial' | 'practice', interests: string[], questionCount: number, status: 'active' | 'completed', startedAt: date, completedAt?: date, retakeOf?: ObjectId }
- `exam_attempts` — { _id: ObjectId, userId: ObjectId, sessionId: ObjectId, attemptNumber: number, answers: [{questionId, chosenChoice, timeSpent, correctnessRevealed?, difficulty_at_time}], totalScore: number, scorePercentage: number, levelAchieved: string, inSessionLevelSequence: string[], avgDifficultyAchieved: number, numDifficultyChanges: number, completedAt: date, createdAt: date }
- `exam_history_view` — denormalized projection of exam_attempts for UI (id, date, score%, level, duration, questionCount, isRetake, sessionId)

**REST Endpoints**
- POST `/api/students/exam/session/create`
  - auth required
  - payload: { interests: string[], questionCount: number (10-30) }
  - response: { sessionId, questionCount, startingDifficulty, questions: [{id, text, choices}] }
  
- POST `/api/students/exam/session/:sessionId/answer`
  - auth required
  - payload: { questionId, chosenChoiceId, timeSpentSeconds }
  - response: { nextQuestionId?, checkpointReached: bool, difficultyAdjusted: bool, newDifficulty?: string }
  - action: validate answer, check if checkpoint reached, adjust difficulty if needed, fetch next question

- POST `/api/students/exam/session/:sessionId/complete`
  - auth required
  - response: { sessionId, scorePercentage, levelAchieved, avgDifficultyAchieved, summary: {...} }
  - action: finalize attempt, compute all scores, update overall level in stats

- GET `/api/students/exam/history`
  - auth required
  - response: { attempts: [{attemptId, date, score%, level, duration, questionCount, canRetake, sessionId}] }

- POST `/api/students/exam/session/:sessionId/retake`
  - auth required
  - validation: sessionId must NOT be initial assessment; max 2 retakes per day; endpoint rejects if limit exceeded
  - payload: { } (system reuses same interests + question count)
  - response: { newSessionId, questions: [...] }
  - action: create new session as retake_of previous, validate frequency limit, start session

- GET `/api/students/exam/session/:sessionId`
  - auth required
  - response: { sessionId, status, progress: {answeredCount, totalCount, estimatedTimeRemaining}, sessionLevelSequence, scorePreview }

**Adaptive Logic Implementation**
```
checkpointSize = ceil(totalQuestions × 0.20) // 20-30% checkpoint
questionsInCheckpoint = count of questions since last checkpoint

accuracy_in_checkpoint = (correctAnswers / questionsInCheckpoint) × 100

if accuracy_in_checkpoint >= 75%:
  difficulty = min(difficulty + 1, Expert)  // promote
else if accuracy_in_checkpoint < 50%:
  difficulty = max(difficulty - 1, Easy)  // demote
else:
  difficulty = stay same  // 50-75% range

emit checkpointReached event
```

**Retake Restrictions**
- Max 2 retakes per 24-hour period per session
- Cannot retake initial assessment (return 403 Forbidden)
- Each retake shows "Retake #1", "Retake #2", etc. in history

**UI/UX Notes**
- Show in-session level progression in real-time (visual widget during exam)
- On completion, show side-by-side: previous level → new level (if changed)
- Exam history lists newest first
- Retake button greyed out + tooltip if: (a) is initial assessment, (b) 2/day limit reached

**Developer Notes**
- Adaptive logic must be stateless (re-computable per checkpoint)
- Store difficulty sequence immutably (audit trail)
- Use transactions for level updates (atomic profile + attempt + stats)

**Next Actions (after user approval)**
- Generate OpenAPI spec (YAML) including adaptive difficulty endpoints + retake contracts
- Create MongoDB collections + indexes (exam_sessions, exam_attempts, exam_history_view)
- Produce endpoint handler stubs with adaptive checkpoint logic
- Design checkpoint evaluation algorithm + difficulty mapping
- Generate test fixtures (sample sessions with adaptive progressions)
- Create integration test: session create → adaptive checkpoints → retake → verify level update


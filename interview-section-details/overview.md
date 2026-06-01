# Interview Module — Master Overview

> Single source of truth for the AI Mock Interview module. Synthesizes:
> `Question.md`, `Module Specification Orchestrator.md`, `prompt_layer.md`,
> `aimodels.md`, `interview-techstack.md`, plus the overview diagram image.
>
> Created: 2026-05-31. Treat anything marked **(DECISION NEEDED)** as unresolved —
> do not build past it without the user's answer.

---

## 1. What this module is (in one paragraph)

A real-time, multimodal mock-interview experience. The candidate sits in front of a
webcam + mic. The system runs a **dynamic, adaptive question loop** (intro → personalized
follow-up → domain questions → AI-generated deep-dive questions), while **continuously
analyzing** voice (WPM, fillers, pitch, sentiment), face (emotion, composure), eye contact
(gaze), and posture. After each answer it produces **per-turn feedback** and scales the
difficulty. When the session ends, a **background job** compiles a **Confidence Index (CI)**
report, identifies skill gaps, matches curated learning resources, and dispatches
email + in-app notifications.

---

## 2. The two layers (core mental model)

```
┌─────────────────────────────── REALTIME LAYER ───────────────────────────────┐
│  Webcam/Mic ─► chunks (5–10s) ─► lightweight analysis ─► live coaching cues   │
│  Goal: low latency, rule-based, NO heavy LLM in the hot path                  │
└───────────────────────────────────────────────────────────────────────────────┘
                                      │  (per-answer + on session end)
                                      ▼
┌─────────────────────────────── DEEP ANALYSIS LAYER ──────────────────────────┐
│  Aggregate metrics ─► LLM reasoning ─► CI report + skill gaps + resources     │
│  Goal: intelligent reasoning, runs async (per-turn eval + end-of-session)     │
└───────────────────────────────────────────────────────────────────────────────┘
```

Hard rule from the specs: **raw audio/video is NEVER sent to the LLM** — only structured
numeric metrics + transcripts.

---

## 3. The Question Lifecycle (the heart of the module)

### Phase 1 — Pre-Session Cache Seeding
Before Turn 1 is shown, fill a question pool (target ~15–16 questions) using a 3-tier fallback:
1. **Primary:** `validated_questions` (human-approved) matching role + difficulty.
2. **Secondary:** `pending_questions` (AI-generated, not rejected).
3. **On-Demand AI:** if still short, generate via LLM, validate, seed into the pool.

> Note: the orchestrator spec calls these `validated_questions` / `pending_questions`.
> The existing exam codebase uses `questions_non_ai` / `questions_ai`. **(DECISION NEEDED —
> see §11.4: reuse existing collections or introduce new interview-specific ones?)**

### Phase 2 — Core Interview Loop

| Turn | Source | Latency strategy |
|------|--------|------------------|
| Q1 Intro | Static from DB | instant |
| Q2 Personalization | Template + entity extraction from Q1 transcript (Name, Experience, Tech Stack) — **no LLM call** | instant |
| Q3, Q4, Q5 | Domain questions from pre-fetched pool | instant |
| **Q6 (Buffer)** | Pool question shown **immediately** when user submits Q5 | instant |
| **Q7 (Deep-Dive)** | LLM generates in **parallel background task** from Q3–Q5 transcripts while user answers Q6 | hidden behind Q6 |

### The Turn 6 Buffer / Turn 7 Race Condition (critical mechanic)
The millisecond the user submits **Q5 (index 4)**, two things fire at once:
1. **Foreground:** serve Q6 from cache instantly (user never waits).
2. **Background:** LLM builds Q7 (deep-dive targeting the candidate's weak spots in Q3–Q5),
   guarded by **`asyncio.wait_for(..., timeout=10.0)`**.
   - If LLM returns < 10s: validate via Pydantic, dedupe-check against Q6, inject as Q7,
     and clone into `pending_questions` (`status: pending`, `is_validated: false`) for human audit.
   - If LLM hangs ≥ 10s: **fall back** to the next pre-cached pool question. Session never stalls.

### Sliding Window Reset (Turns 8, 9, 10+)
The loop repeats. Q6/Q7 become the new context base; the background generator fires again on
the next milestone, continuously producing context-aware deep-dive questions until the
configured `question_count` is reached.

---

## 4. The Three Orchestrators

### 4.1 `interview_orchestrator` — question lifecycle & session state
- **`POST /interview/start`** — validate monthly interview limit, run profile analysis,
  seed the cache pool, serve Turn 1.
- **WS checkpoint (answer_submit, index == 4)** — serve Q6 buffer + launch Q7 background task.
- **`POST /interview/{session_id}/resume`** — rebuild WS params from last MongoDB state
  (current index + current difficulty).
- Inputs: `user_id`, `config {role, difficulty, question_count, ai_persona}`,
  `redis_session_cache`, `exclusion_array[]`, `source_transcripts[]`.
- Output: `{ session_id, question_text, current_question_index, total_questions }`.

### 4.2 `feedback_orchestrator` — per-answer evaluation (live, in WS)
Fires on **every** `answer_submit`:
1. **Biometric aggregation** — pull buffered arrays from Redis (`wpm_arr`, `filler_count`,
   `eye_contact_arr`, `posture_arr`); compute moving averages.
2. **Context construction** — pull active question text + `ideal_gold_standard_answer`;
   read user's billing tier.
3. **Prompt handshake** — call the prompt layer to assemble the "Evaluation Sandwich Prompt".
4. **Pydantic shield** — map LLM output to `QuestionEvaluationSchema`; on failure, re-prompt
   up to **3×** with the error appended.
5. **Adaptive difficulty + tier gating** — apply `difficulty_adjustment` (increase/same/decrease)
   to Redis + Mongo; if tier == `free`, strip `feedback_text`, `strengths`, `improvements`
   from the payload before sending.
6. **Persist + forward** — write turn metrics to Mongo; push filtered payload down the WS.

### 4.3 `report_orchestrator` — end-of-session deep report (background)
- Triggers: WS `end_session` (cap reached or early exit) → enqueue background job; OR a
  payment webhook (unlock detailed report for a free user). **(DECISION NEEDED — see §11.2 Celery)**
- Steps:
  1. Aggregate all turns → averages for `technical_accuracy`, `communication`, `voice_ci`, `body_ci`.
  2. **CI Score** = `technical_accuracy*0.35 + communication*0.25 + voice_ci*0.20 + body_ci*0.20`.
  3. Any category strictly **< 65** → flagged into `weakness_tags`.
  4. **Resource matchmaking (RAG):** intersect `weakness_tags` with `resources` tags;
     if session has a B2B `institution_code`, prioritize that institution's mentor resources
     before global B2C ones; cap at **5** results.
  5. LLM writes a narrative summary tying recommended resources to the candidate's gaps.
  6. Commit report (`status: ready`) + fire in-app notification + email (SMTP).

---

## 5. The Prompt Layer ("Sandwich Prompt")

Deterministic bridge between stateful orchestrators and the stateless LLM. Every prompt = 3 bricks:

```
TOP    : Persona (ai_persona: stress_interviewer | tech_lead | general_recruiter)
         + hard rules (no small talk, no markdown fences, JSON only)
MIDDLE : Dynamic context — entity_tags, transcripts, aggregated non-verbal metrics,
         exclusion_array (zero duplication), difficulty index
BOTTOM : Explicit JSON schema skeleton mirroring the target Pydantic model
```

**Token control — Sliding Context Window:**
- Turn-by-turn eval (Q3–Q5): inject only compressed scoring history
  (e.g. `[{"Turn 3":"Score:78, Topic:FastAPI middleware"}]`), not full transcripts.
- Q7 generation: inject only the raw Q3/Q4/Q5 transcripts; strip everything before Turn 3.

**Pydantic Shield (applies to all 3 orchestrators):** raw LLM string → schema validation →
on failure, local JSON repair (strip fences/trailing text) → re-prompt up to 3× → only then fail.

---

## 6. Multimodal Analysis — metrics & methods

### Audio (per chunk)
- **STT:** faster-whisper (OSS) or Groq Whisper / Deepgram (per tech stack).
- **Speech:** WPM (`words / duration * 60`), pause (>0.5s) / dead-silence (>2.5s) detection,
  filler regex `\b(um|uh|like|basically|actually|you know)\b`.
- **Voice features (Parselmouth/librosa):** pitch variation (F0 stddev), loudness/energy
  variance (`librosa.feature.rms`).
- **Sentiment:** text transformer (e.g. `cardiffnlp/twitter-roberta-base-sentiment-latest`)
  → trajectory per answer block + communication clarity.

### Vision (one frame per chunk — NOT every frame)
- **Framework:** MediaPipe + OpenCV + NumPy.
- **Emotion (DeepFace):** happy/calm/sad/angry/confused/surprised/neutral
  → Composure = `100*(1 - (angry% + confused%))`; stability via rolling 30s variance.
- **Gaze (Face Mesh + Iris):** head yaw/pitch via `cv2.solvePnP`. Good = ±10°.
  Looking down < -15° pitch; sideways > ±15° yaw sustained > 3.5s → warning.
- **Posture (MediaPipe Pose):** shoulder slope (P11/P12) deviation > ±7° = distortion;
  ear-shoulder neck angle for slouch/lean.

### Realtime scoring (rule-based thresholds — see IMPLEMENTATION_GUIDE §3.3)
`wpm > 170` fast · `wpm < 90` slow · `fillers > 3` · `eye_contact < 60` · `!posture_ok` ·
emotion in {angry,sad,confused} → warning.

### Final scores
- **Communication:** filler rate + pace + clarity + sentiment.
- **Confidence:** eye contact + posture + vocal stability + stress spikes.
- **Professional Presence:** posture + engagement + composure + emotional consistency.
- **CI Score:** weighted formula in §4.3.

---

## 7. Frontend contract (from IMPLEMENTATION_GUIDE)

- Capture webcam+mic, `MediaRecorder` with **7000ms** timeslice.
- **Binary envelope per chunk:** `[4-byte big-endian audio length][audio bytes][jpeg frame bytes]`.
  Sent over WebSocket only (no HTTP, no base64).
- WS server messages: `realtime_feedback` (per chunk) and `session_complete {reportId}`.
- After disconnect, frontend polls `GET /reports/{reportId}`.
- Key types: `RealtimeFeedback`, `InterviewSession`, `CoachingReport`, `TimelineEvent`.
- **Behavioral timeline:** `mm:ss → event` list (e.g. "02:10 → Speaking too fast").

---

## 8. Data model (collections referenced across specs)

| Collection | Purpose | Origin |
|---|---|---|
| `interview_sessions` | session lifecycle, status, indices, difficulty | IMPL_GUIDE / orchestrator |
| `coaching_reports` | final CI report + embedded timeline | IMPL_GUIDE |
| `validated_questions` | human-approved interview Qs | orchestrator/Question.md |
| `pending_questions` | AI Qs awaiting human audit (`is_validated:false`) | orchestrator |
| `resources` | learning resources w/ tags (+ B2B `institution_code`) | report orchestrator |
| `users` / `user_profile` | tier, entity_tags, monthly limits | existing project |

> **(DECISION NEEDED — §11.4)** Existing project already has `questions_non_ai`,
> `questions_ai`, `exam_sessions`, `exam_attempts`. Names in the interview spec differ.
> Must reconcile before any code.

---

## 9. Tier-based feature gating

- **free:** report locked until payment; per-turn `feedback_text`/`strengths`/`improvements`
  stripped from live payload. Monthly interview limit enforced at `/interview/start`.
- **pro / enterprise:** full per-turn feedback, persona selection, full report.
- B2B `institution_code` changes resource prioritization in the report.

> **(DECISION NEEDED — §11.3)** `work-flow.md` says "MVP: all users full access, no tiers."
> The interview spec heavily relies on tiers, Razorpay, and monthly limits. Conflict.

---

## 10. ⚠️ THE BIG ARCHITECTURE FORK (most important section)

There is a **fundamental stack conflict** between the existing app and the interview specs:

| Concern | Existing app (verified in code) | Interview specs assume |
|---|---|---|
| Runtime | **Next.js 16 + TypeScript** (App Router) | **Python FastAPI** |
| Realtime | none yet | **WebSockets** (FastAPI WS) |
| Background jobs | none | **Celery** task queue |
| LLM | OpenAI/Gemini SDKs; `ai-generator.ts` currently **disabled** | **Anthropic Claude** (`anthropic` SDK) |
| CV/Audio AI | none (browser only) | **MediaPipe, DeepFace, OpenCV, librosa, faster-whisper** (Python-only) |
| DB driver | raw `mongodb` driver | **Motor + Beanie** (Python) |
| Cache | `ioredis` w/ in-memory fallback (`src/lib/redis.ts`) | Redis (assumed always-on) |

**Reality check:** MediaPipe, DeepFace, OpenCV, librosa, Parselmouth, faster-whisper, openSMILE
**do not run in a Next.js/Node server.** They are Python libraries. The realtime CV/audio
pipeline essentially *requires* either (a) a separate Python FastAPI service, or (b) doing
all CV/gaze/posture **in the browser** via MediaPipe JS and only sending numbers to the backend.

This decision changes everything downstream and **must** be made before planning. See §11.1.

---

## 10b. ✅ LOCKED DECISIONS (confirmed with user 2026-05-31)

- **Architecture: Path B — all-in-Next.js, vision in the browser.** No Python service, no
  Celery, no GPU host. MediaPipe JS computes gaze/posture/emotion client-side; the browser
  shows realtime cues locally (zero network latency). Backend (Next.js routes) is only
  involved at two moments, both plain HTTP: **on answer submit** and **on session end**.
- **No WebSocket server required.** The spec's WS `answer_submit` checkpoint becomes
  `POST /interview/{id}/answer`. Metrics are aggregated in the browser and sent in the POST body.
- **Orchestrator logic preserved, re-expressed in TypeScript:**
  - `asyncio.wait_for(timeout=10.0)` → `Promise.race([generateQ7(), timeout(10000)])` (Q7 race + fallback kept exactly).
  - Pydantic shield + 3× re-prompt → Zod schema + retry loop (same guardrail).
  - Celery report job → Next.js background route (or Redis-backed queue if true async needed).
  - Live Redis biometric streaming → metrics batched per-answer in the POST body.
- **Tiers/payments: deferred for v1.** Everyone gets full access (matches `work-flow.md` MVP).
  Leave clean hooks so gating + Razorpay + monthly limits drop in later without restructuring.
- **Collections: new, interview-specific.** `interview_sessions`, `interview_questions`
  (with `validated`/`pending` status field), `coaching_reports`. Do NOT overload exam collections.
- **LLM provider: reuse existing (Gemini SDK already a dependency).** Keep the call site
  provider-agnostic so Claude/OpenAI can be swapped in. Spec's "Claude" treated as swappable.
- **STT: browser Web Speech API for v1** (free, already implied by feedback_orchestrator spec).
  Swap to Deepgram/Groq later as a single-function change when production quality is needed.
- **Scope: vertical slice first.** Fixed question loop + audio metrics + per-turn LLM feedback
  + end-of-session CI report. Harden that, THEN layer in browser vision + adaptive Q6/Q7 generation.
- **Upgrade path:** lab-grade voice metrics (Parselmouth/librosa) and richer emotion (DeepFace)
  can later move to a thin Python serverless function (Path C) without a rebuild.

---

## 11. OPEN DECISIONS (resolved — kept for history; see §10b for outcomes)

### 11.1 Backend architecture **(blocking)**
Which path?
- **A — Separate Python FastAPI microservice** for the whole interview engine
  (matches every spec doc 1:1; introduces a 2nd backend + deployment).
- **B — Stay in Next.js**; do MediaPipe/gaze/posture **client-side in the browser** (MediaPipe JS),
  use a hosted STT API (Deepgram/Groq) + hosted emotion API, keep LLM in TS. No Python.
  (Keeps one codebase; sacrifices the exact Python libs; some metrics like Parselmouth pitch
  become approximate or move to a small serverless function.)
- **C — Hybrid:** Next.js owns session/auth/HTTP + report UI; thin Python service owns only
  realtime CV/audio over WS.

### 11.2 Celery / background jobs
Specs use Celery (Python). If we stay in Next.js (Path B), what runs the end-of-session report —
a Next.js route, a queue (e.g. BullMQ on Redis), or a serverless background function?

### 11.3 Tiers & payments
`work-flow.md` says MVP = no tiers / full access. Interview spec = tiers + Razorpay + monthly
limits. For v1, do we **ignore gating** (treat everyone as full access) or build it now?

### 11.4 Collection naming
Reuse existing `questions_non_ai`/`questions_ai`/`exam_sessions`, or create new
`validated_questions`/`pending_questions`/`interview_sessions`? Pick one to avoid a split-brain DB.

### 11.5 LLM provider
Specs say Claude. Existing app uses OpenAI/Gemini SDKs (and the generator is disabled).
Which provider + key do we standardize on for interview generation/evaluation?

### 11.6 STT provider
faster-whisper (self-host GPU) vs Deepgram/Groq (hosted API). Affects realtime latency,
cost, and whether we need a GPU/Python host at all.

### 11.7 Scope of v1
Full module (adaptive Q-loop + live multimodal + per-turn LLM eval + CI report + resources +
notifications) is large. Should v1 be a **vertical slice** (e.g. fixed questions + audio-only
metrics + end report) that we harden, then layer vision + adaptive generation on top?

---

## 12. Build order (proposed, once §11 is resolved)
1. Session lifecycle + WS skeleton (connect, echo, persist session).
2. Media capture + chunk envelope (frontend) ↔ chunk parser (backend).
3. Audio pipeline (STT + WPM/fillers) → realtime feedback over WS.
4. Vision pipeline (gaze/posture/emotion) → merge into realtime feedback.
5. Question lifecycle: cache seeding → Q1–Q5 → Q6 buffer / Q7 race condition.
6. Per-turn feedback orchestrator + adaptive difficulty + Pydantic shield.
7. End-of-session report orchestrator: CI score, skill gaps, resource RAG, narrative.
8. Notifications (email + in-app), tier gating, monthly limits.
9. Report UI + behavioral timeline + history.

---

## 13. Cross-cutting rules (do not violate)
- Raw media never goes to the LLM — metrics only.
- One frame analyzed per chunk, not every frame.
- LLM output always passes the Pydantic/schema shield (3 retries) before use.
- Q-loop must never stall: the 10s timeout fallback is mandatory.
- No secrets in source; reuse existing auth/session pattern.
- Next.js 16 has breaking changes — read `node_modules/next/dist/docs/` before writing Next code.

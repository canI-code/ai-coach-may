# AI Preparation Coach — Architecture

> **Version**: 0.1.0 · **Framework**: Next.js 16 (App Router) · **Language**: TypeScript

---

## 1. High-Level System Architecture

```mermaid
graph TB
    subgraph Client ["🖥️ Browser Client"]
        UI["Next.js React Pages"]
        WC["Webcam / MediaPipe"]
        MIC["Web Speech API / WebAudio"]
        WS["Web Speech Recognition"]
    end

    subgraph NextServer ["⚙️ Next.js Server (App Router)"]
        API["API Route Handlers<br/>/api/*"]
        SSR["Server Components<br/>Pages & Layouts"]
        AUTH["Auth Module<br/>Cookie-based Sessions"]
    end

    subgraph CoreEngine ["🧠 Interview Engine (src/lib/interview)"]
        ORCH["Orchestrator<br/>Session Lifecycle"]
        FEED["Feedback Orchestrator<br/>Per-Turn Evaluation"]
        DD["Deep-Dive Generator<br/>Q7 Race + Dedupe"]
        RPT["Report Compiler<br/>CI Aggregation"]
        CS["Cache Seeder<br/>Question Pool"]
        LLM["LLM Gateway<br/>Multi-Provider Fallback"]
        STT["Groq Whisper STT<br/>Speech-to-Text"]
        TTS["Edge TTS<br/>Text-to-Speech"]
        SS["Schema Shield<br/>Zod Validation"]
        PB["Prompt Builder<br/>Sandwich Prompts"]
    end

    subgraph BrowserAnalysis ["📊 Browser-Side Analysis"]
        VA["Vision Analyzer<br/>MediaPipe Face+Pose"]
        AA["Audio Analyzer<br/>WPM, Fillers, Pauses"]
        RC["Realtime Coach<br/>Live Feedback"]
    end

    subgraph Data ["🗄️ Data Layer"]
        MONGO[(MongoDB<br/>aicoach / aicoach_institutional)]
        REDIS[(Redis / In-Memory<br/>Session Cache)]
    end

    subgraph External ["☁️ External AI Services"]
        GEMINI["Google Gemini 2.5 Flash"]
        GROQ["Groq (Llama 3 70B)"]
        NVIDIA["NVIDIA NIM"]
        OPENROUTER["OpenRouter"]
        OPENAI["OpenAI GPT-4o"]
        GROQW["Groq Whisper v3"]
    end

    UI --> API
    WC --> VA
    MIC --> AA
    WS --> AA
    VA --> UI
    AA --> UI
    RC --> UI

    API --> AUTH
    API --> ORCH
    API --> FEED
    API --> DD
    API --> RPT
    API --> STT
    API --> TTS
    ORCH --> CS
    ORCH --> LLM
    FEED --> LLM
    FEED --> SS
    DD --> LLM
    DD --> SS
    RPT --> LLM
    RPT --> SS
    CS --> LLM
    LLM --> GEMINI
    LLM --> GROQ
    LLM --> NVIDIA
    LLM --> OPENROUTER
    LLM --> OPENAI
    STT --> GROQW
    ORCH --> MONGO
    ORCH --> REDIS
    FEED --> MONGO
    RPT --> MONGO
    CS --> MONGO
    AUTH --> MONGO

    style Client fill:#1a1a2e,stroke:#e94560,color:#fff
    style NextServer fill:#16213e,stroke:#0f3460,color:#fff
    style CoreEngine fill:#0f3460,stroke:#533483,color:#fff
    style BrowserAnalysis fill:#533483,stroke:#e94560,color:#fff
    style Data fill:#1a1a2e,stroke:#e94560,color:#fff
    style External fill:#16213e,stroke:#533483,color:#fff
```

---

## 2. Interview Session Lifecycle (State Machine)

The session progresses through a strict, forward-only state machine. No backward or same-state transitions are permitted.

```mermaid
stateDiagram-v2
    [*] --> seeding : createSession()

    seeding --> active : Pool meets minimum size
    seeding --> abandoned : User/system abort

    active --> completed : All questions answered<br/>OR session ended
    active --> abandoned : User/system abort

    completed --> [*]
    abandoned --> [*]

    note right of seeding
        Cache Seeder populates
        the Question Pool from
        validated → pending → on-demand tiers
    end note

    note right of active
        Turns 1–N loop:
        question → answer → evaluate → next
        Adaptive difficulty per turn
    end note

    note left of completed
        Report compiled async
        via after() hook
    end note
```

---

## 3. Interview Turn Flow (Turns 1–7+)

```mermaid
sequenceDiagram
    participant C as 🖥️ Client
    participant API as ⚙️ API Routes
    participant O as 🧠 Orchestrator
    participant F as 📝 Feedback
    participant DD as 🔬 Deep Dive
    participant LLM as 🤖 LLM Gateway
    participant DB as 🗄️ MongoDB
    participant Cache as 📦 Redis

    C->>API: POST /api/interview/start
    API->>O: createSession(userId, config)
    O->>DB: Insert session (status: seeding)
    O->>O: Cache Seeder (validated → pending → on_demand)
    O->>LLM: Generate on-demand questions (if needed)
    O->>DB: Update session (status: active, pool seeded)
    O->>Cache: Set pool cache
    O-->>C: Turn 1 — Static intro question

    loop Turns 2–N
        C->>API: POST /api/interview/{id}/answer
        Note over C: Sends transcript + voice metrics<br/>+ vision metrics (numeric only)
        API->>F: evaluateTurn(payload)
        F->>F: Validate payload (Zod schema)
        F->>F: Compute moving averages (WPM, eye, posture)
        F->>LLM: Sandwich Prompt (question + ideal + metrics)
        LLM-->>F: Evaluation JSON
        F->>F: Schema Shield validation + retry
        F->>F: Apply adaptive difficulty (±1, clamped)
        F->>DB: Persist turn + updated difficulty
        F-->>API: TurnFeedback (scores, strengths, improvements)
        API->>O: advanceTurn(session, answeredIndex)
        alt Turn 2 (index 1)
            O->>O: Extract entities from Turn 1 transcript
            O-->>API: Personalized follow-up (no LLM, no pool)
        else Turns 3–5 (index 2–4)
            O->>O: selectNext(pool, servedIds)
            O-->>API: Next pool question
        else Turn 6 (buffer)
            O->>O: selectNext(pool, servedIds)
            O-->>API: Buffer question served immediately
        else Turn 7 (deep dive)
            O->>DD: raceDeepDive(context, timeout=10s)
            DD->>LLM: Generate deep-dive question
            DD->>DD: Promise.race([generate, timeout])
            alt Generation wins + passes shield + unique
                DD-->>API: Generated question injected
                DD->>DB: Clone persisted as pending
            else Timeout OR duplicate OR shield fail
                DD-->>API: Pool fallback question
            end
        end
        API-->>C: Next question + feedback
    end

    C->>API: POST /api/interview/{id}/end
    API->>O: Transition → completed
    API->>DB: Update session status
    Note over API: after() hook fires
    API->>API: compileReport (async background)
```

---

## 4. LLM Gateway — Multi-Provider Fallback Chain

```mermaid
flowchart LR
    REQ["LLM Request"] --> GW["getLLMGateway()"]

    GW --> ENV{{"INTERVIEW_LLM_PROVIDER<br/>env set?"}}

    ENV -->|Yes, single| SINGLE["Use single provider"]
    ENV -->|Yes, comma-separated| MULTI["FallbackGateway<br/>ordered chain"]
    ENV -->|No / unset| AUTO["Auto-detect from<br/>available API keys"]

    AUTO --> FC["FallbackGateway"]

    subgraph FallbackChain ["Fallback Order (DEFAULT_ORDER)"]
        direction TB
        G1["1. Gemini 2.5 Flash<br/>GOOGLE_AI_API_KEY"]
        G2["2. Groq Llama 3 70B<br/>GROQ_API_KEY"]
        G3["3. NVIDIA NIM<br/>NVIDIA_API_KEY"]
        G4["4. OpenRouter<br/>OPENROUTER_API_KEY"]
        G5["5. OpenAI GPT-4o-mini<br/>OPENAI_API_KEY"]
        G1 -->|fail| G2
        G2 -->|fail| G3
        G3 -->|fail| G4
        G4 -->|fail| G5
    end

    FC --> FallbackChain

    subgraph ErrorTypes ["Error Classification"]
        E1["rate_limited (429)"]
        E2["timeout (ETIMEDOUT)"]
        E3["provider_error (other)"]
    end

    FallbackChain -.-> ErrorTypes

    style REQ fill:#e94560,color:#fff
    style FallbackChain fill:#0f3460,color:#fff
    style ErrorTypes fill:#533483,color:#fff
```

> [!NOTE]
> The `mock` provider is available for offline testing (`INTERVIEW_LLM_PROVIDER=mock`). It returns deterministic, schema-valid JSON without any network call.

---

## 5. Multimodal Analysis Pipeline

```mermaid
flowchart TB
    subgraph Browser ["🖥️ Browser (Client-Side Processing)"]
        direction TB

        CAM["📷 Webcam Feed"]
        MIC2["🎤 Microphone Feed"]

        CAM --> MP["MediaPipe<br/>Face Landmarker + Pose Landmarker"]

        MP --> VIS["Vision Analyzer"]
        VIS --> EYE["Eye Contact Score<br/>yaw + pitch → 0–100"]
        VIS --> GAZE["Gaze Down Detection<br/>pitch < −15°"]
        VIS --> POST["Posture Distortion<br/>shoulder slope > 7°"]
        VIS --> EMO["Dominant Emotion<br/>argmax over 7 categories"]
        VIS --> COMP["Composure Score<br/>100 − angry% − confused%"]
        VIS --> SIDE["Sideways Distraction<br/>|yaw| > 15° for > 3.5s"]

        MIC2 --> WSR["Web Speech Recognition"]
        MIC2 --> WA["WebAudio AnalyserNode"]

        WSR --> AUD["Audio Analyzer"]
        WA --> AUD
        AUD --> WPM["WPM<br/>words ÷ minutes"]
        AUD --> FILL["Filler Count<br/>um, uh, like, you know"]
        AUD --> PACE["Pace Classification<br/>slow / moderate / fast"]
        AUD --> PAUS["Pause Detection<br/>> 0.5s gap"]
        AUD --> DEAD["Dead Silence<br/>> 2.5s gap"]
        AUD --> SENT["Sentiment<br/>lexicon-based −1 to +1"]

        RC2["Realtime Coach<br/>Live nudges & alerts"]
    end

    subgraph Server ["⚙️ Server (Numeric Metrics Only)"]
        direction TB
        SUB["Answer Submit Payload"]
        SUB --> VAL["Zod Validation<br/>(reject raw media)"]
        VAL --> MA["Moving Averages<br/>wpm, eyeContact, posture"]
        MA --> EVAL["LLM Evaluation<br/>via Sandwich Prompt"]
    end

    EYE --> |"eyeContactArr[]"| SUB
    POST --> |"postureArr[]"| SUB
    WPM --> |"wpmArr[]"| SUB
    FILL --> |"fillerCount"| SUB
    AUD --> |"transcript"| SUB

    style Browser fill:#1a1a2e,stroke:#e94560,color:#fff
    style Server fill:#0f3460,stroke:#533483,color:#fff
```

> [!IMPORTANT]
> **Privacy by Design (Req 15)**: Raw audio and video NEVER leave the browser. Only numeric metric arrays and text transcripts are sent to the server. The sole exception is the Groq Whisper STT transcription endpoint, where audio is forwarded transiently and not persisted.

---

## 6. Data Model (MongoDB Collections)

```mermaid
erDiagram
    USERS {
        ObjectId _id PK
        string username
        string email
        string phone
        string passwordHash
        string role "user | mentor | mentee | admin | superadmin"
        string status "active | disabled"
        object accessLimit "expiresAt, interviewsCount, examsCount"
        object usage "interviewsCompleted, examsCompleted"
        array sessions "auth session tokens"
    }

    INTERVIEW_SESSIONS {
        ObjectId _id PK
        ObjectId userId FK
        string status "seeding | active | completed | abandoned"
        object config "role, difficulty, durationMinutes, persona, questionCount"
        string institutionCode
        int currentQuestionIndex
        int currentDifficulty
        array pool "PooledQuestion[]"
        array exclusion "string[] — served question IDs"
        array turns "TurnRecord[] — per-turn data"
        array behavioralTimeline
        ObjectId reportId FK
        Date startedAt
        Date createdAt
        Date updatedAt
    }

    INTERVIEW_QUESTIONS {
        ObjectId _id PK
        string questionText
        string idealAnswer
        string role
        int difficulty
        array tags
        string status "validated | pending"
        boolean is_validated
        string source "deep_dive | seeder | manual"
        ObjectId validatedBy FK
        Date createdAt
    }

    COACHING_REPORTS {
        ObjectId _id PK
        ObjectId sessionId FK
        ObjectId userId FK
        string status "pending | ready | failed"
        float ciScore "0–100 Confidence Index"
        object categoryScores "tech, comm, voice, body"
        array weaknessTags
        string narrative "LLM-generated summary"
        array resources "Resource[]"
        array behavioralTimeline
        Date readyAt
        Date createdAt
    }

    USERS ||--o{ INTERVIEW_SESSIONS : "has many"
    INTERVIEW_SESSIONS ||--o| COACHING_REPORTS : "generates"
    INTERVIEW_SESSIONS }o--o{ INTERVIEW_QUESTIONS : "draws from pool"
    USERS ||--o{ COACHING_REPORTS : "owns"
```

### Redis Cache Schema

| Key Pattern | Value | TTL |
|---|---|---|
| `interview:session:{id}:pool` | `PoolCache` (pool, exclusion, index, difficulty) | 2 hours |
| `interview:report:{id}:status` | `{ status }` | 2 hours |

> [!TIP]
> Redis is optional — the `RedisClient` class gracefully falls back to an in-memory `Map`-based cache when `REDIS_URL` is not configured.

---

## 7. Authentication & Authorization Flow

```mermaid
sequenceDiagram
    participant U as 👤 User
    participant P as 📄 Login Page
    participant API as ⚙️ Auth API
    participant DB as 🗄️ MongoDB

    U->>P: Enter credentials
    P->>API: POST /api/auth/login
    API->>DB: Find user by email/phone
    DB-->>API: User document
    API->>API: Verify password (bcryptjs)
    API->>API: Generate session token<br/>"token|{userId}|{sessionId}"
    API->>DB: Push session to user.sessions[]
    API->>API: Set HttpOnly cookie (auth_token)
    API-->>P: 200 OK + redirect

    Note over API: On every authenticated request:
    API->>API: getCurrentUser()
    API->>API: Read auth_token cookie
    API->>API: Parse "token|userId|sessionId"
    API->>DB: Find user with matching session
    Note over API: Checks aicoach DB first,<br/>then aicoach_institutional DB

    alt Mentee Access Check
        API->>API: isUserAccessBlocked(user, type)
        Note over API: Checks: status disabled,<br/>access expired, usage limits
    end
```

### Role Hierarchy

```mermaid
graph TB
    SA["🔑 Superadmin<br/>Platform-wide control"]
    AD["🛡️ Admin<br/>Question moderation"]
    ME["👨‍🏫 Mentor<br/>Student management"]
    MT["🎓 Mentee<br/>Institutional student"]
    US["👤 User<br/>B2C individual"]

    SA --> AD
    SA --> ME
    ME --> MT
    AD -.->|moderates| QP["Question Pool"]
    ME -.->|monitors| MT

    style SA fill:#e94560,color:#fff
    style AD fill:#533483,color:#fff
    style ME fill:#0f3460,color:#fff
    style MT fill:#16213e,color:#fff
    style US fill:#1a1a2e,color:#fff
```

---

## 8. Report Compilation Pipeline

```mermaid
flowchart TB
    START["Session Completed<br/>(after() hook)"] --> LOAD["Load session from MongoDB"]
    LOAD --> STUB["Create/resolve report stub<br/>(status: pending)"]

    STUB --> AGG["Aggregate per-turn evaluations<br/>into category averages"]
    AGG --> CI["Compute Confidence Index<br/>tech×0.35 + comm×0.25 + voice×0.20 + body×0.20"]
    CI --> WEAK["Flag weakness tags<br/>(categories < 65)"]

    WEAK --> NAR["Build narrative prompt<br/>(CI + categories + weaknesses + strengths + improvements)"]
    NAR --> LLM2["LLM Gateway + Schema Shield"]

    LLM2 -->|Success| NARR["Extract narrative + recommendations"]
    LLM2 -->|Failure| MATCH["Fallback: matchResources from DB<br/>(institution-first, ≤ 5)"]

    NARR --> PERSIST["Persist report<br/>(status: ready)"]
    MATCH --> PERSIST

    PERSIST -->|Success| CACHE["Update Redis status cache"]
    CACHE --> NOTIFY["Dispatch report-ready notification"]

    PERSIST -->|Failure| FAIL["Record persistence error<br/>(status: failed)"]

    style START fill:#e94560,color:#fff
    style CI fill:#533483,color:#fff
    style PERSIST fill:#0f3460,color:#fff
    style FAIL fill:#721c24,color:#fff
```

### CI Score Formula

$$\text{CI} = \text{Technical Accuracy} \times 0.35 + \text{Communication} \times 0.25 + \text{Voice CI} \times 0.20 + \text{Body CI} \times 0.20$$

---

## 9. Question Pool Seeding Strategy

```mermaid
flowchart LR
    subgraph Tiers ["Cache Seeder — 3-Tier Strategy"]
        direction TB
        T1["🟢 Tier 1: Validated<br/>Human-approved questions<br/>from interview_questions"]
        T2["🟡 Tier 2: Pending<br/>AI-generated, not yet reviewed<br/>(rejected excluded)"]
        T3["🔴 Tier 3: On-Demand<br/>Real-time LLM generation<br/>via Schema Shield"]
        T1 --> T2
        T2 --> T3
    end

    CONFIG["Session Config<br/>role, difficulty range,<br/>focus tags"] --> Tiers

    Tiers --> POOL["Question Pool<br/>(≥ minPoolSize)"]
    POOL --> EXCL["Exclusion Array<br/>(all seeded IDs)"]
    POOL --> ACTIVE["Session → active"]

    POOL -->|"shortfall"| WARN["Shortfall Warning<br/>logged in session"]

    style T1 fill:#28a745,color:#fff
    style T2 fill:#ffc107,color:#000
    style T3 fill:#dc3545,color:#fff
```

---

## 10. Adaptive Difficulty Engine

```mermaid
flowchart TB
    EVAL["Per-Turn Evaluation<br/>(validated by Schema Shield)"]
    EVAL --> DERIVE["deriveDifficultyAdjustment()"]

    DERIVE --> CHECK{"techAccuracy ≥ 75<br/>AND comm ≥ 75?"}
    CHECK -->|Yes| INC["⬆️ increase"]
    CHECK -->|No| CHECK2{"techAccuracy < 50<br/>OR comm < 50?"}
    CHECK2 -->|Yes| DEC["⬇️ decrease"]
    CHECK2 -->|No| SAME["➡️ same"]

    INC --> APPLY["applyDifficulty()<br/>current + 1"]
    DEC --> APPLY2["applyDifficulty()<br/>current − 1"]
    SAME --> APPLY3["applyDifficulty()<br/>current unchanged"]

    APPLY --> CLAMP["Clamp to<br/>[difficultyMin, difficultyMax]"]
    APPLY2 --> CLAMP
    APPLY3 --> CLAMP

    CLAMP --> PERSIST2["Persist to session<br/>+ Redis mirror"]

    style EVAL fill:#533483,color:#fff
    style INC fill:#28a745,color:#fff
    style DEC fill:#dc3545,color:#fff
    style SAME fill:#6c757d,color:#fff
```

> [!NOTE]
> The difficulty signal is derived **deterministically** from evaluation scores, not from the LLM's self-reported `difficultyAdjustment` field, which was found to be unreliably always `'same'` (BUG 2 fix).

---

## 11. API Route Map

```mermaid
graph LR
    subgraph Auth ["/api/auth"]
        A1["POST /login"]
        A2["POST /signup"]
        A3["POST /logout"]
        A4["POST /otp"]
        A5["GET /status"]
        A6["POST /reset-password"]
        A7["GET /username-verify"]
        A8["POST /mentee-request"]
    end

    subgraph Interview ["/api/interview"]
        I1["POST /start"]
        I2["POST /{id}/answer"]
        I3["POST /{id}/end"]
        I4["GET /{id}/resume"]
        I5["GET /{id}/report"]
        I6["POST /{id}/retake"]
        I7["GET /sessions"]
        I8["GET /dashboard"]
        I9["POST /transcribe"]
        I10["POST /tts"]
    end

    subgraph Admin ["/api/admin"]
        AD1["GET/POST /pool"]
        AD2["GET/POST /flagged"]
        AD3["GET/POST /question-flags"]
        AD4["GET /institutions"]
        AD5["POST /testing-files"]
    end

    subgraph Mentor ["/api/mentor"]
        M1["POST /invite"]
        M2["GET/POST /students"]
        M3["POST /approve"]
        M4["GET /requests"]
        M5["GET /profile"]
        M6["GET /status"]
        M7["POST /practice"]
    end

    subgraph Other ["Other APIs"]
        O1["GET /api/user/proficiency"]
        O2["GET /api/user/recommendations"]
        O3["POST /api/institution/register"]
        O4["GET /api/students"]
        O5["POST /api/chat/messages"]
        O6["POST /api/contact"]
    end

    style Auth fill:#e94560,color:#fff
    style Interview fill:#0f3460,color:#fff
    style Admin fill:#533483,color:#fff
    style Mentor fill:#16213e,color:#fff
    style Other fill:#1a1a2e,color:#fff
```

---

## 12. Frontend Page Architecture

```mermaid
graph TB
    subgraph Public ["Public Pages"]
        HOME["/ — Landing Page"]
        ABOUT["/about"]
        FEAT["/features"]
        PLANS["/plans"]
        CONTACT["/contact"]
    end

    subgraph AuthPages ["Auth Pages"]
        LOGIN["/login"]
        SIGNUP["/signup"]
        REGINST["/register-institution"]
    end

    subgraph Interview ["Interview Flow"]
        IVIEW["/interview/{sessionId}<br/>Live Interview UI"]
        ICOMP["/interview/components<br/>Reusable Interview Components"]
    end

    subgraph Dashboards ["Dashboard Portals"]
        DASH["/dashboard/{portalType}<br/>B2C Performance Dashboard"]
        B2B["/dashboard/b2b<br/>B2B Institutional View"]
        MENT["/dashboard/mentor<br/>Mentor Student Mgmt"]
    end

    subgraph AdminPages ["Admin Portals"]
        ADMIN["/admin<br/>Question Moderation"]
        SUPER["/superadmin<br/>Platform Management"]
    end

    subgraph Utility ["Utility"]
        USAGE["/usage<br/>Usage & Billing"]
        NOTF["/not-found<br/>404 Page"]
    end

    HOME --> LOGIN
    HOME --> SIGNUP
    LOGIN --> DASH
    LOGIN --> B2B
    LOGIN --> MENT
    DASH --> IVIEW
    IVIEW -->|completed| DASH

    style Public fill:#1a1a2e,stroke:#e94560,color:#fff
    style AuthPages fill:#e94560,color:#fff
    style Interview fill:#0f3460,color:#fff
    style Dashboards fill:#533483,color:#fff
    style AdminPages fill:#16213e,color:#fff
```

---

## 13. Directory Structure

```
f:\project\aicoach\
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── api/                      # API Route Handlers
│   │   │   ├── auth/                 # login, signup, logout, otp, status, reset-password
│   │   │   ├── interview/            # start, transcribe, tts, sessions, dashboard
│   │   │   │   └── [sessionId]/      # answer, end, report, resume, retake
│   │   │   ├── admin/                # pool, flagged, question-flags, institutions
│   │   │   ├── mentor/               # invite, students, approve, requests, profile
│   │   │   ├── chat/messages/        # In-app messaging
│   │   │   ├── contact/              # Contact form
│   │   │   ├── institution/register/ # B2B institution registration
│   │   │   ├── user/                 # proficiency, recommendations
│   │   │   └── students/             # Student listing
│   │   ├── components/               # Shared UI components
│   │   │   └── ui/                   # Base UI primitives
│   │   ├── interview/                # Interview session pages
│   │   │   ├── [sessionId]/          # Live interview page
│   │   │   └── components/           # Interview-specific components
│   │   ├── dashboard/                # Dashboard pages
│   │   │   ├── [portalType]/         # B2C dynamic dashboard
│   │   │   ├── b2b/                  # Institutional dashboard
│   │   │   └── mentor/               # Mentor dashboard
│   │   ├── admin/                    # Admin panel
│   │   ├── superadmin/               # Superadmin panel
│   │   ├── login/ | signup/          # Auth pages
│   │   └── page.tsx                  # Landing page
│   │
│   ├── lib/                          # Core Business Logic
│   │   ├── interview/                # Interview Engine
│   │   │   ├── orchestrator.ts       # Session lifecycle, turn flow, state machine
│   │   │   ├── feedback.ts           # Per-turn evaluation, adaptive difficulty
│   │   │   ├── deep-dive.ts          # Q7 race, semantic dedupe, sliding window
│   │   │   ├── report.ts             # End-of-session report compilation
│   │   │   ├── llm-gateway.ts        # Multi-provider LLM with fallback chain
│   │   │   ├── cache-seeder.ts       # 3-tier question pool seeding
│   │   │   ├── session-store.ts      # MongoDB + Redis persistence
│   │   │   ├── schemas.ts            # Zod schemas for all data types
│   │   │   ├── schema-shield.ts      # LLM output validation with retry
│   │   │   ├── prompt-builder.ts     # Sandwich prompt construction
│   │   │   ├── dashboard-metrics.ts  # Dashboard aggregation (pure)
│   │   │   ├── groq-stt.ts           # Groq Whisper speech-to-text
│   │   │   ├── tts.ts                # Edge TTS text-to-speech
│   │   │   ├── notifier.ts           # Report-ready notifications
│   │   │   ├── resource-matcher.ts   # Resource matching for reports
│   │   │   ├── tier-gate.ts          # Feature gating by subscription tier
│   │   │   ├── duration.ts           # Duration → question count mapping
│   │   │   └── browser/              # Client-side analysis modules
│   │   │       ├── vision-analyzer.ts    # MediaPipe face + pose analysis
│   │   │       ├── audio-analyzer.ts     # Speech metrics (WPM, fillers, pauses)
│   │   │       ├── metrics.ts            # Pure metric math (moving average, etc.)
│   │   │       └── realtime-coach.ts     # Live coaching nudges
│   │   ├── dashboard-suite/          # Dashboard data layer
│   │   │   ├── types.ts              # Shared dashboard types
│   │   │   ├── report-payload.ts     # Report payload construction
│   │   │   ├── per-turn.ts           # Per-turn strengths/improvements
│   │   │   ├── cohort-metrics.ts     # B2B cohort aggregation
│   │   │   ├── recommendation.ts     # Resource recommendation engine
│   │   │   ├── poll-machine.ts       # Report status polling
│   │   │   ├── profile-validation.ts # Profile data validation
│   │   │   ├── timeline.ts           # Behavioral timeline
│   │   │   ├── access.ts             # Dashboard access control
│   │   │   ├── pdf-model.ts          # PDF report generation model
│   │   │   └── constants.ts          # Dashboard constants
│   │   ├── question-pool/            # Question selection
│   │   │   ├── question-selector.ts  # Selection algorithm
│   │   │   └── quality-gate.ts       # Question quality validation
│   │   ├── pool-warmer/              # Background pool warming
│   │   │   ├── warmer.ts             # Pool warming orchestrator
│   │   │   ├── generation-queue.ts   # Generation job queue
│   │   │   ├── gap-analyzer.ts       # Coverage gap detection
│   │   │   └── enhanced-prompt.ts    # Enhanced generation prompts
│   │   ├── proficiency/              # Skill proficiency tracking
│   │   │   ├── proficiency-engine.ts # Core proficiency calculations
│   │   │   ├── elo-calculator.ts     # ELO-based skill rating
│   │   │   └── decay-model.ts        # Skill decay over time
│   │   ├── auth.ts                   # Authentication helpers
│   │   ├── mongodb.ts                # MongoDB client singleton
│   │   ├── redis.ts                  # Redis client with in-memory fallback
│   │   ├── profile.ts                # User profile helpers
│   │   ├── assessment.ts             # Assessment utilities
│   │   └── taxonomy.ts               # Topic/skill taxonomy
│   │
│   ├── scripts/                      # Utility scripts
│   └── proxy.ts                      # Dev proxy configuration
│
├── testing/                          # Test infrastructure
├── md-files/                         # Project documentation
├── interview-section-details/        # Interview config details
├── vitest.config.ts                  # Vitest configuration
├── next.config.ts                    # Next.js configuration
├── package.json                      # Dependencies
└── tsconfig.json                     # TypeScript configuration
```

---

## 14. Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Framework** | Next.js 16 (App Router) | Full-stack React framework, SSR + API routes |
| **Language** | TypeScript 5 | Type-safe development |
| **UI** | React 19, Tailwind CSS 4, Lucide Icons | Component library & styling |
| **Database** | MongoDB 7 | Primary data store (users, sessions, reports, questions) |
| **Cache** | Redis (ioredis) / In-Memory fallback | Session pool cache, report status cache |
| **LLM — Primary** | Google Gemini 2.5 Flash | Question generation, answer evaluation, narratives |
| **LLM — Fallbacks** | Groq, NVIDIA NIM, OpenRouter, OpenAI | Multi-provider resilience chain |
| **Speech-to-Text** | Groq Whisper Large v3 | Verbatim audio transcription |
| **Text-to-Speech** | Microsoft Edge TTS | Question audio playback |
| **Computer Vision** | MediaPipe (Face + Pose Landmarker) | Eye contact, emotion, posture analysis |
| **Audio Analysis** | Web Speech API + WebAudio | WPM, filler words, pauses, sentiment |
| **Validation** | Zod 4 | Schema validation (input payloads + LLM output) |
| **Auth** | Cookie-based sessions + bcryptjs | Custom auth with session tokens |
| **PDF** | jsPDF | Report PDF generation |
| **Testing** | Vitest, fast-check | Unit tests + property-based testing |

---

## 15. Key Design Decisions

> [!IMPORTANT]
> **No raw media on the server** — All audio/video processing happens in the browser via MediaPipe and Web APIs. Only numeric arrays and transcripts cross the network boundary (Req 15).

> [!TIP]
> **Schema Shield pattern** — Every LLM response is validated through a Zod schema with automatic re-prompting (up to 3 retries). This ensures type-safe, structured AI output throughout the system.

> [!NOTE]
> **Dependency injection throughout** — All I/O operations (DB, LLM, time, ID generation) are injected via typed interfaces (`OrchestratorStore`, `FeedbackStore`, `DeepDiveStore`, etc.), enabling pure-function unit testing without mocks.

> [!NOTE]
> **Dual-database architecture** — B2C users are stored in `aicoach`, institutional users in `aicoach_institutional`. The `getInterviewDb()` function auto-selects based on the authenticated user's role.

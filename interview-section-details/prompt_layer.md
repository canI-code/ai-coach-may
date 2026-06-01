**Architecture Specification: The Prompt Layer (prompt\_builder.py)**

**1. Executive Summary & Design Philosophy**

The **Prompt Layer** acts as the deterministic bridge between the stateful application orchestrators (interview\_orchestrator.py, feedback\_orchestrator.py, report\_orchestrator.py) and the completely stateless **Claude LLM API**.

Because large language models (LLMs) are natively non-deterministic, they are prone to conversational drift, markdown hallucinations (such as wrapping outputs in unnecessary text block flags), and systemic instruction leakage. The Prompt Layer is designed to isolate, wrap, and format runtime variables into an airtight string wrapper known as the **Sandwich Prompt**. This strict formatting ensures that Claude consistently delivers high-speed, structured JSON outputs that perfectly match your backend's Pydantic validation schemas.

**2. Architectural Blueprint: The "Sandwich Prompt" Model**

Every prompt dispatched across the B2C core application journey follows a strict, modular structural pattern. It is split into three separate structural blocks:

+-------------------------------------------------------------+

| TOP BRICK: Persona, System-Level Rules, & Behavioral Bounds |

+-------------------------------------------------------------+

| MIDDLE BRICK: Dynamic RAG Variables & Session State Context |

+-------------------------------------------------------------+

| BOTTOM BRICK: Pydantic Schema Declarations & Output Guards |

+-------------------------------------------------------------+

**A. The Top Brick (Persona & Guardrails)**

* **Purpose:** Sets the behavioral bounds, operational boundaries, and tone of the AI agent.
* **Logic:** Dynamically pulls the ai\_persona\_selection profile configuration variable set by Pro/Enterprise users (e.g., stress\_interviewer, tech\_lead, general\_recruiter) and injects hard operational constraints.
* **Core Rule:** Explicitly forbids conversational small talk, prefaces, or markdown wrapping strings (e.g., ```json).

**B. The Middle Brick (Dynamic RAG & Context Injection)**

* **Purpose:** Injects the active session state and runtime parameters into the prompt text.
* **Logic:** The active orchestrator queries MongoDB and the Redis cache, then populates specific string template parameters within this block:
  + session.entity\_tags (extracted profile skills, target role, experience levels).
  + Spoken text answer transcripts captured from the user.
  + Aggregated frontend non-verbal scores (WPM, eye contact intervals, filler word counts).
  + exclusion\_array containing all pre-fetched question records in the active Redis pool to guarantee zero duplication.

**C. The Bottom Brick (JSON Schema Enforcement)**

* **Purpose:** Outlines the strict structural parameters expected by the application's backend parsing layer.
* **Logic:** Maps out a raw, explicit JSON notation skeleton that directly mirrors your system's respective Pydantic model schemas.

**3. Token Management & Sliding Window Compression**

Because long-running interviews generate massive amounts of transcript data, the prompt layer employs a **Sliding Context Window** to prevent token bloat, reduce latency, and lower API usage costs:

* **Turn-by-Turn Dynamic Feedback Loop:** When evaluating answers (Turns 3 to 5), the middle brick does not inject full past transcript blocks. It injects a highly compressed, lightweight string array of the *previous scoring history metrics* (e.g., [{"Turn 3": "Score: 78, Topic: FastAPI middleware"}]). This satisfies Claude's need for situational awareness without overloading its token memory payload[cite: 1].
* **The Turn 6 Dynamic Generation Shift:** When the user hits Turn 5, the prompt layer pulls a tight window of *only* the raw transcripts from Questions 3, 4, and 5 to identify a candidate's exact technical threshold[cite: 1]. Everything before Turn 3 is stripped out of the generative prompt, freeing up token room so Claude can construct Question 7 cleanly within its 10-second background execution timeline.

**4. How the Prompt Layer Integrates with Orchestrator Triggers**

The prompt layer is a passive utility layer—it is completely driven by interview\_orchestrator.py or feedback\_orchestrator.py based on where the user is in the application lifecycle[cite: 1].

[Orchestrator Request]

│

▼

1. Gather State (MongoDB/Redis)

2. Pass State to Prompt Builder ──► [PROMPT LAYER (`prompt\_builder.py`)]

│

▼

Assemble Sandwich Prompt

│

▼

[Pydantic Validation Trigger] ◄── [Claude API Call]

│

├──► (Valid JSON) ──► Run Metrics & Save to MongoDB State

└──► (Invalid/Fail) ──► Launch Pydantic Self-Correction Loop

1. **State Gathering:** The active orchestrator fetches current session records[cite: 1].
2. **Prompt Assembly:** The data fields are passed to prompt\_builder.py to compile the specific Sandwich Prompt required for that context[cite: 1].
3. **API Dispatch:** The orchestrator dispatches the generated prompt string to the Claude API endpoint.
4. **The Post-API Guardrail:** When Claude responds, the orchestrator routes the text directly through the **Pydantic Structural Validation Trigger** to confirm schema alignment before parsing scores, running difficulty scaling modifiers, or committing writes to MongoDB[cite: 1].

**5. Defensive Exception Handling & The Pydantic Shield**

+-----------------------------+

| Raw Text from Claude API |

+--------------+--------------+

|

▼

+----------------------------------+

| Pydantic Schema Parsing Validate |

+------------------+---------------+

|

+------------------------+------------------------+

| |

▼ (Success) ▼ (ValidationError)

+--------------------------------+ +----------------------------------+

| Proceed to Post-AI Triggers | | Launch Local JSON Text Repair |

| - Adaptive Difficulty Shift | +------------------+---------------+

| - Free Tier Payload Reduction | |

| - MongoDB State Persistence | ▼

+--------------------------------+ +----------------------------------+

| Retry Loop: Re-Prompt up to 3x |

+----------------------------------+

1. **The Core Validation Layer:** The raw string output returned from the Claude API is never accepted directly by the backend business routers. It must pass through the **Pydantic Structural Validation Trigger** first.
2. **Format Correction:** If the response fails validation (e.g., due to missing fields or truncation), a localized JSON string repair utility strips out any trailing conversational text or markdown code fence artifacts (```json).
3. **Self-Correction Loop:** If validation still fails after cleanup, the orchestrator triggers an immediate retry loop (up to 3 times). It appends the specific validation error details directly onto the top brick and demands a corrected JSON structure from Claude, preventing runtime data corruption across the application's heart.

**Detailed explanation of each component in the prompt layer
1. Data Intake Reservoirs (Top Layer Inputs)**

**1. In-Memory Streaming State & Analytics (The Live Redis Container Inputs)**

This is the live, aggregated state data stored directly within your Redis memory caches (REDIS(in cache)) that is captured on a turn-by-turn or continuous basis:

**A. Session Telemetry & Non-Verbal Analytical Tracking**

* **Overall Vision-Analysis (Entire Session Accumulator):** A rolling memory block that tracks structural moving averages and behavioral indicators compiled from frontend camera streams across all turns processed up to the current milestone.
* **Overall Audio-Analysis (Entire Session Accumulator):** A rolling memory container recording vocal fluency metrics, speech pacing, pitch stability tracking, and cadence arrays over the entire span of the session.

**B. Turn-Specific Execution Parameters**

* **The Question Text:** The exact string of the active question served during the current step.
* **Answer for User (Transcript):** The real-time text payload sent over the WebSocket containing the user's spoken answer transcription.
* **Time Taken to Answer:** An explicit integer variable tracking the duration (in seconds) between the question delivery timestamp and the user's submission action.
* **Difficulty Level:** The structural baseline difficulty index assigned to the current question object.
* **Adaptive Difficulty Level:** The active, floating difficulty index variable scaled dynamically on previous turns based on performance feedback.

**2. Live WebSocket Streaming Ingestion (The Volatile Client Inputs)**

This data is transmitted directly from the client application browser to the backend WebSocket router at regular time intervals during an active answer period:

* **Real-time Voice Metadata Messages:** Continuous packets containing individual Turn WPM data, active filler word tallies, and silence pause durations.
* **Real-time Video Metadata Messages:** Periodic packets (sent every ~2 seconds) delivering instant facial affect labels, structural eye-contact vectors, and spine alignment tracking scores.

**3. Static Persistence Configurations (The MongoDB Tenant Storage)**

These are your baseline structural collections queried from your multi-tenant database cluster (main\_db or an isolated institution database) to establish the top-brick limits and rules:

* **User Profile Snapshots:** The immutable copy of onboarding preferences, career trajectories, and identified weak areas saved at the moment of session initiation.
* **Core Recruiter Style Presets:** The behavioral configurations defining the ai\_persona\_selection style parameters.
* **The Reference Criteria Banks:** Standard question cards, baseline rubrics, and the explicit ideal\_gold\_standard\_answers corresponding to your domain queue items.
* **Feature Gating Policies:** The permission matrices enforcing product boundaries according to user tier or institutional override keys.

**2. Ingestion Triggers & Processing Modules (Yellow Box Top Row)**

Before the prompt strings are built, these specialized utility blocks intercept, transform, and clean the intake variables.

**A. Intercept & Space Check Trigger**

* **What it does:** Runs prior to prompt building to parse route coordinates, request scopes, and determine if the data boundary belongs to a global B2C tenant (main\_db) or an isolated B2B institution database.

**B. Context Isolation / Profile Topology Pre-Processing**

* **What it does:** Takes messy, non-structured user text (resumes, experience paragraphs) and uses a fast entity extractor to condense them into clean, machine-readable session.entity\_tags.

**C. Stateless Context Maintenance / Memory Ingestor**

* **What it does:** Reconstructs conversational history. It takes raw text inputs from previous turns and converts them into dense JSON-like history scorecards, mapping questions to scores while enforcing the exclusion\_array boundaries to prevent repetition.

**D. Operational Gating & Security Injection**

* **What it does:** Injects explicit runtime policy switches directly into the prompt payload layout based on institutional requirements (such as checking live\_hints\_enabled to deactivate feedback text blocks dynamically).

**E. Non-Verbal Data Structuring & Synthesis**

* **What it does:** Takes raw, frontend-computed metrics streamed over WebSockets (WPM, filler word counters, eye contact percentage intervals, posture anomalies) and compiles them into a clean key-value text payload.

**F. Adaptive Difficulty Configuration**

* **What it does:** Injects the active difficulty index variable (current\_difficulty) into the prompt builder so the generated or selected questions strictly adhere to the candidate's scaling target.

**G. Schema Enforcement Trigger**

* **What it does:** References your application's expected JSON format rules and generates the literal text structure instructions that force the model to output valid parameters matching your Pydantic schemas.

**3. The Core Assembly & Transmission Pipelines**

[Ingestion Triggers]

│ (Pass Clean Component Bricks)

▼

[The "Sandwich" Prompt Assembly Core]

│ (Emits Minified Prompt String)

▼

[API Dispatch Route] ──► [Model Array: Claude / Gemini / Local]

**The "Sandwich" Prompt Assembly Core**

* **Function:** This is your primary string builder tool (prompt\_builder.py). It accepts the outputs from all 7 ingestion triggers above and formats them sequentially. It compiles the **Top Brick** (Persona, rules) , drops in the compressed **Middle Brick** (Context history, user transcripts, metrics) , and pins the **Bottom Brick** (JSON structural expectations).

**API Dispatch Route**

* **Function:** Accepts the completed prompt string and acts as the delivery manager to execute the asynchronous API calls.
* **The Routing Diamonds (Models):** Your diagram illustrates branching connections to various models (**Claude, Gemini, local options**). The dispatch router checks system configurations and dynamically routes the network request to the specified API client layer.

**4. The Business Orchestrator Routing Layer**

Once the raw text string returns from the chosen model API, the architecture passes the response to your three foundational system controllers to process business logic.

* **Interview Orchestrator (interview\_orchestrator.py):** Awakens when the API call is explicitly handling question generation tasks (like building a fresh on-demand question or executing the Turn 6 background buffer generation loop).
* **Feedback Orchestrator (feedback\_orchestrator.py):** Awakens when the API call handles step-by-step performance reviews over the live WebSocket path.
* **Report Orchestrator (report\_orchestrator.py):** Awakens when the session terminates, executing asynchronous background Celery scripts to compile overall metric sheets.

**5. The Post-AI Pipeline & The Pydantic Shield**

The orchestrators do not deal with raw text outputs. Every incoming string must clear this strict post-processing workflow before hitting your databases.

[Raw Model API Response Text]

│

▼

┌─────────────────────────────────────┐

│ The Pydantic Structural Validator │ ◄─── [Fails: Re-Prompt Retry Loop 3x]

└──────────────────┬──────────────────┘

│ (Passes: Emits Clean Object)

▼

[Active Session Injection] ──► Writes to MongoDB Live Collections

│

▼

[The DB Convertor Tool] ──► Normalizes data records for storage

│

▼

[STORE DATA]

**A. The Pydantic Structural Validation Trigger**

* **Execution Logic:** All three business orchestrators must pass their raw model strings straight through this validation checker before running any internal logic.
* **Error Trapping:** It ensures the JSON keys are uncorrupted. If a parsing anomaly occurs, it intercepts the exception and fires the **Self-Correction Re-Prompt Loop** (up to 3 times), feeding the validation schema rules back to the API dispatch layer to force a structural correction.

**B. The Active Session Injection Trigger**

* **Execution Logic:** Runs immediately after the Pydantic structural validation block clears the object. It handles live state modifications:
  + Injects freshly generated questions directly into the active session array.
  + Applies the *Adaptive Difficulty Modifier* rules to scale up or down the session metrics.
  + Executes the *Subscription Data Reduction Trigger* to drop premium parameters if the user is verified as a Free tier client.

**C. The DB Convertor Tool**

* **Execution Logic:** A localization utility class that prepares the verified Python object payload for long-term database storage. It converts native types, strips internal session properties, attaches system log tags (like is\_validated: false or status: "pending" for AI-generated assets), and structures the document cleanly for MongoDB.

**6. Persistence Destinations (Bottom Layer Outputs)**

* **STORE DATA (MongoDB Single Cluster):** Your asynchronous persistence database where state documents are permanently committed.
* **System Event Core:** Executes final post-processing side effects once storage is completed successfully:
  + Delivers fresh question strings down the WebSocket pipeline.
  + Compiles final, clean analytical summaries inside Celery background workers.
  + Matches identified skill gaps against your curated learning resources and fires off email or in-app notification alerts.

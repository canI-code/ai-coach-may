**Module Specification:** app/orchestrator/

**1.** interview\_orchestrator.py

**System Prompt & Context Rule for Code Generation**

Generate an async class InterviewOrchestrator handling the B2C mock interview lifecycle using Motor (async MongoDB) and a Redis client. Enforce strict type hinting (str, int, dict, list, Optional). Implement a 10-second timeout race condition for background AI calls using asyncio.wait\_for.

**A. Endpoint Hook & Execution Triggers**

1. POST /interview/start **(Synchronous Route Hook):** Validates monthly interview limits against user metadata. Calls ai\_profile\_analyst, seeds the 16-question hybrid cache pool in Redis, and serves Turn 1.
2. **WebSocket Loop Checkpoint (**on\_message: answer\_submit **where** index == 4**):** Fires asynchronously when a user submits their 5th answer (index 4). It immediately serves the Turn 6 buffer question from Redis cache while concurrently launching an background task to compile the dynamic Deep-Dive Question 7 via Claude.
3. POST /interview/{session\_id}/resume **(State Recovery Route Hook):** Rebuilds active WebSocket parameters by fetching the last active state index and current difficulty index out of MongoDB.

**B. Input/Output Object Contracts (Pydantic / Dict Typing)**

* **Inputs:**
  + user\_id: str (The main B2C or multi-tenant B2B student tracking ID).
  + config: dict -> { "role": str, "difficulty": int, "question\_count": int, "ai\_persona": str }.
  + redis\_session\_cache: dict -> { "session\_id": str, "current\_question\_index": int, "current\_difficulty": int }.
  + exclusion\_array: list[str] -> List of MongoDB string ObjectIDs representing all 15 pre-fetched or previously served questions.
  + source\_transcripts: list[str] -> Raw verbal texts collected from the current loop’s domain metrics.
* **Outputs:**
  + response\_payload: dict -> { "session\_id": str, "question\_text": str, "current\_question\_index": int, "total\_questions": int }.

**C. Detailed Algorithmic Execution Steps (The Code Blueprint)**

Python

# Pseudo-architecture mapping out the Turn 6 Buffer / Turn 7 Parallel Race Condition

async def process\_turn\_five\_submission(session\_id: str, transcript: str):

# 1. Update Turn 5 answer details in Redis

await redis.hset(f"session:{session\_id}:turn:5", "answer", transcript) #[cite: 3]

# 2. Extract buffer Question 6 immediately from pre-fetched Redis cache pool

q6\_data = await redis.lindex(f"session:{session\_id}:cache\_pool", 5) #[cite: 3]

await websocket.send\_json({"type": "question", "index": 5, "data": q6\_data}) #

# 3. Fire parallel background background task for Claude to build Question 7

try:

source\_transcripts = await redis.hmget(f"session:{session\_id}:transcripts", "q3", "q4", "q5") #[cite: 3]

exclusion\_array = await redis.smembers(f"session:{session\_id}:exclusions") #[cite: 3]

# Enforce the strict 10-second timeout race condition guard

q7\_payload = await asyncio.wait\_for(

claude\_service.generate\_deep\_dive\_q7(source\_transcripts, exclusion\_array),

timeout=10.0

) #

# Pass the raw Claude text string directly to the Pydantic Structural Validator

validated\_q7 = QuestionCollectionSchema(\*\*q7\_payload) #

# Verify it is not semantically identical to the cover backup question

if not semantic\_duplicate\_check(validated\_q7.generated\_question, q6\_data):

await redis.lset(f"session:{session\_id}:cache\_pool", 6, validated\_q7.dict()) #[cite: 3]

# Push an unverified clone to pending\_questions for human validator audits

await db.main\_db.pending\_questions.insert\_one({

"question\_text": validated\_q7.generated\_question,

"ideal\_gold\_standard\_answer": validated\_q7.ideal\_gold\_standard\_answer,

"status": "pending",

"is\_validated": False

}) #

except asyncio.TimeoutError:

# If execution hits T >= 10s, fallback seamlessly to pre-cached cover question

log\_warning("Claude hung > 10s. Falling back to pre-seeded cover question.") #

pass

**2.** feedback\_orchestrator.py

**System Prompt & Context Rule for Code Generation**

Generate an async class FeedbackOrchestrator to execute inside a live FastAPI WebSocket task. The script must aggregate continuous biometric arrays buffered in Redis, assemble an evaluation prompt, process the output through a Pydantic schema guardrail, scale interview difficulties, and enforce tier-based feature gating.

**A. Endpoint Hook & Execution Triggers**

1. **WebSocket Native Milestone (**on\_message: answer\_submit**):** Automatically called the millisecond a candidate submits their final spoken verbal text transcript for an active turn.

**B. Input/Output Object Contracts (Pydantic / Dict Typing)**

* **Inputs:**
  + session\_id: str (UUID reference mapping to the active MongoDB record).
  + user\_submitted\_transcript: str (The raw text string decoded from the browser's Web Speech API).
  + redis\_biometric\_buffer: dict -> { "wpm\_arr": list[float], "filler\_count": int, "eye\_contact\_arr": list[float], "posture\_arr": list[float] }.
* **Outputs:**
  + ws\_client\_payload: dict -> Fields mapping to QuestionEvaluationSchema.

**C. Detailed Algorithmic Execution Steps (The Code Blueprint)**

1. **Biometric Aggregation:** Pull the accumulated arrays out of Redis for the specific question turn index. Compute moving averages for wpm, eye\_contact\_percentage, and posture\_score[cite: 1, 3].
2. **Context Construction:** Pull the active question's text string and corresponding ideal\_gold\_standard\_answer out of Redis[cite: 1, 3]. Query the user's billing tier status (free, pro, enterprise).
3. **Prompt Layer Handshake:** Call prompt\_builder.py passing the aggregated analytics and text states to compile the **Evaluation Sandwich Prompt**.
4. **The Pydantic Shield Guard:** Dispatch the string payload to the Claude client wrapper. Intercept the raw response and map it directly to QuestionEvaluationSchema. If a validation or formatting exception is thrown, capture the raw error text, append it as a programmatic warning, and pass it into a recursive loop to re-prompt Claude up to 3 times before failing.
5. **Adaptive Difficulty & Subscription Modification Trigger:**
   * Read the validated object's difficulty\_adjustment flag (increase, same, decrease). Update the current\_difficulty metrics inside Redis and MongoDB instantly so the next question chunk scales with the user[cite: 1, 3].
   * If the user's tier evaluates to free, strip out the feedback\_text, strengths, and improvements sub-arrays from the JSON payload entirely to prevent feature leakage[cite: 1, 3].
6. **State DB Persistence Trigger:** Execute a high-speed async Motor query to permanently update the turn's metrics inside the MongoDB session history. Forward the filtered payload down the active WebSocket to the frontend user.

**3.** report\_orchestrator.py

**System Prompt & Context Rule for Code Generation**

Generate an async class ReportOrchestrator implemented as an offline background analytics processor running inside a Celery task queue framework. It must compile aggregate performance matrices from individual turns, extract skill gap indicators, run resource lookups, and dispatch multi-channel alerts.

**A. Endpoint Hook & Execution Triggers**

1. **WebSocket Native Milestone (**on\_message: end\_session**):** Triggered when the interview loop reaches its sequential question cap or when a user explicitly exits early, firing generate\_report.delay(session\_id) down the Celery task queue.
2. **Razorpay Billing Webhook Request (**payment.captured**):** Fires asynchronously when a free user captures a manual payment token to process and unlock their detailed historical report dashboard view.

**B. Input/Output Object Contracts (Pydantic / Dict Typing)**

* **Inputs:**
  + session\_id: str (The primary document lookup key for the MongoDB target).
* **Outputs:**
  + report\_document: dict -> { "report\_id": str, "ci\_score": int, "skill\_gaps": list[str], "curated\_learning\_path": list[dict], "report\_status": str }.

**C. Detailed Algorithmic Execution Steps (The Code Blueprint)**

1. **State Aggregation:** Fetch the entire historical interview session array from the MongoDB target database. Compute the average score index across all questions for four foundational metrics: technical\_accuracy, communication, voice\_ci, and body\_ci.
2. **The Confidence Index (CI) Equation:** Run the backend's explicit performance score formula:

$$\text{CI Score} = (\text{Technical Accuracy} \times 0.35) + (\text{Communication} \times 0.25) + (\text{Voice CI} \times 0.20) + (\text{Body CI} \times 0.20)$$

1. **Identify Skill Gaps & Weakness Indicators:** Check the overall compiled averages for each individual evaluation category. Any domain area scoring strictly below the baseline parameter threshold of **65** must be flagged as an active skill gap and appended to an operational weakness\_tags array.
2. **Curated Link Matchmaking Engine (The Multi-Tenant RAG Trigger):** Execute a query look-up against the resources collection. Intersect the weakness\_tags with the resource document tags. Force an asymmetric sort priority pattern: if the user's session claims contain a B2B institution\_code, prioritize custom mentor resources matching that code before pulling standard B2C global items. Limit the total results slice to 5 items.
3. **Narrative Report Summarization:** Pass the aggregate metrics, skill gaps, and the filtered learning resources payload over to Claude. Instruct it to return a clean, schema-verified narrative summary detailing exactly how these specific recommended courses or documents will resolve the candidate's discovered functional gaps.
4. **State Commitment & Notification Dispatch:** Commit the completed static report artifact directly into the MongoDB records, set the tracking status field to ready, and fire off separate background handler triggers to write an in-app alert notification and execute a fastapi-mail SMTP email payload[cite: 1].

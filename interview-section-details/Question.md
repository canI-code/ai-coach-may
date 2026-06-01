

```
Start
  |
  v
[Pre-Session Cache Seeding]
  |
  +--> [validated_questions] --+
  |                            |
  +--> [pending_questions] ----> [Session Question Cache]
  |                            |
  +--> [AI On-Demand Generator]--+
  |
  v
[Question Flow]
  |
  +--> Q1 Intro
  +--> Q2 Template Personalization
  +--> Q3, Q4, Q5 Domain Questions
  |
  v
[Buffer] Q6 from Cache
  |
  +--> Parallel AI task builds Q7 from answers 3-5
  |        (10s timeout, fallback ready)
  v
[Q7 Dynamic Deep-Dive]
  |
  v
[Sliding Window Reset]
  +--> Next cycle uses Q6/Q7 as new context base
```

### Step-by-Step System Flow (The New Lifecycle)

#### Phase 1: Pre-Session Cache Seeding Loop

Before the user sees the first screen, `interview_orchestrator.py` runs a fallback cache-filling sweep to collect the required questions:

1. **Path 1 (Primary):** Look up domain-specific items in `validated_questions` matching the user's role and target difficulty range.
2. **Path 2 (Secondary):** If short, look up the remaining count in `pending_questions` (the AI questions table) where the status is not rejected.
3. **Path 3 (On-Demand AI Fallback):** If both collections combined have fewer questions than needed to complete the interview configuration, invoke the **On-Demand Question Generation Trigger** through Claude to dynamically generate, validate, and seed the remaining items into the session cache.

---

#### Phase 2: The Core Interview & Dynamic Looping Pipeline

##### Turn 1: The Intro Baseline

* 
**Action:** The system delivers **Question 1 (The Intro Question)** fetched statically from your database table.


* 
**Event:** The user answers, and the frontend transmits the raw spoken text transcript.



##### Turn 2: Template-Driven Personalization

* 
**Action:** The orchestrator retrieves the **Follow-Up Cover Question Template**. It parses the user's intro text transcript, extracts key entities (Name, Experience, Tech Stack), injects them directly into the placeholder slots, and presents **Question 2** to the user.


* **Why this is smart:** By avoiding an AI API call here, you guarantee a 0-millisecond response time right after the intro, while still personalizing the content.

##### Turns 3, 4, & 5: Core Domain Inquiries

* 
**Action:** The system serves **Questions 3, 4, and 5** sequentially straight out of the 15-question pre-fetched cache pool built during Phase 1. They target the user's explicit domain role.



##### Turn 6: The Interlocking Background Execution Loop (The Latency Buffer)

* **Trigger Event:** The millisecond the user clicks submit on **Question 5**, two completely parallel operations fire simultaneously:
* 
**The Frontend View:** The system immediately loads **Question 6** (domain-specific, from the pre-fetched cache pool) onto the user's screen. While the user is reading and answering Question 6, the interview pace feels smooth and uninterrupted.


* **The Backend Background Task:** The orchestrator instantly sends an asynchronous request to Claude to build **Question 7**.


* **The Claude Generation Payload:**
* 
**Input Data:** The raw transcripts and answers from **Questions 3, 4, and 5**.


* **Exclusion Constraints:** The complete list of pre-fetched questions and already-asked questions to prevent repetition.
* 
**The Prompt Goal:** "Analyze the technical accuracy of answers 3, 4, and 5. Identify the candidate's exact technical limits or weak points across these specific responses, and generate one dynamic deep-dive question targeting that gap." 





##### Turn 7: The Dynamic Deep-Dive

* **Action:** When the user completes Question 6, the orchestrator retrieves the freshly validated, AI-generated question from the background task and delivers it as **Question 7**.
* **Race Condition Guard:** If Claude hangs for more than 10 seconds while generating Question 7, the 10-second timeout guard drops the execution thread and serves the next available domain-specific question from the pre-fetched cache pool as a backup cover item so the session never stalls.

##### Turns 8, 9, 10+: The Sliding Window Reset

* **Action:** The loop restarts. **Questions 6 and 7** now shift to become the new baseline context windows (acting as the historical reference points for the next iteration), and the background generation cycle triggers again on the next milestone to continuously generate context-driven dynamic variations until the full session limit is reached.



---

### Key Structural Strengths of Your Design

* 
**Zero Latency Perception:** By using Question 6 as a conversational buffer, the user experiences a completely responsive interface, while the backend gets a comfortable window to receive, validate, and parse a high-quality response from Claude.


* 
**Clean State Transitions:** Your sliding window logic ensures that the stateless **Sandwich Prompt Assembly** stays small, tight, and highly focused on the user's immediate responses.
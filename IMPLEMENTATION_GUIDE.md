# InterviewCoach — AI Interview Coach: Full Implementation Guide

> **For AI IDEs (Cursor, Windsurf, VS Code + Copilot, etc.)**
>
> This document is a precise, step-by-step implementation plan. Follow it **in order**. Do not skip steps. Do not install unlisted packages. Do not invent APIs or endpoints. When a decision is marked **[FIXED]**, do not deviate. When marked **[CHOICE]**, pick one and note it in a `decisions.md` log at project root.

---

## 0. Before You Write Any Code

### 0.1 Create `decisions.md` at project root

```markdown
# Project Decisions Log
- Date: <today>
- STT Provider: [CHOICE: deepgram | whisper]
- Database: mongodb
- LLM Provider: [CHOICE: claude | gemini]
```

Fill this in **before** generating any files. Reference it throughout.

### 0.2 Repository Structure to Create

```
interviewcoach/
├── frontend/          ← React app
├── backend/           ← FastAPI app
├── decisions.md
└── docker-compose.yml
```

Do not create any other top-level directories.

---

## 1. Frontend — React Setup

### 1.1 Bootstrap

```bash
cd interviewcoach/frontend
npm create vite@latest . -- --template react-ts
npm install
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### 1.2 Install Only These Packages

```bash
npm install socket.io-client
npm install @radix-ui/react-progress @radix-ui/react-badge
npm install lucide-react
npm install zustand
npm install axios
```

Do **not** install video or audio processing libraries on the frontend. All AI processing happens on the backend.

### 1.3 Environment Variables

Create `frontend/.env`:

```env
VITE_BACKEND_WS_URL=ws://localhost:8000/ws
VITE_BACKEND_HTTP_URL=http://localhost:8000
```

Access in code via `import.meta.env.VITE_BACKEND_WS_URL` — do **not** use `process.env`.

### 1.4 Directory Structure to Create Under `frontend/src/`

```
src/
├── main.tsx                            ← app entry point
├── App.tsx                             ← router root
├── pages/
│   ├── Home.tsx                        ← landing / auth stub
│   ├── Interview.tsx                   ← live interview UI (/interview/:sessionId)
│   └── Report.tsx                      ← post-interview report (/report/:sessionId)
├── components/
│   ├── LiveCoachingPanel.tsx
│   ├── VideoPreview.tsx
│   ├── RealtimeMetricsBadge.tsx
│   └── PostInterviewReport.tsx
├── hooks/
│   ├── useMediaCapture.ts          ← webcam + mic
│   ├── useWebSocket.ts             ← ws connection + message handling
│   └── useInterviewSession.ts      ← session state via zustand
├── lib/
│   ├── api.ts                      ← axios HTTP client
│   └── constants.ts                ← thresholds mirrored from backend
└── types/
    └── index.ts                    ← shared TypeScript types
```

Install `react-router-dom` for routing:

```bash
npm install react-router-dom
```

Use `BrowserRouter` + `Routes` in `App.tsx`. Use `useParams()` to read `:sessionId` in Interview and Report pages.

Create every file listed. Empty stubs with a `// TODO` comment are acceptable if not immediately implemented, but the file must exist.

### 1.5 Media Capture — `useMediaCapture.ts`

Implement exactly this logic:

1. Call `navigator.mediaDevices.getUserMedia({ video: true, audio: true })`.
2. Attach the stream to a `<video>` element ref for preview (no recording on this element).
3. Create a `MediaRecorder` instance from the same stream.
4. Set `timeslice` to **7000 ms** (7 seconds per chunk).
5. On each `ondataavailable` event, convert the `Blob` to `ArrayBuffer` and send over the WebSocket connection established in `useWebSocket`.
6. Expose: `{ videoRef, startCapture, stopCapture, isCapturing }`.

Do **not** save chunks to `localStorage`. Do **not** upload chunks via HTTP. Chunks go over WebSocket only.

### 1.6 WebSocket Client — `useWebSocket.ts`

1. Connect to `${import.meta.env.VITE_BACKEND_WS_URL}/interview/{sessionId}`.
2. The server sends JSON messages. Parse every incoming message and dispatch to the zustand store.
3. Incoming message shape (do not deviate):

```typescript
type ServerMessage =
  | { type: "realtime_feedback"; payload: RealtimeFeedback }
  | { type: "session_complete"; payload: { reportId: string } };
```

4. Expose: `{ sendChunk(blob: Blob): void, lastMessage: ServerMessage | null, connected: boolean }`.

### 1.7 TypeScript Types — `types/index.ts`

Define these types and **no others** at this stage:

```typescript
export interface RealtimeFeedback {
  wpm: number;
  eye_contact_score: number;         // 0–100
  posture_ok: boolean;
  filler_word_count: number;
  dominant_emotion: string;
  warnings: string[];                // e.g. ["speaking_too_fast"]
  timestamp_seconds: number;
}

export interface InterviewSession {
  sessionId: string;
  startedAt: string;                 // ISO 8601
  status: "idle" | "active" | "complete";
}

export interface CoachingReport {
  reportId: string;
  sessionId: string;
  communication_score: number;       // 0–100
  confidence_score: number;
  professional_presence_score: number;
  behavioral_timeline: TimelineEvent[];
  llm_coaching_text: string;
  improvement_suggestions: string[];
}

export interface TimelineEvent {
  timestamp_seconds: number;
  label: string;
  severity: "info" | "warning" | "critical";
}
```

---

## 2. Backend — FastAPI Setup

### 2.1 Bootstrap

```bash
cd interviewcoach/backend
python3 -m venv venv
source venv/bin/activate
```

### 2.2 `requirements.txt` — Install Exactly These

```
fastapi==0.111.0
uvicorn[standard]==0.29.0
python-multipart==0.0.9
websockets==12.0
pydantic==2.7.1
pydantic-settings==2.2.1

# Audio
openai-whisper==20231117        # if CHOICE = whisper
deepgram-sdk==3.2.0             # if CHOICE = deepgram
opensmile==2.5.0
librosa==0.10.1
soundfile==0.12.1

# Vision
mediapipe==0.10.14
opencv-python-headless==4.9.0.80
deepface==0.0.93
numpy==1.26.4

# LLM
anthropic==0.27.0               # if CHOICE = claude
google-generativeai==0.5.4      # if CHOICE = gemini

# Database
motor==3.4.0
beanie==1.25.0
```

Install with:

```bash
pip install -r requirements.txt
```

Do **not** add packages not listed here without documenting in `decisions.md`.

### 2.3 Environment Variables

Create `backend/.env`:

```env
# App
APP_ENV=development
SECRET_KEY=change_me_in_production

# Database
MONGODB_URI=mongodb://localhost:27017/interviewcoach

# STT — fill ONE based on your CHOICE
DEEPGRAM_API_KEY=
# OR
WHISPER_MODEL_SIZE=base   # options: tiny | base | small

# LLM — fill ONE based on your CHOICE
ANTHROPIC_API_KEY=
GOOGLE_API_KEY=
```

### 2.4 Backend Directory Structure

```
backend/
├── main.py
├── .env
├── requirements.txt
├── app/
│   ├── __init__.py
│   ├── config.py                   ← pydantic-settings BaseSettings
│   ├── database.py                 ← DB connection + session factory
│   ├── models/
│   │   ├── __init__.py
│   │   ├── session.py              ← InterviewSession Beanie document
│   │   ├── report.py               ← CoachingReport Beanie document
│   │   └── timeline.py             ← TimelineEvent (embedded in report)
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── realtime.py             ← RealtimeFeedback pydantic schema
│   │   └── report.py               ← CoachingReport pydantic schema
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── sessions.py             ← POST /sessions, GET /sessions/{id}
│   │   ├── reports.py              ← GET /reports/{reportId}
│   │   └── websocket.py            ← WS /ws/interview/{sessionId}
│   ├── services/
│   │   ├── __init__.py
│   │   ├── audio_service.py        ← STT + audio feature extraction
│   │   ├── vision_service.py       ← MediaPipe + DeepFace pipeline
│   │   ├── scoring_service.py      ← rule-based realtime scoring
│   │   ├── aggregation_service.py  ← post-session metric aggregation
│   │   └── llm_service.py          ← LLM coaching report generation
│   └── utils/
│       ├── __init__.py
│       └── chunk_parser.py         ← split raw WS bytes into audio/video
```

---

## 3. Backend — Implementation Contracts

Each service has a strict input/output contract. Implement exactly these signatures.

### 3.1 `audio_service.py`

```python
async def transcribe_chunk(audio_bytes: bytes) -> str:
    """
    Input:  raw audio bytes (WebM/opus from MediaRecorder)
    Output: transcribed text string (may be empty "")
    Side effects: none
    """

async def extract_audio_features(audio_bytes: bytes) -> dict:
    """
    Input:  raw audio bytes
    Output: {
        "wpm": float,
        "pause_count": int,
        "filler_word_count": int,
        "avg_loudness": float,
        "pitch_variance": float,
        "speaking_rate_label": "slow" | "normal" | "fast"
    }
    Side effects: none
    """
```

**Implementation notes:**
- Write audio bytes to a **temp file** using `tempfile.NamedTemporaryFile(suffix=".webm", delete=False)` before passing to Whisper or Deepgram. Always clean up the temp file in a `finally` block.
- Use `librosa.load()` for feature extraction (returns numpy array + sample rate).
- WPM = word count / (duration in seconds / 60). Duration from `librosa.get_duration()`.
- Filler words to detect: `["um", "uh", "like", "you know", "basically", "literally", "sort of"]` — lowercase string match on transcript.

### 3.2 `vision_service.py`

```python
def extract_frame_features(frame_bytes: bytes) -> dict:
    """
    Input:  single JPEG frame as bytes
    Output: {
        "eye_contact_score": float,      # 0–100
        "head_yaw": float,               # degrees
        "head_pitch": float,             # degrees
        "posture_ok": bool,
        "shoulder_alignment_ok": bool,
        "dominant_emotion": str,         # one of: happy|calm|sad|angry|confused|surprised|neutral
        "emotion_scores": dict           # {"happy": 0.62, "calm": 0.21, ...}
    }
    Side effects: none
    """
```

**Implementation notes:**
- Decode frame bytes with `cv2.imdecode(np.frombuffer(frame_bytes, np.uint8), cv2.IMREAD_COLOR)`.
- Use `mp.solutions.face_mesh.FaceMesh` with `refine_landmarks=True` for gaze/head pose.
- Compute head yaw and pitch from Face Mesh landmarks using the solvePnP method. Do not estimate from raw pixel positions alone.
- Eye contact score: `100` if `abs(yaw) < 10 and abs(pitch) < 10`, linearly decay to `0` at `abs(yaw) > 30` or `abs(pitch) > 30`.
- Use `mp.solutions.pose.Pose` for shoulder landmarks (indices 11 and 12). `shoulder_alignment_ok = True` if the y-difference between the two landmarks is less than `0.05` in normalized coordinates.
- Use `DeepFace.analyze(img, actions=["emotion"], enforce_detection=False)` for emotion. Wrap in `try/except` — return `"neutral"` for all emotion fields on exception.

### 3.3 `scoring_service.py`

```python
def compute_realtime_feedback(
    audio_features: dict,
    frame_features: dict,
    transcript: str,
    elapsed_seconds: float
) -> RealtimeFeedback:
    """
    Input:  outputs of audio_service + vision_service + elapsed time
    Output: RealtimeFeedback pydantic model (matches frontend type exactly)
    Side effects: none — pure function
    """
```

**Threshold logic — implement exactly:**

```python
warnings = []

if audio_features["wpm"] > 170:
    warnings.append("speaking_too_fast")
if audio_features["wpm"] < 90 and audio_features["wpm"] > 0:
    warnings.append("speaking_too_slow")
if audio_features["filler_word_count"] > 3:
    warnings.append("too_many_fillers")
if frame_features["eye_contact_score"] < 60:
    warnings.append("poor_eye_contact")
if not frame_features["posture_ok"]:
    warnings.append("poor_posture")
if frame_features["dominant_emotion"] in ["angry", "sad", "confused"]:
    warnings.append("negative_emotion_detected")
```

Do **not** add thresholds not listed here without updating `decisions.md`.

### 3.4 `llm_service.py`

```python
async def generate_coaching_report(
    aggregated_metrics: dict,
    transcript_full: str,
    timeline_events: list[dict]
) -> dict:
    """
    Input:
        aggregated_metrics: averaged/summarized values across the full session
        transcript_full: full concatenated transcript
        timeline_events: list of {timestamp_seconds, label, severity}
    Output: {
        "communication_score": int,          # 0–100
        "confidence_score": int,
        "professional_presence_score": int,
        "llm_coaching_text": str,
        "improvement_suggestions": list[str] # exactly 3–5 items
    }
    Side effects: none
    """
```

**LLM prompt — use exactly this system prompt:**

```
You are an expert interview coach analyzing a candidate's mock interview performance.
You will receive structured behavioral metrics and a transcript.
Your task is to produce a JSON coaching report. 
Respond ONLY with valid JSON. No markdown, no explanation, no preamble.

The JSON must have exactly these keys:
- communication_score (int 0-100)
- confidence_score (int 0-100)
- professional_presence_score (int 0-100)
- llm_coaching_text (string, 150-250 words, professional and encouraging tone)
- improvement_suggestions (array of 3 to 5 strings, each under 20 words)

Base your scores on the provided metrics, not on general assumptions.
```

**User message format:**

```python
user_message = f"""
BEHAVIORAL METRICS:
{json.dumps(aggregated_metrics, indent=2)}

BEHAVIORAL TIMELINE:
{json.dumps(timeline_events, indent=2)}

INTERVIEW TRANSCRIPT (excerpt, max 1500 chars):
{transcript_full[:1500]}
"""
```

Parse the LLM response with `json.loads()`. If parsing fails, log the raw response and raise a `ValueError("LLM returned non-JSON response")`. Do **not** silently return default values.

### 3.5 `aggregation_service.py`

```python
def aggregate_session_metrics(
    all_audio_features: list[dict],
    all_frame_features: list[dict],
    all_warnings: list[list[str]]
) -> dict:
    """
    Input:  lists of per-chunk outputs from audio/vision services
    Output: {
        "avg_wpm": float,
        "avg_eye_contact_score": float,
        "total_filler_words": int,
        "posture_ok_ratio": float,          # 0.0–1.0
        "dominant_emotions": dict,          # {"calm": 0.62, ...} averaged
        "most_common_warnings": list[str],  # top 3 by frequency
        "avg_loudness": float,
        "avg_pitch_variance": float
    }
    Side effects: none — pure function
    """
```

Use `statistics.mean()` from the standard library. Do not use pandas for this function.

---

## 4. WebSocket Router — `routers/websocket.py`

This is the core orchestration point. Implement this exact flow:

```python
@app.websocket("/ws/interview/{session_id}")
async def interview_websocket(websocket: WebSocket, session_id: str):
    await websocket.accept()
    
    # State for this session
    all_audio_features = []
    all_frame_features = []
    all_warnings = []
    transcript_chunks = []
    timeline_events = []
    elapsed_seconds = 0.0
    chunk_duration = 7.0  # must match frontend timeslice
    
    try:
        while True:
            # 1. Receive raw bytes from frontend
            chunk_bytes = await websocket.receive_bytes()
            
            # 2. Parse chunk into audio_bytes and frame_bytes
            #    See chunk_parser.py — frontend sends a simple envelope
            audio_bytes, frame_bytes = parse_chunk(chunk_bytes)
            
            # 3. Run audio and vision in parallel
            audio_features, transcript = await asyncio.gather(
                extract_audio_features(audio_bytes),
                transcribe_chunk(audio_bytes)
            )
            frame_features = extract_frame_features(frame_bytes)
            
            # 4. Compute realtime feedback (sync, pure function)
            feedback = compute_realtime_feedback(
                audio_features, frame_features, transcript, elapsed_seconds
            )
            
            # 5. Append to session state
            all_audio_features.append(audio_features)
            all_frame_features.append(frame_features)
            all_warnings.append(feedback.warnings)
            transcript_chunks.append(transcript)
            
            # 6. Build timeline events from warnings
            for w in feedback.warnings:
                timeline_events.append({
                    "timestamp_seconds": elapsed_seconds,
                    "label": w,
                    "severity": "warning"
                })
            
            elapsed_seconds += chunk_duration
            
            # 7. Send realtime feedback to frontend
            await websocket.send_json({
                "type": "realtime_feedback",
                "payload": feedback.model_dump()
            })
            
    except WebSocketDisconnect:
        # Session ended — run deep analysis
        aggregated = aggregate_session_metrics(
            all_audio_features, all_frame_features, all_warnings
        )
        full_transcript = " ".join(transcript_chunks)
        report_data = await generate_coaching_report(
            aggregated, full_transcript, timeline_events
        )
        
        # Persist report to DB (call DB layer here)
        report_id = await save_report(session_id, report_data, timeline_events)
        
        # Cannot send over closed WS — store report_id in DB only
        # Frontend will poll GET /reports/{reportId} after disconnect
```

---

## 5. Chunk Envelope Protocol — `utils/chunk_parser.py`

The frontend must send a **binary envelope** per chunk. Define this protocol:

**Frontend sends (in `useMediaCapture.ts`):**

```typescript
// Build envelope: [4-byte audio length (big-endian uint32)] + [audio bytes] + [jpeg frame bytes]
async function buildChunkEnvelope(audioBlob: Blob, videoRef: RefObject<HTMLVideoElement>): Promise<ArrayBuffer> {
  const audioBuffer = await audioBlob.arrayBuffer();
  const frameJpeg = captureFrameAsJpeg(videoRef); // draw canvas, toBlob as image/jpeg
  const frameBuffer = await frameJpeg.arrayBuffer();
  
  const header = new ArrayBuffer(4);
  new DataView(header).setUint32(0, audioBuffer.byteLength, false); // big-endian
  
  return concatenateBuffers(header, audioBuffer, frameBuffer);
}
```

**Backend parses (in `chunk_parser.py`):**

```python
def parse_chunk(data: bytes) -> tuple[bytes, bytes]:
    """
    Parses the envelope: [4-byte header = audio_length] + [audio] + [frame_jpeg]
    Returns: (audio_bytes, frame_bytes)
    Raises: ValueError if data is too short
    """
    if len(data) < 4:
        raise ValueError("Chunk too short to contain header")
    audio_length = int.from_bytes(data[:4], "big")
    if len(data) < 4 + audio_length:
        raise ValueError("Chunk truncated: audio data shorter than declared")
    audio_bytes = data[4:4 + audio_length]
    frame_bytes = data[4 + audio_length:]
    return audio_bytes, frame_bytes
```

Do **not** use JSON to wrap binary data. Do **not** use Base64 encoding in the WebSocket path. Binary envelope only.

---

## 6. HTTP REST Endpoints

Implement these routes and no others at MVP stage:

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| `POST` | `/sessions` | `routers/sessions.py` | Create a new session, return `{ sessionId }` |
| `GET` | `/sessions/{sessionId}` | `routers/sessions.py` | Get session status |
| `GET` | `/reports/{reportId}` | `routers/reports.py` | Get full coaching report |
| `WS` | `/ws/interview/{sessionId}` | `routers/websocket.py` | Live interview stream |

**`POST /sessions` response:**

```json
{ "sessionId": "uuid-v4-string", "status": "idle" }
```

**`GET /reports/{reportId}` response:** must exactly match the `CoachingReport` TypeScript type defined in Section 1.7.

---

## 7. Database Layer — MongoDB + Beanie

Use Beanie with Motor (async MongoDB driver). Define these document models:

```python
# models/session.py
from beanie import Document
from datetime import datetime
from typing import Optional

class InterviewSession(Document):
    session_id: str          # UUID
    started_at: datetime
    ended_at: Optional[datetime] = None
    status: str              # idle | active | complete

    class Settings:
        name = "interview_sessions"

# models/report.py
from beanie import Document
from datetime import datetime
from typing import List

class CoachingReport(Document):
    report_id: str
    session_id: str
    communication_score: int
    confidence_score: int
    professional_presence_score: int
    llm_coaching_text: str
    improvement_suggestions: List[str]
    timeline_events: List[dict]  # embedded — no separate collection needed
    created_at: datetime

    class Settings:
        name = "coaching_reports"
```

`TimelineEvent` is **embedded inside `CoachingReport.timeline_events`** as plain dicts — do not create a separate collection for it.

Initialize Beanie in `database.py` during FastAPI startup:

```python
# database.py
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from app.models.session import InterviewSession
from app.models.report import CoachingReport
from app.config import settings

async def init_db():
    client = AsyncIOMotorClient(settings.MONGODB_URI)
    await init_beanie(
        database=client.get_default_database(),
        document_models=[InterviewSession, CoachingReport]
    )
```

Call `init_db()` in `main.py` via `@app.on_event("startup")`. Do **not** use `create_all()` — Beanie handles collection creation automatically.

---

## 8. `main.py` — FastAPI Application Entry Point

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import sessions, reports, websocket

app = FastAPI(title="InterviewCoach Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # update for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sessions.router, prefix="/sessions", tags=["sessions"])
app.include_router(reports.router, prefix="/reports", tags=["reports"])
app.include_router(websocket.router, tags=["websocket"])

# DB init on startup — call init_db() from database.py here
```

Run with:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

---

## 9. `docker-compose.yml` (Development Only)

```yaml
version: "3.9"
services:
  mongo:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongodata:/data/db

volumes:
  mongodata:
```

---

## 10. Implementation Order

Follow this exact order. Do **not** jump ahead.

```
Phase 1 — Skeleton (no AI yet)
  [ ] Backend: FastAPI app boots, CORS configured, /sessions POST works
  [ ] Database: MongoDB running, Beanie initialized, document models registered
  [ ] Frontend: React boots, env vars loaded, /interview/[sessionId] page exists
  [ ] WebSocket: frontend connects, backend accepts, echo test works

Phase 2 — Media Pipeline
  [ ] Frontend: useMediaCapture captures webcam + mic
  [ ] Frontend: chunk envelope built and sent over WS every 7 seconds
  [ ] Backend: chunk_parser correctly splits audio and frame bytes
  [ ] Backend: temp file write/cleanup for audio works

Phase 3 — AI Services (stub → real)
  [ ] audio_service: transcribe_chunk returns transcript string
  [ ] audio_service: extract_audio_features returns correct dict shape
  [ ] vision_service: extract_frame_features returns correct dict shape
  [ ] scoring_service: compute_realtime_feedback returns RealtimeFeedback

Phase 4 — Realtime Loop
  [ ] WS router: full pipeline runs per chunk (audio + vision in parallel)
  [ ] WS router: RealtimeFeedback sent to frontend as JSON
  [ ] Frontend: LiveCoachingPanel renders warnings + scores

Phase 5 — Deep Analysis
  [ ] aggregation_service: correctly averages session metrics
  [ ] llm_service: sends correct prompt, parses JSON response
  [ ] /reports/{id} endpoint returns full CoachingReport
  [ ] Frontend: PostInterviewReport page renders all fields

Phase 6 — Polish
  [ ] Error handling on all WS exceptions
  [ ] Temp file cleanup verified
  [ ] CORS locked to correct origins
  [ ] .env.example files created (no real keys committed)
```

---

## 11. Hard Rules — Do Not Violate

1. **Never send raw video bytes to the LLM.** Only send `aggregated_metrics` as JSON.
2. **Never run DeepFace or MediaPipe on every single video frame in realtime.** Process one frame per chunk (extract the middle frame of the 7-second segment).
3. **Never store API keys in source code.** Only in `.env` files. Add `.env` to `.gitignore` immediately.
4. **Never use `asyncio.sleep()` as a substitute for real processing.** If a service is not yet implemented, raise `NotImplementedError`.
5. **Never return hardcoded scores from `llm_service.py`.** If the LLM call fails, raise the exception — do not silently return `{"communication_score": 70, ...}`.
6. **The `chunk_parser.py` envelope format is the contract between frontend and backend.** If you change it, update both sides simultaneously.
7. **The TypeScript types in `types/index.ts` and the Python Pydantic schemas in `app/schemas/` must stay in sync.** If you change one, change the other in the same commit.

---

## 12. Known Integration Points That Commonly Break

| Issue | Prevention |
|-------|-----------|
| Whisper receives wrong audio format | Always write to `.webm` temp file. `librosa.load()` handles WebM via `soundfile`. If it fails, convert with `ffmpeg` subprocess: `ffmpeg -i input.webm -ar 16000 -ac 1 output.wav` |
| DeepFace import errors on headless server | Use `opencv-python-headless`, not `opencv-python`. Set `os.environ["CUDA_VISIBLE_DEVICES"] = ""` if no GPU. |
| MediaPipe version conflicts | Pin to `mediapipe==0.10.14`. Do not upgrade without testing. |
| WebSocket binary framing vs text framing | Always use `send_json()` for text messages and `receive_bytes()` for binary. Never mix. |
| CORS blocking WebSocket | WebSocket connections are not blocked by CORS in browsers, but HTTP preflight requests to `/sessions` are. Ensure `CORSMiddleware` is applied before routers. |
| LLM JSON parse failure | Log `repr(raw_response)` before raising. Common cause: model added markdown fences around JSON despite instructions. Strip with `re.sub(r"```json|```", "", text).strip()` as fallback before `json.loads()`. |

---

## 13. What Is Explicitly Out of Scope for MVP

Do **not** implement these until Phases 1–6 are complete and tested:

- User authentication / login
- Multi-user support
- Question bank / interview question generation
- Resume analysis
- Video recording playback
- Mobile responsive UI
- Production deployment / HTTPS / reverse proxy
- GPU inference optimization
- Rate limiting

Document any out-of-scope features attempted in `decisions.md` under an "Early Additions" section.

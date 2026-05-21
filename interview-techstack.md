# AI Interview Coach — Approved Tech Stack & System Architecture

## Project Overview

The project is an AI-powered interview preparation and mock interview coaching platform.

The system analyzes:

1. Audio behavior
2. Facial behavior
3. Body posture
4. Communication confidence
5. Realtime interview performance
6. Post-interview coaching insights

The architecture is divided into two major layers:

* Realtime Coaching Layer
* Deep Analysis Layer

---

# Final Approved Architecture

```text
Frontend Webcam/Mic Stream
        ↓
Realtime Processing Layer
        ↓
Audio Analysis + Video Analysis
        ↓
Realtime Coaching Engine
        ↓
Live Feedback UI
        ↓
--------------------------------
Post Interview Aggregation
        ↓
LLM Behavioral Reasoning
        ↓
AI Coaching Report
```

---

# 1. Frontend Stack

## Recommended Frontend

* React.js
* Next.js

## Browser APIs

### Media Capture

* WebRTC
* MediaRecorder API

## Responsibilities

* Webcam stream capture
* Microphone stream capture
* Chunked recording (5–10 sec)
* Realtime websocket updates
* Live interview dashboard
* Realtime coaching indicators
* Final analytics dashboard

---

# 2. Backend Stack

## Recommended Backend

### Preferred

* FastAPI (Python)

### Alternative

* Node.js

## Responsibilities

* Receive audio/video chunks
* Run AI processing pipelines
* Manage realtime websocket communication
* Aggregate interview metrics
* Trigger LLM evaluation
* Store interview session data

---

# 3. Audio Analysis Architecture

## Approved Stack

### Speech-to-Text

#### Preferred

* Deepgram API

#### Alternative Open Source

* OpenAI Whisper

---

## Audio Feature Analysis

### Tools

* openSMILE
* Hugging Face Transformers

### Optional

* SpeechBrain

---

## Audio Metrics

### Speech Metrics

* Words Per Minute (WPM)
* Speaking pace
* Pause duration
* Silence detection
* Filler word detection
* Confidence trends

### Sentiment Metrics

* Sentiment trajectory
* Emotional shifts
* Communication clarity

### Voice Feature Metrics

* Loudness
* Vocal energy variance
* Pitch variation
* Tone consistency

---

# 4. Body & Face Analysis Architecture

## Approved Stack

### Core Computer Vision Framework

* MediaPipe
* OpenCV
* NumPy

### Emotion Detection

* DeepFace

### Optional Hugging Face Models

* dima806/facial_emotions_image_detection
* trpakov/vit-face-expression

---

# 5. Face Analysis Features

## Facial Expression Analysis

### Emotions Tracked

* Happy
* Calm
* Sad
* Angry
* Confused
* Surprised
* Neutral

### Derived Metrics

* Composure score
* Stress indicator
* Emotional stability
* Confidence trends

---

# 6. Eye Contact & Gaze Tracking

## Technology

* MediaPipe Face Mesh
* MediaPipe Iris

## Metrics

### Good Eye Contact

* Yaw/Pitch between -10° and +10°

### Bad Indicators

* Looking down repeatedly
* Looking sideways frequently
* Long distraction periods

## Feedback Examples

* "Maintain eye contact while answering"
* "Avoid looking down frequently"

---

# 7. Posture Analysis

## Technology

* MediaPipe Pose
* OpenCV angle calculations

## Metrics

### Posture Signals

* Shoulder level alignment
* Head tilt angle
* Slouching detection
* Leaning forward/backward
* Engagement estimation

### Behavioral Indicators

* Confidence posture
* Defensive posture
* Disengagement posture

---

# 8. Realtime Coaching Layer

## Core Principle

Realtime processing should use lightweight models and rule-based logic.

Heavy LLM evaluation should NOT run continuously.

---

## Realtime Processing Flow

```text
Every 5–10 seconds:
    Capture webcam/audio chunk
            ↓
    Run lightweight analysis
            ↓
    Update realtime metrics
            ↓
    Display live coaching feedback
```

---

## Realtime AI Components

### Audio

* Deepgram realtime API OR Whisper Tiny/Base
* WPM calculation
* Pause detection
* Filler word tracking

### Video

* MediaPipe Face Mesh
* MediaPipe Pose
* OpenCV calculations

---

## Realtime Feedback Examples

```text
⚠ Speaking too fast
⚠ Looking down frequently
⚠ Slouching detected
✓ Good eye contact
```

---

# 9. Realtime Scoring Engine

## Logic Type

* Threshold-based
* Rule-based
* Lightweight inference

## Example Logic

```python
if eye_contact < 60:
    show_warning()

if WPM > 170:
    show_speaking_fast()

if slouching_duration > 8:
    show_posture_alert()
```

---

# 10. Deep Analysis Layer

## Purpose

This layer generates:

* Interview summaries
* Coaching reports
* Behavioral reasoning
* Communication analysis
* Improvement recommendations

---

## Approved LLM Layer

### Preferred

* Claude API

### Alternatives

* OpenAI GPT
* Google Gemini

---

## LLM Input Strategy

### IMPORTANT

Raw video should NOT be sent to the LLM.

Instead, send structured behavioral metrics.

---

## Example LLM Input

```json
{
  "eye_contact_score": 78,
  "average_head_pitch": -12,
  "looking_down_events": 14,
  "slouching_detected": true,
  "dominant_emotions": {
    "calm": 62,
    "happy": 21,
    "confused": 17
  }
}
```

---

## Example LLM Tasks

* Generate coaching feedback
* Analyze confidence level
* Detect nervousness trends
* Evaluate communication style
* Provide improvement suggestions

---

# 11. Behavioral Timeline Feature

## Example

```text
02:10 → Speaking too fast
03:42 → Eye contact dropped
05:15 → Stress spike detected
06:00 → Posture improved
```

---

# 12. Interview Performance Scoring

## Suggested Metrics

### Communication Score

Based on:

* filler rate
* speaking pace
* clarity
* sentiment

### Confidence Score

Based on:

* eye contact
* posture
* vocal stability
* stress spikes

### Professional Presence Score

Based on:

* posture
* engagement
* composure
* emotional consistency

---

# 13. Data Storage

## Recommended Databases

### Preferred

* PostgreSQL

### Alternative

* MongoDB

## Stored Data

* Interview sessions
* Behavioral metrics
* Audio transcripts
* Timeline events
* AI reports
* User analytics

---

# 14. Recommended Deployment Architecture

## Frontend

* Vercel
* Netlify

## Backend

* Docker
* Railway
* Render
* AWS EC2
* DigitalOcean

## AI Processing

* GPU optional
* RTX 3050Ti supported

---

# 15. Final Approved Tech Stack

## Frontend

* React.js
* Next.js
* WebRTC
* MediaRecorder API

## Backend

* FastAPI
* Python

## Audio AI

* Deepgram
* Whisper
* openSMILE
* Transformers
* SpeechBrain (optional)

## Computer Vision

* MediaPipe
* OpenCV
* DeepFace
* NumPy

## LLM Layer

* Claude API
* GPT API
* Gemini API

## Database

* PostgreSQL
* MongoDB

---

# 16. Final Architectural Principles

## Realtime Layer

Goals:

* low latency
* lightweight processing
* realtime feedback
* minimal interruption

Uses:

* MediaPipe
* OpenCV
* Deepgram/Whisper
* rule engine

---

## Deep Analysis Layer

Goals:

* intelligent reasoning
* coaching insights
* behavioral evaluation
* professional feedback

Uses:

* Claude/GPT/Gemini
* aggregated metrics
* behavioral timeline

---

# 17. Final Project Strengths

## Technical Strengths

* Hybrid AI architecture
* Multimodal analysis
* Realtime coaching
* Post-interview reasoning
* Explainable behavioral metrics
* Modern AI system design

## Portfolio Strengths

* Computer Vision
* Speech AI
* Behavioral Analytics
* LLM Integration
* Realtime Systems
* Human-centered AI

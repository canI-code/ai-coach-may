# AI Preparation Coach

AI Preparation Coach is a multimodal, AI-powered platform designed to help students and professionals prepare for interviews and competitive exams. It evaluates performance across text, voice, and visual behavioral metrics to provide a comprehensive "Confidence Index" and personalized improvement plans.

## Project Overview

The platform supports two primary use cases:
- **B2C**: Individual users practicing mock interviews and exams.
- **B2B**: Institutions (colleges, training centers) monitoring student progress and skill gaps.

## Key Modules

### 1. Interview Engine
This is the core logic for handling real-time interview sessions, question generation, and multimodal analysis.

### 2. Authentication
Supports OTP-based login (Phone/Email). Uses Redis for session management.

### 3. Multimodal Analysis
- **Voice**: Analyzes WPM, filler words, silence, and sentiment.
- **Visual**: Track eye contact, emotions, posture, and stress indicators.
- **Content**: Evaluates technical accuracy and STAR structure adherence using LLMs.

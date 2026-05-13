# Project Status & Guidelines: AI Preparation Coach

## Overall Idea
AI Preparation Coach is a multimodal, AI-powered platform designed to help students and professionals prepare for interviews and competitive exams. 
It evaluates performance across text, voice, and visual behavioral metrics to provide a comprehensive "Confidence Index" and personalized improvement plans.

**Target Audiences:**
- **B2C:** Individual users practicing mock interviews and exams.
- **B2B:** Institutions (colleges, training centers) monitoring student progress and skill gaps.

**Key Features & Modules:**
- **Interview Engine:** Core logic handling real-time interview sessions, dynamic question generation, and multimodal analysis.
- **Multimodal Analysis:** Evaluates Voice (WPM, filler words, silence, sentiment), Visual (eye contact, emotions, posture, stress), and Content (technical accuracy, STAR method) in real-time.
- **Authentication:** Strict OTP-based login and signup (via email/phone) using Redis for session management with robust security limits.

## What Has Been Done Till Now
1. **Initial Next.js Project Scaffolding:** 
   - Created the base Next.js (App Router) project structure (`src/app`).
   - Initialized global styles, layout, and fundamental routing configuration.
2. **Defined Core Routing Architecture:**
   - Established basic page directories for public pages (`/about`, `/contact`, `/features`, `/plans`, `/usage`).
   - Scaffolded authentication routes (`/login`, `/signup`, `/register-institution`).
   - Stubbed out dashboard and administration routes (`/dashboard`, `/admin`, `/superadmin`).
3. **Comprehensive Authentication & User Flow Documentation:**
   - Auth flows clearly defined (`flow.md`) for B2C Users (Student, Professional) and B2B Users (Student, Mentor).
   - Documented detailed security measures and business rules for college registration, OTP validity limits, session invalidation, and rate-limiting (`plan.md`, `fome.md`, `previous.md`).
4. **Project AI Manifest:**
   - Established the `GEMINI.md` file mapping out the core project definition and requirements for AI assistance.

## What NOT To Do As Of Now
- **No Focus on UI/UX:** Do not spend time on CSS styling, design polish, or aesthetics. We are prioritizing functionality, logic, and application state over visual presentation.
- **Use Dummy OTPs:** Do not integrate live SMS or email gateways. Always use hardcoded or simple dummy OTPs (e.g., logged to the console) for all verification and authentication flows.
- **No Complex External Service Integrations Yet:** Hold off on plugging in final live external APIs or live LLMs until the foundational application state and authentications are proven.

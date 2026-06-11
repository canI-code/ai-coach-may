# 🧠 AI Coach — Project Log

> [!IMPORTANT]
> **AI AGENT INSTRUCTIONS:**
> Read this file at the start of every session. It is the single source of truth for:
> - What has been built and is working
> - What is currently pending
> - Architecture decisions and patterns
> - Known gotchas and pitfalls
> 
> **After every session**, update this file with what was done.

---

## Last Updated: 2026-06-05

---

## 1. Project Architecture

### Tech Stack
| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.2.4 (App Router, Turbopack) |
| Language | TypeScript |
| Database | MongoDB (via `mongodb` driver, no ORM) |
| Auth | Custom OTP-based (phone for B2C, email/password for B2B) + cookie sessions |
| Styling | Vanilla CSS + Glassmorphism design system |
| AI/LLM | Gemini API (primary) with Groq fallback via `llm-gateway.ts` |
| Vision | TensorFlow.js + MediaPipe (FaceLandmarker) for behavioral analysis |
| Speech | Browser SpeechRecognition API (not Whisper) |

### Databases
| Database Name | Purpose |
|---------------|---------|
| `aicoach` | Main B2C database — students, professionals, interviews, exams |
| `aicoach_institutional` | B2B database — mentors, mentees, invitations, institutional data |

### User Roles & Portal Types
| Role | Account Type | Portal Route | Database |
|------|-------------|-------------|----------|
| `student` | B2C | `/dashboard/b2c` | `aicoach` |
| `professional` | B2C | `/dashboard/b2c` | `aicoach` |
| `mentee` | B2B | `/dashboard/b2b` | `aicoach_institutional` |
| `mentor` | B2B | `/dashboard/mentor` | `aicoach_institutional` |
| `admin` | Internal | `/admin` | `aicoach` |
| `superadmin` | Internal | `/superadmin` | `aicoach` |

> **NOTE:** `professional` role exists in the backend but the UI option is hidden from signin/signup. Will be re-enabled in the future.

### Routing Architecture
The project uses a **hybrid routing** strategy:
- **`/dashboard/[portalType]/`** — Dynamic route for **shared pages** used by both B2C and B2B:
  - `assessment`, `exam-history`, `interview`, `interview-history`, `practice`, `profile`, `progress`, `recommendations`
  - Contains shared `components/` (Sidebar, charts, etc.)
  - `layout.tsx` handles auth check and sidebar rendering
- **`/dashboard/b2c/`** — Static route, B2C-specific dashboard home page
- **`/dashboard/b2b/`** — Static route, B2B mentee-specific dashboard home page
- **`/dashboard/mentor/`** — Static route, mentor-specific pages:
  - `page.tsx` (overview), `analytics/`, `invite/`, `profile/`, `students/`
  - Has its own `layout.tsx` and `components/`

### Key Pattern: `portalType` Resolution
When navigating within the app, the correct `portalType` is determined by:
- **Inside `[portalType]` routes**: Use `useParams()` from `next/navigation`
- **In login/signup redirects**: Compute from user role (`student`/`professional` → `b2c`, `mentee` → `b2b`, `mentor` → `mentor`)
- **In Header.tsx / root page.tsx**: Read `userRole` from `/api/auth/status` endpoint
- **In proxy.ts (middleware)**: Decode JWT from `auth_token` cookie to extract role

---

## 2. File Structure (Key Directories)

```
src/
├── app/
│   ├── api/
│   │   ├── auth/          # login, signup, logout, OTP, status, reset-password, mentee-request
│   │   ├── admin/         # institution approval/rejection, testing-files
│   │   ├── chat/          # AI chat endpoint
│   │   ├── institution/   # institutional registration
│   │   ├── interview/     # interview session management
│   │   ├── mentor/        # approve, invite, practice, profile, requests, status, students
│   │   ├── students/      # exam history, progress data
│   │   └── user/          # profile, settings, usage
│   ├── components/ui/     # Shared UI components (Header, Button, GlassCard, AmbientGlow, etc.)
│   ├── dashboard/
│   │   ├── [portalType]/  # Shared dynamic pages (see Routing Architecture above)
│   │   ├── b2c/           # B2C home dashboard
│   │   ├── b2b/           # B2B mentee home dashboard
│   │   └── mentor/        # Mentor dashboard + sub-pages
│   ├── admin/             # Admin panel page
│   ├── superadmin/        # Super admin panel page
│   ├── login/             # Login page
│   ├── signup/            # Signup page (handles B2C + B2B mentee flows)
│   ├── register-institution/ # Mentor/institution registration
│   └── ...
├── lib/
│   ├── mongodb.ts         # MongoDB connection singleton
│   ├── interview/         # Interview engine (question gen, scoring, real-time coach)
│   └── ...
├── proxy.ts               # Next.js middleware (auth redirect logic)
└── scripts/               # DB seeding and migration scripts
```

---

## 3. Authentication Flow

### B2C (Student/Professional)
1. User enters phone number → OTP sent → OTP verified → cookie set
2. Cookie: `auth_token` = `token|<userId>|<sessionId>`
3. Redirect to `/dashboard/b2c`

### B2B Mentee (Invite Code)
1. Mentee gets invite code from mentor
2. Signup: enters invite code + personal details → validates code against `aicoach_institutional.invitations`
3. Invite code carries: `collegeName`, `degree`, `subject`, `year` (set by mentor)
4. User stored in `aicoach_institutional.users`
5. Redirect to `/dashboard/b2b`

### B2B Mentor
1. Registers via `/register-institution` with documents (selfie, Aadhaar, college doc)
2. Admin/SuperAdmin reviews and approves/rejects
3. On approval, mentor can login and access `/dashboard/mentor`

### Admin/SuperAdmin
- Direct login with email + password
- Access `/admin` or `/superadmin` panels

---

## 4. Work Completed (Chronological)

### Session: 2026-06-01 to 2026-06-02
- Built core interview engine with real-time behavioral analysis
- Implemented webcam/mic hardware checks and face detection
- Built live interview UI with timer, speech recognition, AI coaching
- Fixed 15+ bugs (see BUG.md for full list)

### Session: 2026-06-03 to 2026-06-04
- Implemented B2B institutional system (mentor/mentee)
- Built mentor dashboard (overview, students, analytics, invite management)
- Built mentee B2B dashboard
- Implemented invite code system for mentee registration
- Built admin and superadmin approval panels with document review + rejection modals
- Added mentor profile page

### Session: 2026-06-05 (Current)
- **Fixed `invite` scope bug** in `src/app/api/auth/signup/route.ts` — `invite` was declared inside one `if` block but accessed in another
- **Migrated hardcoded paths to dynamic `portalType` routing:**
  - `Sidebar.tsx` → uses `useParams()` instead of role-based hardcoding
  - `Header.tsx` → role-aware dashboard redirect
  - `page.tsx` (root) → role-aware dashboard redirect
  - `proxy.ts` → JWT-decoded role-based redirect with fallback
  - `login/page.tsx` → portalType variable computed from role
  - `signup/page.tsx` → portalType-based redirects
- **Fixed missing React imports:**
  - `exam-history/page.tsx` — added `useState, useEffect, useCallback`
  - `mentor/students/page.tsx` — added `useMemo`
- **Audited CHANGES.md** — verified most B2B items were already implemented, updated checklist
- **Build passing** ✅

---

## 5. Currently Pending Items

### From CHANGES.md (unchecked)
| Item | Section | Status |
|------|---------|--------|
| Mentee popup after invite login — should NOT show educational details popup since mentor sets those via invite | Mentee | ❌ Pending |
| Progress page redesign — 3 tabs (overall, interview, exam) with radar charts, skill bars, level indicators | Report/Progress | ❌ Pending |
| Eye button on interview history retries to view full report | Interview History | ❌ Pending |

### Known Architecture Considerations
- The `mentee-request` API route exists (`/api/auth/mentee-request`) but the UI toggle for "request" method is already hidden. Backend code should be kept for future use.
- `professional` role signin/signup UI is hidden but backend code is intact.

---

## 6. Known Gotchas & Pitfalls

| Gotcha | Details |
|--------|---------|
| **Dual database pattern** | B2C uses `aicoach` DB, B2B uses `aicoach_institutional` DB. Always check which DB you're querying based on user role. |
| **`invite` variable scope** | In `signup/route.ts`, `invite` is declared at function scope (`let invite: any = null`) and assigned inside `if (role === 'mentee')`. Don't redeclare with `const`. |
| **React imports in `[portalType]` pages** | When migrating pages to `[portalType]`, React hooks must be explicitly imported. Next.js doesn't auto-import them. |
| **`useParams` typing** | Use `useParams<{ portalType: string }>()` for proper TypeScript typing in `[portalType]` routes. |
| **Proxy middleware JWT** | `proxy.ts` decodes the `auth_token` cookie using base64 payload extraction (not a full JWT library). It's a simple `token|userId|sessionId` format, NOT a real JWT. The proxy falls back to `/dashboard/b2c` on any decode error. |
| **Cookie format** | Auth cookie is `token|<mongoObjectId>|<sessionId>` — NOT a standard JWT. |
| **Static vs Dynamic routes** | `/dashboard/b2c` and `/dashboard/b2b` are static route folders. `/dashboard/[portalType]` is the dynamic shared route. Both can coexist in Next.js — static routes take priority over dynamic ones. |
| **Build command** | `npm run build` — always run after changes to catch TypeScript errors. Turbopack compiles but TypeScript checking can fail separately. |
| **PowerShell quirks** | User is on Windows PowerShell. Use `-win` prefix awareness. `Get-Content -Raw` may not work in all PS versions. Use `Select-String` for grep-like operations. |

---

## 7. Environment & Config

| Variable | Purpose |
|----------|---------|
| `MONGODB_URI` | MongoDB connection string |
| `GEMINI_API_KEY` | Google Gemini API key (primary LLM) |
| `GROQ_API_KEY` | Groq API key (fallback LLM) |
| Env files | `.env.local`, `.env` |

---

## 8. Design System Reference

- **Theme**: Neo-glassmorphism with ambient glow effects
- **Key components**: `GlassCard`, `AmbientGlow`, `Button`, `Header`, `Sidebar`
- **Charts**: Custom `LineChart`, `RadarChart` in `[portalType]/components/charts/`
- **Full design system docs**: See `md-files/DESIGN_SYSTEM.md`

---

## 9. Related Documentation Files

| File | Purpose |
|------|---------|
| [CHANGES.md](file:///F:/project/aicoach/md-files/CHANGES.md) | Feature requests and UI updates tracker |
| [BUG.md](file:///F:/project/aicoach/md-files/BUG.md) | Bug tracking and resolution log |
| [orchidsai-main.md](file:///F:/project/aicoach/md-files/orchidsai-main.md) | B2B integration plan from prototype |
| [orchidsai-main-answers.md](file:///F:/project/aicoach/md-files/orchidsai-main-answers.md) | User's answers to integration plan questions |
| [DESIGN_SYSTEM.md](file:///F:/project/aicoach/md-files/DESIGN_SYSTEM.md) | Design tokens, colors, typography |
| [IMPLEMENTATION_GUIDE.md](file:///F:/project/aicoach/md-files/IMPLEMENTATION_GUIDE.md) | Detailed implementation guide |
| [plan.md](file:///F:/project/aicoach/md-files/plan.md) | Original project plan |
| **PROJECT_LOG.md** (this file) | Session log — what was done, what's pending, gotchas |

# AI Coach - Worklog & Project Overview

> Last Updated: 2026-05-15
> Next.js 16.2.4 | React 19.2.4 | MongoDB 7 | Tailwind CSS 4 | TypeScript 5

---

## Project Overview

**AI Preparation Coach** is a multimodal, AI-powered platform for interview preparation. It supports both B2C (individual students/professionals) and B2B (institutions like colleges) users. The platform plans to evaluate text, voice, and visual behavioral metrics for a "Confidence Index" score.

### Tech Stack
- **Frontend:** Next.js 16 (App Router), React 19, Tailwind CSS 4
- **Backend:** Next.js API Routes (serverless)
- **Database:** MongoDB 7 (`aicoach` database)
- **Auth:** Custom session-based auth with `auth_token` cookie + OTP
- **Icons:** lucide-react
- **Styling:** Dark glassmorphic theme (globals.css), CSS utilities + Tailwind

### Database Collections Used
| Collection | Purpose |
|---|---|
| `users` | All users (students, pros, mentors, mentees) |
| `otps` | OTP records with expiry, attempts tracking |
| `institutions` | Institution registration requests |
| `contacts` | Contact form submissions |

### User Roles
| Role | Type | Auth Method | Dashboard |
|---|---|---|---|
| `student` | B2C | Phone + OTP | `/dashboard/b2c` |
| `professional` | B2C | Phone + OTP | `/dashboard/b2c` |
| `mentee` | B2B | Email + Password + OTP | `/dashboard/b2b` |
| `mentor` | B2B | College select + Email + Password + OTP | `/dashboard/mentor` |

---

## Project Structure

```
F:\project\aicoach\
├── AI_help/                    # AI documentation dump (plan, flow, specs)
│   ├── flow.md                 # Auth & user flow specification
│   ├── fome.md                 # Additional auth security rules
│   ├── plan.md                 # Mentor registration plan
│   ├── previous.md             # B2C signup details
│   ├── project_status.md       # Current status summary
│   └── ui_ux_design_system.md  # UI/UX design token spec
├── AGENTS.md                   # AI agent rules (Next.js deprecation notes)
├── CLAUDE.md                   # Points to AGENTS.md
├── GEMINI.md                   # AI manifest for Gemini models
├── DESIGN_SYSTEM.md            # Design system documentation
├── README.md                   # Basic project README
├── src/
│   ├── app/
│   │   ├── page.tsx            # Landing page (marketing)
│   │   ├── layout.tsx          # Root layout
│   │   ├── globals.css         # ALL styling + Tailwind import
│   │   ├── about/              # About page
│   │   ├── contact/            # Contact page with form
│   │   ├── features/           # Features showcase
│   │   ├── plans/              # Pricing plans page
│   │   ├── usage/              # How it works page
│   │   ├── login/              # Multi-step login (category -> role -> auth)
│   │   ├── signup/             # Multi-step signup (category -> role -> auth -> details)
│   │   ├── register-institution/ # Full institution + mentor registration (3 stages, sub-steps)
│   │   ├── dashboard/
│   │   │   ├── b2c/            # B2C dashboard (stub)
│   │   │   ├── b2b/            # B2B student dashboard (stub)
│   │   │   └── mentor/         # Mentor dashboard (functional: approve/reject students, manage)
│   │   ├── admin/              # Admin dashboard (approve institutions, manage flagged accounts)
│   │   ├── superadmin/         # Super admin (stub)
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   ├── login/route.ts       # POST: Login (both B2C/B2B flows)
│   │   │   │   ├── signup/route.ts      # POST: Register new user
│   │   │   │   ├── logout/route.ts      # POST: Clear auth cookie
│   │   │   │   ├── otp/send/route.ts    # POST: Send simulated OTP (4 or 6 digit)
│   │   │   │   ├── otp/verify/route.ts  # POST: Verify OTP with lockout logic
│   │   │   │   ├── reset-password/route.ts # POST: Reset password via OTP
│   │   │   │   └── mentee-request/route.ts # POST: B2B student request to mentor
│   │   │   ├── admin/
│   │   │   │   ├── institutions/route.ts          # GET: All institutions
│   │   │   │   ├── institutions/approve/route.ts  # POST: Approve institution + create mentor user
│   │   │   │   └── flagged/route.ts               # GET+POST: Flagged user management
│   │   │   ├── institution/register/route.ts # POST: Institution registration (3 stages)
│   │   │   ├── institutions/route.ts         # GET: Approved institutions for dropdown
│   │   │   ├── mentor/
│   │   │   │   ├── requests/route.ts  # GET: Pending mentee requests for mentor's college
│   │   │   │   ├── approve/route.ts   # POST: Approve/reject mentee + generate temp password
│   │   │   │   ├── students/route.ts  # GET: Approved mentees for mentor's college
│   │   │   │   └── status/route.ts    # POST: Enable/disable mentee account
│   │   │   └── contact/route.ts       # POST: Contact form submission
│   │   └── components/
│   │       ├── ui/                # Reusable design system components
│   │       │   ├── index.ts       # Barrel exports
│   │       │   ├── Button.tsx     # Button (primary/secondary/ghost/danger) + IconButton
│   │       │   ├── GlassCard.tsx  # Glassmorphism card container
│   │       │   ├── Input.tsx      # Input, Textarea, Select with glass styling
│   │       │   ├── Section.tsx    # Section, SectionHeader, Container wrappers
│   │       │   ├── FeatureCard.tsx # Feature + PricingCard components
│   │       │   ├── Header.tsx     # Frosted glass navigation header
│   │       │   ├── AmbientGlow.tsx # Floating ambient light blobs
│   │       │   └── OtpInput.tsx   # OTP input component
│   │       └── LogoutButton.tsx   # Client component for logout
│   ├── lib/
│   │   ├── mongodb.ts            # MongoDB client singleton (cached in dev)
│   │   ├── auth.ts               # getCurrentUser() - cookie-based auth helper
│   │   ├── design-tokens.ts      # Design tokens (colors, spacing, typography, shadows)
│   │   └── global.d.ts           # Global type declarations
│   └── proxy.ts                  # Middleware (auth redirect for login/signup pages)
├── .env                          # Environment variables (MONGODB_URI, etc.)
├── .env.local                    # Local overrides
├── next.config.ts                # Next.js config
├── tsconfig.json                 # TypeScript config
├── postcss.config.mjs            # PostCSS config
├── eslint.config.mjs             # ESLint flat config
└── package.json
```

---

## Auth Flow Summary

### B2C (Student / Professional)
1. Category selection (Institutional vs Non-Institutional)
2. Role selection (Student or Professional)
3. Enter phone number (country code + 10 digits)
4. OTP sent (simulated: 1234)
5. Verify OTP -> auto-login
6. Enter name + DOB -> complete registration
7. Redirect to `/dashboard/b2c`

### B2B Mentor
1. Category: Institutional -> Role: Mentor
2. Redirect to `/register-institution` (3 stages)
3. Stage 1: Mentor personal details (email OTP, phone OTP, name, password, DOB, gender)
4. Stage 2: College details (name, address, proof document)
5. Stage 3: Identity (Aadhaar number, Aadhaar pic, live selfie via webcam, consent)
6. Submitted to admin for approval
7. Admin approves on `/admin` dashboard -> mentor user created
8. Mentor login: select college -> email + password -> phone OTP -> dashboard

### B2B Mentee (Student)
1. Category: Institutional -> Role: Mentee
2. Fill request form (college, name, email, phone, gender, DOB)
3. Mentor approves on `/dashboard/mentor` -> temp password generated
4. Mentee logs in with email + temp password + email OTP
5. Redirect to `/dashboard/b2b`

---

## Completed Items

- [x] Next.js 16 project scaffolding with App Router
- [x] MongoDB connection with cached singleton pattern
- [x] Custom session-based auth system (auth_token cookie)
- [x] getCurrentUser() helper for server-side auth checks
- [x] OTP send/verify API with progressive lockout (5 fails=10min, 10 fails=30min, 15 fails=flagged)
- [x] B2C signup + login flow (phone + OTP)
- [x] B2B mentor login (college select + email/password + OTP)
- [x] B2B mentee request -> mentor approval -> login flow
- [x] Institution registration (3 stages with email/phone OTP, document upload, webcam selfie)
- [x] Admin dashboard with institution approval + flagged account management
- [x] Mentor dashboard (approve/reject mentees, enable/disable accounts, view login stats)
- [x] Design system: Glassmorphism UI kit (GlassCard, Button, Input, Header, etc.)
- [x] Marketing pages: Home, About, Features, Plans, Usage, Contact
- [x] Password reset flow with OTP
- [x] Session management: mentor 3-device limit, single-session for mentees, session clear on disable/reset
- [x] proxy.ts middleware to redirect authenticated users away from login/signup

---

## Pending / Todo

- [ ] **Interview Engine** - Core interview session logic (question generation, response capture)
- [ ] **Multimodal Analysis** - Voice analysis (WPM, filler words), Video analysis (eye contact, posture), Content analysis (STAR method)
- [ ] **Dashboard UI Polish** - B2C, B2B, and Mentor dashboards are stubs or minimally styled
- [ ] **Admin Auth Guard** - Admin routes (`/api/admin/*`) currently have NO role-based auth check
- [ ] **Super Admin Dashboard** - Stub page only, no functionality
- [ ] **Redis for Session Management** - Currently using in-memory MongoDB sessions (mentioned in GEMINI.md but not implemented)
- [ ] **Live SMS/Email Gateway** - OTPs are hardcoded (1234/123456), logged to console
- [ ] **LLM Integration** - No actual AI/LLM connected yet
- [ ] **Payment Integration** - Plans page exists but no payment flow
- [ ] **Upload Handling** - Documents are tracked by filename only, not actually uploaded/stored
- [ ] **About page** - Link to `/about` in footer is broken (404)
- [ ] **Mobile responsiveness** - Some pages may need mobile refinement

---

## Key Implementation Details

### Auth Token Format
`token|<userId>|<sessionId>` stored in cookie named `auth_token`

### OTP Simulation
- B2C users: `1234` (4-digit)
- B2B/Mentor: `123456` (6-digit)
- Logged to console via `console.log`

### Lockout Logic (OTP Verify)
| Failed Attempts | Penalty |
|---|---|
| 5 | 10-minute OTP lockout |
| 10 | 30-minute OTP lockout |
| 15 | Account flagged (`isFlagged: true`) + deactivated |

### Important Conventions
- **No focus on UI polish** - prioritize functionality over styling
- **Dummy OTPs only** - no live SMS/email gateways
- **No complex external integrations yet** - hold off on live APIs/LLMs
- **Read `node_modules/next/dist/docs/`** before writing Next.js code (breaking changes in v16)
- Design system lives in `globals.css` + `src/app/components/ui/`
- All components imported from `./components/ui` barrel export

---

## AI Handoff Notes

- Start from **worklog.md** - read this first
- Read **AI_help/*** for detailed specs (flow.md for auth flows, plan.md/fome.md/previous.md for security rules)
- Read **DESIGN_SYSTEM.md** for component usage patterns
- The `AGENTS.md` file warns that Next.js 16 has breaking changes - consult `node_modules/next/dist/docs/` before writing code
- When running commands, default to PowerShell syntax (Windows env)
- If you need to create new UI components, follow existing patterns in `src/app/components/ui/`
- Always test changes with `npm run build` and `npm run lint` before committing

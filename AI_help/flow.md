# Authentication & User Flow Specification

## 1. Entry Point (Home Page)

### Options:
- Get Started
- Sign In
- Direct B2B Student Access
- Direct Mentor Access

---

## 2. Get Started Flow (B2C Users)

### Step 1: User Type Selection
Prompt:
- Student
- Professional

### Step 2: Authentication
Options:
- Phone Number + OTP

### Step 3: Basic Details Collection
- Full Name
- Date of Birth (DOB)

### Step 4: Redirect
- Redirect to **B2C Dashboard**

---

## 3. Sign In Flow

### Step 1: User Type Selection
Prompt:
- Student
- Professional
- B2B Student
- Mentor

---

### 3A. Student / Professional Login

#### Authentication Options:
- Phone Number + OTP

#### Redirect:
- B2C Dashboard

---

### 3B. B2B Student Login

#### Step 1: Credentials
- Email ID (provided by mentor)
- Password

#### Step 2: Verification
- OTP sent to registered Email

#### Redirect:
- B2B Student Dashboard

---

### 3C. Mentor Login

#### Step 1: Select Institution
- Dropdown: Registered Colleges

#### Step 2: Credentials
- Email ID (provided by college)
- Password

#### Step 3: Verification
- OTP

#### Redirect:
- Mentor Dashboard

---

## 4. Direct Access Flows

### 4A. Direct B2B Student Access

#### Steps:
1. Enter Email ID
2. Enter Password
3. OTP Verification

#### Redirect:
- B2B Student Dashboard

---

### 4B. Direct Mentor Access

#### Steps:
1. Select College from Dropdown
2. Enter Email ID
3. Enter Password
4. OTP Verification

#### Redirect:
- Mentor Dashboard

---

## 5. Institution Not Found Flow

### Condition:
- If College is NOT present in dropdown

### Action:
- Show Option: "Register Institution"

---

## 6. Institution Registration Flow

### Step 1: Basic Details
- College / Institution Name
- Mentor Email ID (to be set)
- Password

### Step 2: Email Verification
- OTP sent to Mentor Email

---

### Step 3: Verification Details Submission
- Upload College Existence Proof Documents
- Live Camera Capture of Mentor
- Aadhaar Card Number (for identity verification)

---

### Step 4: Admin Review
- All submitted data is sent to Admin Panel

### Step 5: Approval Process
- If Approved:
  - Notification sent via Email
  - Mentor can access Mentor Dashboard

- If Rejected:
  - Send reason via Email
  - Allow re-submission

---

## 7. Dashboard Routing Summary

| User Type        | Dashboard                |
|-----------------|------------------------|
| Student          | B2C Dashboard          |
| Professional     | B2C Dashboard          |
| B2B Student      | B2B Student Dashboard  |
| Mentor           | Mentor Dashboard       |

---

## 8. Authentication Summary

| User Type        | Login Method                        |
|-----------------|------------------------------------|
| Student          | Phone OTP                          |
| Professional     | Phone OTP                          |
| B2B Student      | Email + Password + Email OTP       |
| Mentor           | College चयन + Email + Password + OTP |

---

## 9. Notes for Developers

- Ensure OTP verification is mandatory in all flows.
- Maintain session-based authentication after login.
- Use role-based routing for dashboards.
- Store user type at authentication stage.
- Dropdown data (colleges) must be dynamically fetched from database.
- Institution registration should trigger admin workflow.
- Aadhaar and sensitive data must be securely stored (encrypted).

---

## 10. Edge Cases

- Invalid OTP → Retry option
- Unregistered Email (B2B Student/Mentor) → Show error
- College not found → Redirect to Institution Registration
- Duplicate Institution Registration → Flag for admin review
- Google Auth failure → Fallback to OTP login
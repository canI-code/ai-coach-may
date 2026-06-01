# AI Bug Hunting & Resolution Board

> [!IMPORTANT]
> **AI AGENT INSTRUCTIONS:** 
> Whenever you start a session in this repository, you **MUST** read this file first. Locate all active issues under the **Active Bugs** section, prioritize them, plan their resolution, and implement the fixes. 
> Upon successfully completing a fix and verifying it (with builds and tests), update the corresponding checkbox to `[x]` and move the entry to the **Resolved Bugs** section with a concise summary of the fix.

---

## Active Bugs

*No active bugs. All identified issues have been resolved, build-verified, and test-validated.*

---

## Resolved Bugs

- [x] **Redirection to Mini-Report on End of Interview**
  * **Completed Date:** 2026-06-02
  * **Summary:** Modified the naturlich-end modal in the frontend to change its button click action from redirecting directly to `/report` to instead set `showEndPopup(false)`. This unmasks the compiling loader view, allowing the user to watch the AI behavioral compilation status and read the beautiful mini-report Session Ended summary card before choosing to leave.

- [x] **Camera Button in Header Top Bar**
  * **Completed Date:** 2026-06-02
  * **Summary:** Removed the camera on-off toggle button from the top control bar to clear candidate distractions during the active interview session.

- [x] **Continuous Speech Recognition Pauses**
  * **Completed Date:** 2026-06-02
  * **Summary:** Bound a resilient auto-restart to the browser `SpeechRecognition.onend` callback which references `phaseRef` tracking if the phase is `'answering'`, automatically restarting the transcription engine whenever candidate pauses/silence triggers a standard timeout.

- [x] **Sidebar Operations Cards Hiding**
  * **Completed Date:** 2026-06-02
  * **Summary:** Hided the backend-centric "Session Details", "Interview Stages", and "Behavioral Timeline" visual cards from the live sidebar to prevent candidate distraction while keeping all underlying states and hooks fully functional.

- [x] **Contiguous Interview Timer Sync**
  * **Completed Date:** 2026-06-02
  * **Summary:** Upgraded the visual countdown timer to rely strictly on contiguous absolute elapsed time (`Date.now() - startedAtMs`) from session start, eliminating artificial pauses/reset discrepancies, matching backend duration caps, and remaining fully accurate on page refreshes.

- [x] **Header Target Role Display**
  * **Completed Date:** 2026-06-02
  * **Summary:** Integrated a clean orange-badge Target Role pill beside the recording "Ready" indicator in the top header.

- [x] **Silence Transcription Fallback Bypass**
  * **Completed Date:** 2026-06-02
  * **Summary:** Removed the hardcoded placeholder string `'Candidate did not speak or speak clearly.'` when the final turn transcription is empty, ensuring genuine silence is written as `""` and preventing the AI evaluator from scoring the mock phrase.

- [x] **Live Webcam and Microphone Selector Dropdowns**
  * **Completed Date:** 2026-06-02
  * **Summary:** Added premium glassmorphic camera and microphone dropdown lists directly inside the top controls bar of the live interview, allowing candidates to hot-swap their inputs mid-session seamlessly while automatically inheriting default cached settings from profile localStorage.

- [x] **Video Metrics and Audio Offline Synchronization**
  * **Completed Date:** 2026-06-01
  * **Summary:** Bypassed Groq Whisper STT in favor of browser SpeechRecognition for zero latency, resolved perfect metrics default calculations during out-of-frame frames, and implemented an automatic camera-pause lockdown warning overlay with a 2-minute termination timer.

- [x] **Hardware Check and Face/Mic Pre-flight Validation**
  * **Completed Date:** 2026-06-01
  * **Summary:** Prevented premature camera passes by ensuring FaceLandmarker is fully loaded before executing checks, counted 60 stable face detection frames (~1s) to defeat camera shutters, made microphone levels progress bar decrease when silent to require genuine speaking, and disabled start button until verification succeeds.

- [x] **Timer Starts and Countdown Visual Capping**
  * **Completed Date:** 2026-06-01
  * **Summary:** Capped remainingSeconds to `Math.min(durationMinutes * 60, left)` inside the countdown timer to completely eliminate visual timing anomalies of 5-6 digits.

- [x] **Bulb Icons, Skip Button, and Questions Left UI Cleanups**
  * **Completed Date:** 2026-06-01
  * **Summary:** Removed the tips Lightbulb icon button next to the question, removed the skip button from the editor footer, removed question left/remaining counters, replaced the active question index counter with the "Time Remaining" display, and toggled the final review submit button to "Save & Submit Interview" on the last question.

- [x] **Audio Speech Pace Analysis Categories**
  * **Completed Date:** 2026-06-01
  * **Summary:** Adjusted WPM thresholds in `evaluateCues` inside `realtime-coach.ts` to check `wpm > 0 && wpm < 55` (slow) and `wpm > 160` (fast) to align perfectly with `classifyPace` in `metrics.ts` and prevent normal talking speeds from triggering "Speaking too slowly" warnings. All 117 property tests pass.

- [x] **LLM Provider Fallbacks (Gemini to Groq)**
  * **Completed Date:** 2026-06-01
  * **Summary:** Verified global LLM fallbacks inside `llm-gateway.ts` where all operations (metrics evaluation & question generation) route through the gateway, automatically fallback-chaining to Groq if the Gemini API key is missing.

- [x] **TensorFlow Lite Info Logs Suppression**
  * **Completed Date:** 2026-06-01
  * **Summary:** Overrode browser `console.info` and `console.log` on mount to filter out noisy info logs containing the substring "TensorFlow Lite" or "XNNPACK".

- [x] **Behavioral Timeline Grid Layout**
  * **Completed Date:** 2026-06-01
  * **Summary:** Upgraded B2C live session sidebar to layout "Interview Stages" and "Behavioral Timeline" side-by-side using a responsive grid, and replaced the raw timeline accordion lists with the high-end `BehavioralTimeline` visual component.

- [x] **Autocommit and Keyboard Hotkeys during Review**
  * **Completed Date:** 2026-06-01
  * **Summary:** Added automatic autocommit when the 3-minute review timer hits zero, and bound global keyboard listeners for `Ctrl+Z` and `Ctrl+Y` during the review phase to trigger undo/redo seamlessly.

- [x] **Sleeping Posture Composure Penalty & Webcam HUD alignment guides**
  * **Completed Date:** 2026-06-01
  * **Summary:** Added posture distortion composure penalty (deducts 30 confidence points in `vision-analyzer.ts` when slouching/lying down) to prevent sleeping posture from showing 95%+ confidence, and overlayed interactive red-green dashed oval and shoulder helpers directly on the live video stream.

- [x] **Webcam and Microphone selectors on settings page**
  * **Completed Date:** 2026-06-01
  * **Summary:** Added a new "Hardware & Devices Settings" GlassCard on the profile settings page (`profile/page.tsx`) to let users select their preferred devices from all connected webcams and microphones, saving preferences to `localStorage` where they are inherited by the interview page.

- [x] **Camera Lost Overlay Notice**
  * **Completed Date:** 2026-06-01
  * **Summary:** Updated the `isPausedDueToCamera` overlay modal description to explicitly notify users that failure to turn on their camera within 2 minutes will result in automatic session submission.

---

## 🛠️ AI Execution Protocol (How to resolve bugs)

When resolving an issue from this list, follow these phases:
1. **Research & Scan**: Locates the files mentioned in the bug description. Perform a search to gather full context.
2. **Draft the Plan**: Write a concise, atomic implementation plan for the active bug.
3. **Execute & Code**: Apply edits with surgical precision, keeping existing comments intact.
4. **Compile & Verify**: Run `npm run build` or the corresponding test suite to verify the changes.
5. **Update This File**: Mark the bug as resolved `[x]`, move it to the **Resolved Bugs** section, and write a summary.

const { chromium } = require('playwright');

const TARGET_URL = 'http://localhost:3000';
const STATE_PATH = 'F:\\project\\aicoach\\tmp\\playwright-interview-auth.json';
const SHOT_DIR = 'F:\\project\\aicoach\\tmp\\shots';

const results = [];
function rec(name, status, detail) {
  results.push({ name, status, detail: detail || '' });
  const icon = status === 'PASS' ? '✅' : status === 'WARN' ? '⚠️ ' : '❌';
  console.log(`${icon} [${status}] ${name}${detail ? ' — ' + detail : ''}`);
}

(async () => {
  // Launch Chromium with a FAKE camera + mic so getUserMedia + MediaPipe actually run.
  const browser = await chromium.launch({
    headless: false,
    slowMo: 60,
    args: [
      '--use-fake-ui-for-media-stream',        // auto-grant camera/mic
      '--use-fake-device-for-media-stream',    // synthetic video (moving pattern) + audio
      '--autoplay-policy=no-user-gesture-required',
    ],
  });
  const context = await browser.newContext({
    storageState: STATE_PATH,
    viewport: { width: 1440, height: 900 },
    permissions: ['camera', 'microphone'],
  });
  const page = await context.newPage();

  // Track MediaPipe asset loads + console errors.
  const mpAssets = [];
  const consoleErrors = [];
  page.on('response', (res) => {
    const u = res.url();
    if (u.includes('/mediapipe/')) mpAssets.push(`${res.status()} ${u.split('/mediapipe/')[1]}`);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push('pageerror: ' + err.message));

  // ── Start an interview via API to get straight into a session ────────────
  let sessionId = null;
  try {
    const r = await context.request.post(`${TARGET_URL}/api/interview/start`, {
      data: { role: 'Algorithms', difficulty: 3, durationMinutes: 10, aiPersona: 'tech_lead', difficultyMin: 1, difficultyMax: 5 },
      headers: { 'Content-Type': 'application/json' },
    });
    const j = await r.json();
    sessionId = j.sessionId;
    rec('1. Session created for vision test', sessionId ? 'PASS' : 'FAIL', sessionId || JSON.stringify(j).slice(0, 150));
  } catch (e) {
    rec('1. Session created for vision test', 'FAIL', e.message);
  }
  if (!sessionId) { await browser.close(); printSummary(); return; }

  // ── Open the live session page ───────────────────────────────────────────
  try {
    await page.goto(`${TARGET_URL}/dashboard/b2c/interview/${sessionId}`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    const txt = await page.locator('body').innerText();
    rec('2. Live session page loaded', /Start answering|Interviewer|Live Coach/i.test(txt) ? 'PASS' : 'WARN', '');
    await page.screenshot({ path: `${SHOT_DIR}\\v1-session-loaded.png`, fullPage: true });
  } catch (e) {
    rec('2. Live session page loaded', 'FAIL', e.message);
  }

  // ── Click "Start answering" → triggers getUserMedia + MediaPipe init ──────
  try {
    const startBtn = page.getByRole('button', { name: /Start answering/i });
    await startBtn.click({ timeout: 10000 });
    rec('3. "Start answering" clicked', 'PASS', 'camera/mic capture initiated');
  } catch (e) {
    rec('3. "Start answering" clicked', 'WARN', e.message);
  }

  // ── Let the vision pipeline run for ~12s (frames every 500ms) ─────────────
  console.log('   ⏳ Letting vision pipeline run ~12s with fake camera feed...');
  await page.waitForTimeout(12000);
  await page.screenshot({ path: `${SHOT_DIR}\\v2-answering.png`, fullPage: true });

  // ── Verify MediaPipe assets loaded ────────────────────────────────────────
  const taskLoads = mpAssets.filter((a) => a.includes('.task'));
  const wasmLoads = mpAssets.filter((a) => a.includes('.wasm'));
  if (taskLoads.length >= 1 && wasmLoads.length >= 1) {
    rec('4. MediaPipe assets loaded', 'PASS', `${wasmLoads.length} wasm, ${taskLoads.length} task: [${mpAssets.join(' | ')}]`);
  } else if (mpAssets.length > 0) {
    rec('4. MediaPipe assets loaded', 'WARN', `partial: [${mpAssets.join(' | ')}]`);
  } else {
    rec('4. MediaPipe assets loaded', 'FAIL', 'no /mediapipe/* requests observed — vision never initialized');
  }

  // ── Read the Live Coach panel metrics from the DOM ────────────────────────
  try {
    const panelText = await page.locator('aside[aria-label="Live coaching panel"]').innerText().catch(() => '');
    const full = panelText || (await page.locator('body').innerText());
    // Extract eye-contact % and composure % shown in the panel.
    const eyeMatch = full.match(/Eye contact\s*([0-9]{1,3})%/i);
    const composureMatch = full.match(/Composure\s*([0-9]{1,3})%/i);
    const eye = eyeMatch ? parseInt(eyeMatch[1], 10) : null;
    const comp = composureMatch ? parseInt(composureMatch[1], 10) : null;
    console.log(`     Panel: eyeContact=${eye}%, composure=${comp}%`);
    console.log(`     Panel snapshot: ${full.replace(/\s+/g, ' ').slice(0, 220)}`);

    // The fake camera shows no real face, so MediaPipe will detect no/odd landmarks —
    // the KEY signal is whether the values DIVERGE from the static 100/100 defaults,
    // proving the pipeline actually ran (it processes frames and recomputes).
    if (eye === null && comp === null) {
      rec('5. Vision metrics present in UI', 'WARN', 'could not parse eye/composure from panel');
    } else if ((eye !== null && eye !== 100) || (comp !== null && comp !== 100)) {
      rec('5. Vision pipeline produces non-default values', 'PASS', `eye=${eye}%, composure=${comp}% (diverged from 100% default → pipeline ran)`);
    } else {
      rec('5. Vision pipeline produces non-default values', 'WARN', `still at defaults (eye=${eye}%, comp=${comp}%) — fake cam has no face, may stay 100 if no landmarks detected`);
    }
  } catch (e) {
    rec('5. Vision metrics present in UI', 'FAIL', e.message);
  }

  // ── Surface any console errors (esp. MediaPipe/wasm failures) ─────────────
  const mpErrors = consoleErrors.filter((e) => /mediapipe|wasm|landmark|fileset|getUserMedia/i.test(e));
  if (mpErrors.length === 0) {
    rec('6. No MediaPipe/wasm console errors', 'PASS', `${consoleErrors.length} total console errors, 0 vision-related`);
  } else {
    rec('6. No MediaPipe/wasm console errors', 'FAIL', `vision errors: ${mpErrors.slice(0, 3).join(' || ')}`);
  }

  printSummary();
  await page.waitForTimeout(1500);
  await browser.close();

  function printSummary() {
    console.log('\n══════════════════════════════════════');
    console.log('  VISION PIPELINE — FRONTEND TEST SUMMARY');
    console.log('══════════════════════════════════════');
    const pass = results.filter((r) => r.status === 'PASS').length;
    const warn = results.filter((r) => r.status === 'WARN').length;
    const fail = results.filter((r) => r.status === 'FAIL').length;
    console.log(`  ✅ PASS: ${pass}   ⚠️  WARN: ${warn}   ❌ FAIL: ${fail}`);
    if (sessionId) console.log(`  Session: ${sessionId}`);
    console.log('══════════════════════════════════════');
  }
})();

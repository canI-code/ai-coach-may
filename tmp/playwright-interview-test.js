const { chromium } = require('playwright');

const TARGET_URL = 'http://localhost:3000';
const STATE_PATH = 'F:\\project\\aicoach\\tmp\\playwright-interview-auth.json';
const SHOT_DIR = 'F:\\project\\aicoach\\tmp\\shots';

const results = [];
function record(name, status, detail) {
  results.push({ name, status, detail: detail || '' });
  const icon = status === 'PASS' ? '✅' : status === 'WARN' ? '⚠️ ' : '❌';
  console.log(`${icon} [${status}] ${name}${detail ? ' — ' + detail : ''}`);
}

(async () => {
  const fs = require('fs');
  if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext({
    storageState: STATE_PATH,
    viewport: { width: 1440, height: 900 },
    permissions: ['microphone', 'camera'],
  });
  const page = await context.newPage();

  // Capture console errors + failed requests per navigation.
  let consoleErrors = [];
  let failedRequests = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('requestfailed', (req) => {
    failedRequests.push(`${req.method()} ${req.url()} — ${req.failure()?.errorText}`);
  });
  page.on('response', (res) => {
    const u = res.url();
    if (u.includes('/api/interview/') && res.status() >= 500) {
      failedRequests.push(`HTTP ${res.status()} ${u}`);
    }
  });

  async function snap(name) {
    try {
      await page.screenshot({ path: `${SHOT_DIR}\\${name}.png`, fullPage: true });
    } catch (e) {
      console.log(`   (screenshot ${name} failed: ${e.message})`);
    }
  }

  // ───────────────────────────────────────────────────────────────────────
  // TEST 1: Auth session valid — dashboard loads
  // ───────────────────────────────────────────────────────────────────────
  try {
    consoleErrors = []; failedRequests = [];
    const resp = await page.goto(`${TARGET_URL}/dashboard/b2c`, { waitUntil: 'networkidle', timeout: 30000 });
    const url = page.url();
    if (url.includes('/login')) {
      record('Auth session valid', 'FAIL', 'redirected to /login — session not applied');
    } else {
      record('Auth session valid', 'PASS', `on ${url} (HTTP ${resp.status()})`);
    }
    await snap('01-dashboard');
  } catch (e) {
    record('Auth session valid', 'FAIL', e.message);
  }

  // ───────────────────────────────────────────────────────────────────────
  // TEST 2: Dashboard interview metrics render (DashboardClient)
  // ───────────────────────────────────────────────────────────────────────
  try {
    await page.waitForTimeout(2500); // allow /api/interview/dashboard fetch
    const bodyText = await page.locator('body').innerText();
    const hasEmpty = /No interviews yet/i.test(bodyText);
    const hasKpis = /Confidence Index/i.test(bodyText) && /Sessions Completed|Streak/i.test(bodyText);
    if (hasEmpty) {
      record('Dashboard metrics render', 'PASS', 'empty state shown (no reports yet) — expected');
    } else if (hasKpis) {
      record('Dashboard metrics render', 'PASS', 'KPI cards + charts rendered with data');
    } else {
      record('Dashboard metrics render', 'WARN', 'neither empty state nor KPIs detected');
    }
  } catch (e) {
    record('Dashboard metrics render', 'FAIL', e.message);
  }

  // ───────────────────────────────────────────────────────────────────────
  // TEST 3: /api/interview/dashboard returns valid metrics JSON
  // ───────────────────────────────────────────────────────────────────────
  try {
    const r = await page.request.get(`${TARGET_URL}/api/interview/dashboard`);
    const j = await r.json();
    if (r.ok() && j.success && j.metrics && typeof j.metrics.hasData === 'boolean') {
      record('GET /api/interview/dashboard', 'PASS', `hasData=${j.metrics.hasData}, totalSessions=${j.metrics.totalSessions}`);
    } else {
      record('GET /api/interview/dashboard', 'FAIL', `HTTP ${r.status()} ${JSON.stringify(j).slice(0, 150)}`);
    }
  } catch (e) {
    record('GET /api/interview/dashboard', 'FAIL', e.message);
  }

  // ───────────────────────────────────────────────────────────────────────
  // TEST 4: Interview setup page loads with form controls
  // ───────────────────────────────────────────────────────────────────────
  try {
    consoleErrors = []; failedRequests = [];
    await page.goto(`${TARGET_URL}/dashboard/b2c/interview`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);
    const txt = await page.locator('body').innerText();
    const isUnderConstruction = /under construction/i.test(txt);
    const hasSetup = /Mock Interview Setup|Start Interview/i.test(txt);
    const selects = await page.locator('select').count();
    if (isUnderConstruction) {
      record('Interview setup page', 'FAIL', '"Under Construction" 404 — route missing');
    } else if (hasSetup && selects >= 1) {
      record('Interview setup page', 'PASS', `setup form present (${selects} selects)`);
    } else {
      record('Interview setup page', 'WARN', `loaded but controls unclear (selects=${selects})`);
    }
    await snap('02-interview-setup');
  } catch (e) {
    record('Interview setup page', 'FAIL', e.message);
  }

  // ───────────────────────────────────────────────────────────────────────
  // TEST 5: Interview-history page loads
  // ───────────────────────────────────────────────────────────────────────
  try {
    consoleErrors = []; failedRequests = [];
    await page.goto(`${TARGET_URL}/dashboard/b2c/interview-history`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);
    const txt = await page.locator('body').innerText();
    const isUnderConstruction = /under construction/i.test(txt);
    const hasHistory = /Interview History/i.test(txt);
    if (isUnderConstruction) {
      record('Interview history page', 'FAIL', '"Under Construction" 404 — route missing');
    } else if (hasHistory) {
      record('Interview history page', 'PASS', 'history page rendered');
    } else {
      record('Interview history page', 'WARN', 'loaded but heading not found');
    }
    await snap('03-interview-history');
  } catch (e) {
    record('Interview history page', 'FAIL', e.message);
  }

  // ───────────────────────────────────────────────────────────────────────
  // TEST 6: GET /api/interview/sessions returns list JSON
  // ───────────────────────────────────────────────────────────────────────
  try {
    const r = await page.request.get(`${TARGET_URL}/api/interview/sessions`);
    const j = await r.json();
    if (r.ok() && j.success && Array.isArray(j.sessions)) {
      record('GET /api/interview/sessions', 'PASS', `${j.sessions.length} sessions`);
    } else {
      record('GET /api/interview/sessions', 'FAIL', `HTTP ${r.status()}`);
    }
  } catch (e) {
    record('GET /api/interview/sessions', 'FAIL', e.message);
  }

  // ───────────────────────────────────────────────────────────────────────
  // TEST 7: Start an interview via the setup form → exercises seeding
  // ───────────────────────────────────────────────────────────────────────
  try {
    consoleErrors = []; failedRequests = [];
    await page.goto(`${TARGET_URL}/dashboard/b2c/interview`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);

    // Pick the first real role option in the role <select>.
    const roleSelect = page.locator('select').first();
    const optionValues = await roleSelect.locator('option').evaluateAll((opts) =>
      opts.map((o) => o.value).filter((v) => v)
    );
    if (optionValues.length > 0) {
      await roleSelect.selectOption(optionValues[0]);
    }

    // Capture the /api/interview/start response.
    const startRespPromise = page.waitForResponse(
      (r) => r.url().includes('/api/interview/start'),
      { timeout: 60000 }
    ).catch(() => null);

    // Click the Start Interview button.
    const startBtn = page.getByRole('button', { name: /Start Interview/i });
    await startBtn.click();

    const startResp = await startRespPromise;
    if (!startResp) {
      record('Start interview (seeding)', 'WARN', 'no /start response observed within 60s');
    } else {
      const status = startResp.status();
      let payload = {};
      try { payload = await startResp.json(); } catch {}
      if (status === 201 && payload.sessionId) {
        record('Start interview (seeding)', 'PASS', `session created: ${payload.sessionId}`);
      } else if (status === 503 && /seeding_failed|seeded pool/i.test(JSON.stringify(payload))) {
        record('Start interview (seeding)', 'FAIL', `seeding failed (503): ${payload.message || payload.error}`);
      } else {
        record('Start interview (seeding)', 'WARN', `HTTP ${status}: ${JSON.stringify(payload).slice(0, 200)}`);
      }
    }
    await page.waitForTimeout(2000);
    await snap('04-after-start');
  } catch (e) {
    record('Start interview (seeding)', 'FAIL', e.message);
  }

  // ───────────────────────────────────────────────────────────────────────
  // TEST 8: If we navigated into a session, verify the live page renders
  // ───────────────────────────────────────────────────────────────────────
  try {
    const url = page.url();
    if (/\/interview\/[a-f0-9]{12,}/i.test(url)) {
      await page.waitForTimeout(2000);
      const txt = await page.locator('body').innerText();
      const hasQuestion = /Interviewer|Start answering|Question/i.test(txt);
      const hasCoach = /Live Coach/i.test(txt);
      if (hasQuestion) {
        record('Live session page', 'PASS', `session UI rendered${hasCoach ? ' (incl. Live Coach panel)' : ''}`);
      } else {
        record('Live session page', 'WARN', 'navigated to session but question UI unclear');
      }
      await snap('05-live-session');
    } else {
      record('Live session page', 'WARN', `did not navigate into a session (still on ${url})`);
    }
  } catch (e) {
    record('Live session page', 'FAIL', e.message);
  }

  // ───────────────────────────────────────────────────────────────────────
  // TEST 9: Responsive — mobile viewport of the setup page
  // ───────────────────────────────────────────────────────────────────────
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${TARGET_URL}/dashboard/b2c/interview`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);
    await snap('06-setup-mobile');
    record('Responsive (mobile setup)', 'PASS', 'mobile screenshot captured');
    await page.setViewportSize({ width: 1440, height: 900 });
  } catch (e) {
    record('Responsive (mobile setup)', 'WARN', e.message);
  }

  // ───────────────────────────────────────────────────────────────────────
  // Summary
  // ───────────────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════');
  console.log('  INTERVIEW MODULE TEST SUMMARY');
  console.log('══════════════════════════════════════');
  const pass = results.filter((r) => r.status === 'PASS').length;
  const warn = results.filter((r) => r.status === 'WARN').length;
  const fail = results.filter((r) => r.status === 'FAIL').length;
  console.log(`  ✅ PASS: ${pass}   ⚠️  WARN: ${warn}   ❌ FAIL: ${fail}`);
  console.log('══════════════════════════════════════');
  console.log(`  Screenshots: ${SHOT_DIR}`);

  await page.waitForTimeout(1500);
  await browser.close();
})();

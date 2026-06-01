const { chromium } = require('playwright');

const TARGET_URL = 'http://localhost:3000';
const STATE_PATH = 'F:\\project\\aicoach\\tmp\\playwright-interview-auth.json';

const results = [];
function rec(name, status, detail) {
  results.push({ name, status, detail: detail || '' });
  const icon = status === 'PASS' ? '✅' : status === 'WARN' ? '⚠️ ' : '❌';
  console.log(`${icon} [${status}] ${name}${detail ? ' — ' + detail : ''}`);
}

// Build a realistic AggregatedMetrics payload (numeric only — the privacy boundary).
function makeMetrics(quality) {
  // quality: 'good' | 'poor' — shapes the numbers so we can observe adaptive difficulty.
  if (quality === 'poor') {
    return {
      wpmArr: [185, 190, 200],          // too fast
      fillerCount: 8,                    // many fillers
      eyeContactArr: [40, 45, 38],       // poor eye contact
      postureArr: [50, 55, 48],
      pitchVariance: 5,
      loudnessVariance: 3,
      sentiment: -0.3,
      dominantEmotion: 'confused',
      composure: 45,
      pace: 'fast',
    };
  }
  return {
    wpmArr: [120, 130, 125],
    fillerCount: 1,
    eyeContactArr: [88, 92, 90],
    postureArr: [95, 96, 94],
    pitchVariance: 40,
    loudnessVariance: 30,
    sentiment: 0.6,
    dominantEmotion: 'calm',
    composure: 90,
    pace: 'normal',
  };
}

const ANSWERS = [
  'Hello, my name is Alex. I have about 5 years of experience working primarily with algorithms, data structures, and distributed systems in production environments.',
  'In my most challenging project I designed a real-time recommendation engine, balancing latency and accuracy by combining an approximate nearest-neighbor index with a re-ranking layer.',
  'I would compare a hash map and a balanced binary search tree: the hash map gives average O(1) lookups but no ordering, while the BST gives O(log n) ordered traversal which matters for range queries.',
  'Dynamic programming was hard at first. I mastered it by practicing the classic problems, drawing the recurrence relations, and always identifying the overlapping subproblems and optimal substructure.',
  'I prioritize by profiling first to find the real bottleneck, then I tackle the highest-impact piece, keeping correctness covered by tests before optimizing for performance.',
  'A common limitation of greedy approaches is they can get stuck in local optima; I mitigate that by validating with dynamic programming or backtracking when the problem lacks the greedy-choice property.',
  'For scalability I would shard by key, add a caching layer, and use consistent hashing so rebalancing stays cheap as nodes are added or removed.',
];

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 80 });
  const context = await browser.newContext({ storageState: STATE_PATH, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const api = context.request;

  let sessionId = null;
  let total = 0;
  let reportId = null;
  const turnLog = [];

  // ── STEP 1: Start an interview (exercises 3-tier seeding) ────────────────
  try {
    const r = await api.post(`${TARGET_URL}/api/interview/start`, {
      data: {
        role: 'Algorithms',
        difficulty: 3,
        durationMinutes: 10,
        aiPersona: 'tech_lead',
        difficultyMin: 1,
        difficultyMax: 5,
      },
      headers: { 'Content-Type': 'application/json' },
    });
    const j = await r.json();
    if (r.status() === 201 && j.sessionId) {
      sessionId = j.sessionId;
      total = j.totalQuestions;
      rec('1. POST /start (seeding)', 'PASS', `session=${sessionId}, Turn1 served, total=${total}`);
      console.log(`     Q1: "${(j.questionText || '').slice(0, 80)}..."`);
    } else {
      rec('1. POST /start (seeding)', 'FAIL', `HTTP ${r.status()}: ${JSON.stringify(j).slice(0, 200)}`);
      await browser.close();
      printSummary();
      return;
    }
  } catch (e) {
    rec('1. POST /start (seeding)', 'FAIL', e.message);
    await browser.close(); printSummary(); return;
  }

  // ── STEP 2: Answer loop — submit each turn, observe AI feedback + difficulty ─
  let index = 0;
  let complete = false;
  let prevDifficultyAdjustments = [];
  for (let turn = 0; turn < total + 2 && !complete; turn++) {
    const quality = turn === 3 ? 'poor' : 'good'; // make turn 4 poor to test adaptive difficulty
    const payload = {
      questionIndex: index,
      transcript: ANSWERS[Math.min(turn, ANSWERS.length - 1)],
      metrics: makeMetrics(quality),
    };
    try {
      const t0 = Date.now();
      const r = await api.post(`${TARGET_URL}/api/interview/${sessionId}/answer`, {
        data: payload,
        headers: { 'Content-Type': 'application/json' },
        timeout: 90000,
      });
      const ms = Date.now() - t0;
      const j = await r.json();
      if (!r.ok()) {
        rec(`2.${turn + 1} answer index=${index}`, 'FAIL', `HTTP ${r.status()}: ${JSON.stringify(j).slice(0, 160)}`);
        break;
      }
      const fb = j.feedback || {};
      const scoreStr = fb.technicalAccuracy != null
        ? `tech=${fb.technicalAccuracy} comm=${fb.communication} voice=${fb.voiceCi} body=${fb.bodyCi} adj=${fb.difficultyAdjustment}`
        : '(no feedback)';
      turnLog.push({ index, quality, feedback: fb, ms });
      if (fb.difficultyAdjustment) prevDifficultyAdjustments.push(fb.difficultyAdjustment);

      const hasValidScores = ['technicalAccuracy', 'communication', 'voiceCi', 'bodyCi'].every(
        (k) => typeof fb[k] === 'number' && fb[k] >= 0 && fb[k] <= 100
      );
      complete = j.complete === true || j.nextQuestion === null;

      if (hasValidScores) {
        rec(`2.${turn + 1} answer index=${index} (${quality})`, 'PASS', `${scoreStr} [${ms}ms]${complete ? ' — LOOP COMPLETE' : ''}`);
      } else {
        rec(`2.${turn + 1} answer index=${index}`, 'WARN', `feedback missing/invalid scores: ${JSON.stringify(fb).slice(0, 120)}`);
      }
      if (!complete && typeof j.index === 'number') {
        index = j.index;
        if (j.nextQuestion) console.log(`     Next Q${index}: "${String(j.nextQuestion).slice(0, 80)}..."`);
      }
    } catch (e) {
      rec(`2.${turn + 1} answer index=${index}`, 'FAIL', e.message);
      break;
    }
  }

  // Validate AI usage: scores must vary (not hardcoded) and at least one difficulty adjustment seen
  try {
    const allScores = turnLog.map((t) => t.feedback.technicalAccuracy).filter((n) => typeof n === 'number');
    const distinct = new Set(allScores).size;
    if (allScores.length >= 2 && distinct >= 2) {
      rec('3. AI evaluation varies per answer', 'PASS', `${allScores.length} evals, ${distinct} distinct tech scores → genuine LLM output`);
    } else if (allScores.length >= 2) {
      rec('3. AI evaluation varies per answer', 'WARN', `scores identical across turns (${allScores.join(',')}) — possible stub`);
    } else {
      rec('3. AI evaluation varies per answer', 'WARN', 'not enough evals to judge');
    }
    if (prevDifficultyAdjustments.length) {
      rec('4. Adaptive difficulty signal', 'PASS', `adjustments: [${prevDifficultyAdjustments.join(', ')}]`);
    } else {
      rec('4. Adaptive difficulty signal', 'WARN', 'no difficultyAdjustment values returned');
    }
  } catch (e) {
    rec('3/4. AI evaluation checks', 'FAIL', e.message);
  }

  // ── STEP 4b: Per-turn AI scores must be 0–100, not 0–1 (BUG 1) ────────────
  try {
    const SCORE_FIELDS = ['technicalAccuracy', 'communication', 'voiceCi', 'bodyCi'];
    const allScoreValues = [];
    const fractionalValues = []; // values that look like a 0–1 scale (0 < x < 1)
    let maxTech = -Infinity;
    let anyScorePresent = false;

    for (const t of turnLog) {
      const f = t.feedback || {};
      if (typeof f.technicalAccuracy === 'number') {
        maxTech = Math.max(maxTech, f.technicalAccuracy);
      }
      for (const k of SCORE_FIELDS) {
        const v = f[k];
        if (typeof v === 'number') {
          anyScorePresent = true;
          allScoreValues.push(v);
          if (v > 0 && v < 1) fractionalValues.push(`${k}=${v}`);
        }
      }
    }

    const hasFractional = fractionalValues.length > 0;
    const techMaxTooSmall = maxTech !== -Infinity && maxTech <= 1;
    const hasPlausible100 = allScoreValues.some((v) => v >= 10);

    if (!anyScorePresent) {
      rec('4b. Scores on 0–100 scale (BUG 1)', 'FAIL', 'no numeric score fields collected across turns');
    } else if (hasFractional || techMaxTooSmall) {
      const why = [
        hasFractional ? `fractional values [${fractionalValues.join(', ')}]` : null,
        techMaxTooSmall ? `max technicalAccuracy=${maxTech} (<=1)` : null,
      ].filter(Boolean).join('; ');
      rec('4b. Scores on 0–100 scale (BUG 1)', 'FAIL', `scores on 0–1 scale, not 0–100 (BUG 1) — ${why}`);
    } else if (hasPlausible100) {
      rec('4b. Scores on 0–100 scale (BUG 1)', 'PASS', `max technicalAccuracy=${maxTech}, all values 0–100, no fractional 0<x<1`);
    } else {
      rec('4b. Scores on 0–100 scale (BUG 1)', 'FAIL', `scores on 0–1 scale, not 0–100 (BUG 1) — no score >= 10 (values: [${allScoreValues.join(', ')}])`);
    }
  } catch (e) {
    rec('4b. Scores on 0–100 scale (BUG 1)', 'FAIL', e.message);
  }

  // ── STEP 4c: Adaptive difficulty must be able to move (BUG 2) ─────────────
  try {
    const adjustments = turnLog
      .map((t) => (t.feedback || {}).difficultyAdjustment)
      .filter((a) => typeof a === 'string');
    const moved = adjustments.some((a) => a === 'increase' || a === 'decrease');
    if (adjustments.length === 0) {
      rec('4c. Adaptive difficulty never changes (BUG 2)', 'FAIL', 'no difficultyAdjustment values returned across turns');
    } else if (moved) {
      rec('4c. Adaptive difficulty can change (BUG 2)', 'PASS', `at least one move seen — [${adjustments.join(', ')}]`);
    } else {
      rec('4c. Adaptive difficulty never changes (BUG 2)', 'FAIL', `all 'same' across interview — [${adjustments.join(', ')}]`);
    }
  } catch (e) {
    rec('4c. Adaptive difficulty never changes (BUG 2)', 'FAIL', e.message);
  }

  // ── STEP 5: End the session → schedules report compilation (after()) ──────
  try {
    const r = await api.post(`${TARGET_URL}/api/interview/${sessionId}/end`, {
      data: { reason: 'test_complete' },
      headers: { 'Content-Type': 'application/json' },
    });
    const j = await r.json();
    if (r.ok() && j.reportId) {
      reportId = j.reportId;
      rec('5. POST /end (schedule report)', 'PASS', `reportId=${reportId}, status=${j.status}`);
    } else {
      rec('5. POST /end (schedule report)', 'WARN', `HTTP ${r.status()}: ${JSON.stringify(j).slice(0, 160)}`);
    }
  } catch (e) {
    rec('5. POST /end (schedule report)', 'FAIL', e.message);
  }

  // ── STEP 6: Poll the report until ready (background after() job) ──────────
  try {
    let ready = false;
    let lastStatus = 'pending';
    let reportPayload = null;
    for (let i = 0; i < 30 && !ready; i++) {
      await page.waitForTimeout(2000);
      const r = await api.get(`${TARGET_URL}/api/interview/${sessionId}/report`);
      if (r.status() === 404) { lastStatus = '404 (not linked yet)'; continue; }
      const j = await r.json();
      lastStatus = j.status;
      if (j.status === 'ready' && j.report) { ready = true; reportPayload = j.report; }
      else if (j.status === 'failed') { lastStatus = 'failed'; break; }
    }
    if (ready) {
      const rp = reportPayload;
      const ciOk = typeof rp.ciScore === 'number' && rp.ciScore >= 0 && rp.ciScore <= 100;
      rec('6. Report compiled & ready', 'PASS', `CI=${rp.ciScore}, weakTags=[${(rp.weaknessTags||[]).join(',')}], resources=${(rp.resources||[]).length}`);
      // Validate CI math: tech*0.35 + comm*0.25 + voice*0.20 + body*0.20
      const cs = rp.categoryScores || {};
      const expectedCi = cs.technicalAccuracy * 0.35 + cs.communication * 0.25 + cs.voiceCi * 0.20 + cs.bodyCi * 0.20;
      if (Math.abs(expectedCi - rp.ciScore) < 1.5) {
        rec('7. CI score formula correct', 'PASS', `computed ${expectedCi.toFixed(1)} ≈ reported ${rp.ciScore}`);
      } else {
        rec('7. CI score formula correct', 'WARN', `computed ${expectedCi.toFixed(1)} vs reported ${rp.ciScore}`);
      }
      // Validate AI narrative present
      if (rp.narrative && rp.narrative.length > 20) {
        rec('8. AI narrative generated', 'PASS', `"${rp.narrative.slice(0, 90)}..."`);
      } else {
        rec('8. AI narrative generated', 'WARN', `narrative empty/short: ${JSON.stringify(rp.narrative)}`);
      }
      // Behavioral timeline
      if (Array.isArray(rp.behavioralTimeline)) {
        rec('9. Behavioral timeline embedded', 'PASS', `${rp.behavioralTimeline.length} entries`);
      } else {
        rec('9. Behavioral timeline embedded', 'WARN', 'no timeline array');
      }
    } else {
      rec('6. Report compiled & ready', 'FAIL', `report not ready after ~60s (last status: ${lastStatus})`);
    }
  } catch (e) {
    rec('6. Report compiled & ready', 'FAIL', e.message);
  }

  // ── STEP 10: Render the report page in the browser (UI) ───────────────────
  try {
    await page.goto(`${TARGET_URL}/dashboard/b2c/interview/${sessionId}/report`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(4000);
    const txt = await page.locator('body').innerText();
    await page.screenshot({ path: 'F:\\project\\aicoach\\tmp\\shots\\10-report-ui.png', fullPage: true });
    if (/Confidence Index/i.test(txt) && /Category Breakdown|Behavioral Timeline|Recommended Resources/i.test(txt)) {
      rec('10. Report UI renders', 'PASS', 'CI + sections visible in browser');
    } else if (/Compiling your report/i.test(txt)) {
      rec('10. Report UI renders', 'WARN', 'still showing "Compiling…" (poll in progress)');
    } else {
      rec('10. Report UI renders', 'WARN', 'report sections not clearly detected');
    }
  } catch (e) {
    rec('10. Report UI renders', 'FAIL', e.message);
  }

  // ── STEP 11: Transcribe route reachable (Groq Whisper STT) ────────────────
  try {
    // Send an empty/no-audio request to confirm the route validates input (400), proving it's wired.
    const r = await api.post(`${TARGET_URL}/api/interview/transcribe`, { multipart: {} });
    if (r.status() === 400) {
      rec('11. STT route wired (Groq)', 'PASS', 'transcribe route validates input (400 on no audio)');
    } else {
      rec('11. STT route wired (Groq)', 'WARN', `unexpected HTTP ${r.status()}`);
    }
  } catch (e) {
    rec('11. STT route wired (Groq)', 'WARN', e.message);
  }

  console.log('\n──────── TURN-BY-TURN AI FEEDBACK ────────');
  for (const t of turnLog) {
    const f = t.feedback;
    console.log(`  idx ${t.index} (${t.quality}): tech=${f.technicalAccuracy} comm=${f.communication} voice=${f.voiceCi} body=${f.bodyCi} → ${f.difficultyAdjustment} [${t.ms}ms]`);
  }

  printSummary();
  await page.waitForTimeout(1500);
  await browser.close();

  function printSummary() {
    console.log('\n══════════════════════════════════════');
    console.log('  COMPLETE INTERVIEW FLOW — TEST SUMMARY');
    console.log('══════════════════════════════════════');
    const pass = results.filter((r) => r.status === 'PASS').length;
    const warn = results.filter((r) => r.status === 'WARN').length;
    const fail = results.filter((r) => r.status === 'FAIL').length;
    console.log(`  ✅ PASS: ${pass}   ⚠️  WARN: ${warn}   ❌ FAIL: ${fail}`);
    if (sessionId) console.log(`  Session: ${sessionId}`);
    if (reportId) console.log(`  Report:  ${reportId}`);
    console.log('══════════════════════════════════════');
  }
})();

const { chromium } = require('playwright');

const TARGET_URL = 'http://localhost:3000';
const STATE_PATH = 'F:\\project\\aicoach\\tmp\\playwright-interview-auth.json';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${TARGET_URL}/login`);
  console.log('🔐 Please log in manually in the browser window...');
  console.log('   Waiting for URL to contain "/dashboard"...');

  await page.waitForURL('**/dashboard/**', { timeout: 300000 });
  console.log('✅ Login detected! Saving session state...');

  await context.storageState({ path: STATE_PATH });
  console.log(`💾 Session saved to: ${STATE_PATH}`);

  await browser.close();
  console.log('🎉 Done!');
})();

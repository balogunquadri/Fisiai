const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Capture requests/responses
  page.on('request', req => {
    if (req.url().includes('/api/signup')) console.log('REQ', req.method(), req.url());
  });
  page.on('response', async res => {
    if (res.url().includes('/api/signup')) {
      console.log('RESP', res.status(), await res.text().catch(() => '<no body>'));
    }
  });

  await page.goto('http://localhost:3001/signup');
  const ts = Date.now();
  await page.fill('input[name="businessName"]', 'Local Frontend Test');
  await page.fill('input[name="email"]', `e2e+${ts}@example.com`);
  await page.fill('input[name="phone"]', '+15555550123');
  await page.fill('input[name="password"]', 'Test@12345');
  await page.fill('input[name="confirmPassword"]', 'Test@12345');
  const checkbox = page.locator('input[type="checkbox"]');
  if (await checkbox.count()) await checkbox.check();
  await page.click('button[type="submit"]');
  await page.waitForTimeout(8000);

  await browser.close();
  console.log('done');
})();

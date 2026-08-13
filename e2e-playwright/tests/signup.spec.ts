import { test, expect } from '@playwright/test';

test('signup then signin flow (handles verification link if shown)', async ({ page }) => {
  const base = '/'; // playwright.config.ts baseURL points to https://www.fisiai.online

  // Visit signup
  await page.goto(`${base}signup`);

  const ts = Date.now();
  const email = `e2e+${ts}@example.com`;
  const password = 'Test@12345';

  // Fill form
  await page.fill('input[name="businessName"]', `E2E Co ${ts}`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="phone"]', '+15555550123');
  await page.fill('input[name="password"]', password);
  await page.fill('input[name="confirmPassword"]', password);
  // Check terms checkbox (there's only one checkbox on the page)
  const checkbox = page.locator('input[type="checkbox"]');
  if (await checkbox.count() > 0) await checkbox.check();

  // Submit - form may or may not navigate immediately; wait a short time and look for verification UI
  await page.click('button[type="submit"]');

  // Wait for either success toast or verification UI or small delay
  await page.waitForTimeout(1500);

  // If verification link block is present, extract and visit it
  const verificationHeading = page.locator('text=Verification link');
  if (await verificationHeading.count() > 0) {
    // The markup shows the link text in a following <p> or an "Open verification link" anchor
    const openLink = page.locator('a', { hasText: 'Open verification link' }).first();
    if (await openLink.count() > 0) {
      const href = await openLink.getAttribute('href');
      if (href) await page.goto(href);
    } else {
      // Try to read the raw link text inside the verification block
      const block = verificationHeading.locator('..').nth(0);
      const possible = block.locator('p').nth(1);
      const text = (await possible.innerText().catch(() => '')) || '';
      if (text.startsWith('http')) {
        await page.goto(text);
      }
    }
  }

  // Now attempt sign in
  await page.goto(`${base}signin`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);

  // Submit sign in and wait for navigation or UI change
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => null),
    page.click('button[type="submit"]'),
  ]);

  // Accept either a redirect to /dashboard or a visible success toast.
  const currentUrl = page.url();
  if (currentUrl.includes('/signin')) {
    const successToast = page.locator('text=Signed in successfully');
    // If no toast appears within a short timeout, fail with diagnostic info.
    try {
      await expect(successToast).toBeVisible({ timeout: 5000 });
    } catch (err) {
      throw new Error(`Signin did not complete; still on ${currentUrl}. See test artifacts for details.`);
    }
  } else {
    expect(currentUrl).toContain('/dashboard');
  }
});

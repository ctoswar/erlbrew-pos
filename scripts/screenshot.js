const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 }, ignoreHTTPSErrors: true });
  const page = await context.newPage();

  await page.goto('https://localhost:3000', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(500);
  await page.keyboard.type('RF001');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(600);
  await page.keyboard.type('1234');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1200);

  const buttons = await page.locator('header button').all();
  console.log('Found', buttons.length, 'header buttons');

  if (buttons.length > 1) {
    await buttons[1].click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'timekeeping.png', fullPage: false });
    console.log('Saved: timekeeping.png');
  }

  if (buttons.length > 4) {
    await buttons[4].click();
    await page.waitForTimeout(1500);

    const staffBtn = await page.locator('nav button', { hasText: 'Staff' }).first();
    if (staffBtn) {
      await staffBtn.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: 'admin-staff.png', fullPage: true });
      console.log('Saved: admin-staff.png');
    }
  }

  await browser.close();
})();

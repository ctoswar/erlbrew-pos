import { chromium } from 'playwright';
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 }, ignoreHTTPSErrors: true });
  const page = await context.newPage();

  await page.goto('https://localhost:3000');
  await page.evaluate(() => {
    localStorage.setItem('erlbrew_staff', JSON.stringify({
      id: 1, rfid: 'RF001', pin: '1234', name: 'Jane Dela Cruz',
      role: 'Manager', initials: 'JD', color: '#c4956a'
    }));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  // Click Staff in sidebar
  const navButtons = await page.locator('nav button').all();
  for (const btn of navButtons) {
    const text = await btn.textContent();
    if (text && text.includes('Staff')) {
      await btn.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: 'admin-staff.png', fullPage: true });
      console.log('Saved: admin-staff.png');
      break;
    }
  }

  // Click Time Keeping in sidebar
  for (const btn of navButtons) {
    const text = await btn.textContent();
    if (text && text.includes('Time Keeping')) {
      await btn.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: 'timekeeping.png', fullPage: false });
      console.log('Saved: timekeeping.png');
      break;
    }
  }

  await browser.close();
})();

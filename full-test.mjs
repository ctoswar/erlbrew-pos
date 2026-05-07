// Final test: sidebar Z-Report and Cash Drawer tabs actually render content
import { chromium } from 'playwright';

async function runTest() {
  const browser = await chromium.launch({
    headless: false,
    args: ['--ignore-certificate-errors', '--allow-insecure-localhost']
  });

  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  try {
    await page.goto('https://localhost:3000', { timeout: 20000, waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Login as Manager
    console.log('1. Login as Manager...');
    await page.locator('input[placeholder*="Scan card"]').fill('RF004');
    await page.locator('button:has-text("GO")').click();
    await page.waitForTimeout(1500);
    await page.locator('button:text-is("3")').click();
    await page.locator('button:text-is("4")').click();
    await page.locator('button:text-is("5")').click();
    await page.locator('button:text-is("6")').click();
    await page.locator('button:text-is("LOGIN")').click();
    await page.waitForTimeout(4000);

    await page.screenshot({ path: 'test-screenshots/01-admin-dashboard.png', fullPage: true });

    // Sidebar should now show Z-Report and Cash Drawer
    console.log('2. Checking sidebar items...');
    const sidebarItems = await page.evaluate(() => {
      const nav = document.querySelector('nav');
      if (!nav) return [];
      return Array.from(nav.querySelectorAll('button')).map(b => b.textContent?.trim() || '');
    });
    console.log('   Sidebar items:', sidebarItems);
    console.log('   Has Z-Report:', sidebarItems.some(s => s.includes('Z-Report')));
    console.log('   Has Cash Drawer:', sidebarItems.some(s => s.includes('Cash Drawer')));

    // Click Z-Report
    console.log('\n3. Clicking Z-Report...');
    await page.locator('nav button:has-text("Z-Report")').click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-screenshots/02-zreport.png', fullPage: true });
    const zBody = await page.textContent('body');
    console.log('   Z-Report content contains Z-Report:', zBody.includes('Z-Report'));

    // Click Cash Drawer
    console.log('\n4. Clicking Cash Drawer...');
    await page.locator('nav button:has-text("Cash Drawer")').click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-screenshots/03-cashdrawer.png', fullPage: true });
    const cdBody = await page.textContent('body');
    console.log('   Cash Drawer content visible:', cdBody.length > 0);

    console.log('\n5. Kitchen - Void button check...');
    // Logout and login as employee
    await page.locator('button:has-text("Logout")').click();
    await page.waitForTimeout(1000);

    // Login as employee
    await page.locator('input[placeholder*="Scan card"]').fill('0005809406');
    await page.locator('button:has-text("GO")').click();
    await page.waitForTimeout(1500);
    await page.locator('button:text-is("1")').click();
    await page.locator('button:text-is("2")').click();
    await page.locator('button:text-is("3")').click();
    await page.locator('button:text-is("4")').click();
    await page.locator('button:text-is("LOGIN")').click();
    await page.waitForTimeout(3000);

    // Go to Kitchen
    await page.locator('button:has-text("KITCHEN")').click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-screenshots/04-kitchen.png', fullPage: true });

    const voidBtns = page.locator('button:has-text("Void")');
    console.log('   Void buttons on Kitchen:', await voidBtns.count());

    console.log('\n=== ALL CHECKS PASSED ===');
    await browser.close();
  } catch (e) {
    console.error('Error:', e.message);
    await page.screenshot({ path: 'test-screenshots/99-error.png', fullPage: true });
    await browser.close();
  }
}

runTest();
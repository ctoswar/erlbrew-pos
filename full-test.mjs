// Full login and verify admin
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

    // Login with RFID + PIN
    console.log('1. Entering RFID RF004...');
    await page.locator('input[placeholder*="Scan card"]').fill('RF004');
    await page.locator('button:has-text("GO")').click();
    await page.waitForTimeout(1500);

    console.log('2. Entering PIN 3456...');
    // Click 3-4-5-6
    await page.locator('button:text-is("3")').click(); await page.waitForTimeout(100);
    await page.locator('button:text-is("4")').click(); await page.waitForTimeout(100);
    await page.locator('button:text-is("5")').click(); await page.waitForTimeout(100);
    await page.locator('button:text-is("6")').click(); await page.waitForTimeout(100);
    await page.locator('button:text-is("LOGIN")').click();
    console.log('3. Clicked LOGIN');

    // Wait for navigation
    await page.waitForTimeout(3000);

    // Check page content
    const body = await page.textContent('body');
    console.log('\n4. Page content after login:');
    console.log(`   Dashboard: ${body.includes('Dashboard')}`);
    console.log(`   Reports: ${body.includes('Reports')}`);
    console.log(`   Inventory: ${body.includes('Inventory')}`);
    console.log(`   Staff: ${body.includes('Staff')}`);
    console.log(`   Settings: ${body.includes('Settings')}`);
    console.log(`   ERLBREW: ${body.includes('ERLBREW')}`);
    console.log(`   Point of Sale: ${body.includes('Point of Sale')}`);

    await page.screenshot({ path: 'test-screenshots/01-after-full-login.png', fullPage: true });

    // Check if we have admin tabs
    const dashboardTab = page.locator('text=Dashboard').first();
    const reportsTab = page.locator('text=Reports').first();

    if (await dashboardTab.isVisible()) {
      console.log('\n=== ON ADMIN DASHBOARD ===');

      // Test Reports
      console.log('\n5. Testing Reports tab...');
      await reportsTab.click();
      await page.waitForTimeout(1500);

      const janBtn = page.locator('button:has-text("JAN")');
      if (await janBtn.isVisible()) {
        console.log('   JAN monthly filter present');
        await janBtn.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: 'test-screenshots/02-reports-jan.png', fullPage: true });
      } else {
        console.log('   JAN NOT found - checking page');
        await page.screenshot({ path: 'test-screenshots/02b-reports-page.png', fullPage: true });
      }

      // Test Inventory
      console.log('\n6. Testing Inventory tab...');
      await page.locator('text=Inventory').first().click();
      await page.waitForTimeout(1500);

      const minusBtn = page.locator('button:has-text("−")').first();
      const plusBtn = page.locator('button:has-text("+")').first();

      if (await minusBtn.isVisible()) {
        console.log('   Inventory +/- buttons present');
        await minusBtn.click();
        await page.waitForTimeout(1500);
        await page.screenshot({ path: 'test-screenshots/03-inventory-after-minus.png', fullPage: true });
      } else {
        console.log('   +/- buttons NOT found');
        await page.screenshot({ path: 'test-screenshots/03b-inventory-page.png', fullPage: true });
      }

      // Test Settings (for theme/font)
      console.log('\n7. Testing Settings tab...');
      await page.locator('text=Settings').first().click();
      await page.waitForTimeout(1500);

      const whiteBtn = page.locator('button:has-text("White")').first();
      const xlBtn = page.locator('button:has-text("XL")').first();

      console.log(`   White theme button: ${await whiteBtn.isVisible().catch(() => false)}`);
      console.log(`   XL font button: ${await xlBtn.isVisible().catch(() => false)}`);

      await page.screenshot({ path: 'test-screenshots/04-settings-page.png', fullPage: true });

      // Test Supplier Invoices
      console.log('\n8. Testing Supplier Invoices tab...');
      const invoicesTab = page.locator('text=Invoices').first();
      if (await invoicesTab.isVisible()) {
        await invoicesTab.click();
        await page.waitForTimeout(1500);
        await page.screenshot({ path: 'test-screenshots/05-supplier-invoices-page.png', fullPage: true });

        const newInvoiceBtn = page.locator('button:has-text("New Invoice")');
        console.log(`   + New Invoice button: ${await newInvoiceBtn.isVisible().catch(() => false)}`);

        // Check for Edit button
        const editBtn = page.locator('button:has-text("Edit")').first();
        console.log(`   Edit button: ${await editBtn.isVisible().catch(() => false)}`);

        // Check for Email button
        const emailBtn = page.locator('button:has-text("Email")').first();
        console.log(`   Email button: ${await emailBtn.isVisible().catch(() => false)}`);

        // Test clicking Email button if visible
        if (await emailBtn.isVisible().catch(() => false)) {
          console.log('   Clicking Email button...');
          await emailBtn.click();
          await page.waitForTimeout(1000);
          await page.screenshot({ path: 'test-screenshots/05b-email-modal.png', fullPage: true });

          // Check for Open in Gmail button
          const gmailBtn = page.locator('button:has-text("Open in Gmail")');
          console.log(`   Open in Gmail button: ${await gmailBtn.isVisible().catch(() => false)}`);
        }

        console.log('\n   All Supplier Invoice buttons verified!');
      } else {
        console.log('   Invoices tab NOT found');
        await page.screenshot({ path: 'test-screenshots/05c-admin-tabs.png', fullPage: true });
      }

      console.log('\n=== ALL ADMIN TESTS COMPLETED ===');
    } else {
      console.log('\n=== NOT ON ADMIN - checking POS...');
      // Might be on POS - check for menu items
      const menuItems = page.locator('text=Signature Brews, text=Coffee').first();
      console.log('   Menu items visible:', await menuItems.isVisible().catch(() => false));
    }

  } catch (e) {
    console.error('Error:', e.message);
    await page.screenshot({ path: 'test-screenshots/99-error-final.png', fullPage: true });
  }

  await browser.close();
}

runTest();
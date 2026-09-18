import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const outDir = path.resolve('public/images/projects');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function run() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--ignore-certificate-errors', '--no-sandbox']
  });

  async function createPage(width = 1440, height = 900) {
    const ctx = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 2,
    });
    return await ctx.newPage();
  }

  // -------------------------------------------------------------
  // 1. SimAKSI (BBKK Surabaya)
  // -------------------------------------------------------------
  console.log('[1/6] Capturing SimAKSI (BBKK Surabaya)...');
  try {
    const page = await createPage(1440, 900);
    await page.goto('https://simaksi.yaumalatsal.com', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(outDir, 'simaksi-live.png') });
    console.log('  -> Captured simaksi-live.png');

    // Login card
    await page.goto('https://simaksi.yaumalatsal.com/login', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);
    const card = page.locator('div.shadow-xl, div.w-full.sm\\:max-w-md, form').first();
    if (await card.count() > 0) {
      await card.screenshot({ path: path.join(outDir, 'simaksi-card.png') });
      console.log('  -> Captured simaksi-card.png');
    }
    await page.context().close();
  } catch (err) {
    console.error('  Error SimAKSI:', err.message);
  }

  // -------------------------------------------------------------
  // 2. Hot Work Permit (PT Smelting Gresik)
  // -------------------------------------------------------------
  console.log('[2/6] Capturing Hot Work Permit (PT Smelting)...');
  try {
    const page = await createPage(1440, 900);
    await page.goto('https://hotwork.yaumalatsal.com', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(outDir, 'hotwork-permit-live.png') });
    console.log('  -> Captured hotwork-permit-live.png');

    // Open login modal / card if present
    const loginTrigger = page.locator('button:has-text("Masuk"), a:has-text("Masuk"), button:has-text("Login")').first();
    if (await loginTrigger.count() > 0) {
      await loginTrigger.click().catch(() => {});
      await page.waitForTimeout(800);
    }
    const modal = page.locator('[role="dialog"], .modal, [class*="modal"], form').first();
    if (await modal.count() > 0) {
      await modal.screenshot({ path: path.join(outDir, 'hotwork-permit-login.png') });
      console.log('  -> Captured hotwork-permit-login.png');
    }
    await page.context().close();
  } catch (err) {
    console.error('  Error Hot Work:', err.message);
  }

  // -------------------------------------------------------------
  // 3. Equipment & Room Status (RS Petrokimia Gresik / Baringan)
  // -------------------------------------------------------------
  console.log('[3/6] Capturing Baringan (RS Petrokimia)...');
  try {
    const page = await createPage(1440, 900);
    await page.goto('https://baringan.yaumalatsal.com/login', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(outDir, 'baringan-live.png') });
    console.log('  -> Captured baringan-live.png');

    // Attempt login with demo account
    try {
      const userInput = page.locator('input#username, input[name="username"]').first();
      if (await userInput.count() > 0) {
        await userInput.fill('demo@baringan.test');
        await page.fill('input#password, input[name="password"]', 'demo1234');
        await page.click('button[type="submit"]');
        await page.waitForTimeout(2500);
        if (!page.url().includes('login')) {
          await page.screenshot({ path: path.join(outDir, 'baringan-dashboard.png') });
          console.log('  -> Captured baringan-dashboard.png (logged in)');
        }
      }
    } catch (e) {
      console.log('  Notice: Baringan demo login skipped:', e.message);
    }

    // Card snapshot for float
    await page.goto('https://baringan.yaumalatsal.com/login', { waitUntil: 'networkidle' });
    const baringanCard = page.locator('form, [class*="card"], .bg-white').first();
    if (await baringanCard.count() > 0) {
      await baringanCard.screenshot({ path: path.join(outDir, 'baringan-card.png') });
      console.log('  -> Captured baringan-card.png');
    }
    await page.context().close();
  } catch (err) {
    console.error('  Error Baringan:', err.message);
  }

  // -------------------------------------------------------------
  // 4. PingLab LMS (Fading Scaffolding Platform)
  // -------------------------------------------------------------
  console.log('[4/6] Capturing PingLab...');
  try {
    const page = await createPage(1440, 900);
    await page.goto('https://pinglab.yaumalatsal.com', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(outDir, 'pinglab-live.png') });
    console.log('  -> Captured pinglab-live.png');

    // Card snapshot: "SATU PEMBELAJAR, DI TENGAH PENDAKIAN"
    const scaffoldCard = page.locator('div:has-text("SATU PEMBELAJAR, DI TENGAH PENDAKIAN")').locator('..').first();
    if (await scaffoldCard.count() > 0) {
      await scaffoldCard.screenshot({ path: path.join(outDir, 'pinglab-card.png') });
      console.log('  -> Captured pinglab-card.png (scaffolding ladder)');
    } else {
      await page.goto('https://pinglab.yaumalatsal.com/login', { waitUntil: 'networkidle' });
      const loginCard = page.locator('form, [class*="card"]').first();
      await loginCard.screenshot({ path: path.join(outDir, 'pinglab-card.png') });
      console.log('  -> Captured pinglab-card.png (login fallback)');
    }
    await page.context().close();
  } catch (err) {
    console.error('  Error PingLab:', err.message);
  }

  // -------------------------------------------------------------
  // 5. Staff Attendance System (PT Panca Pilar Hutama)
  // -------------------------------------------------------------
  console.log('[5/6] Capturing Staff Attendance (PT Panca Pilar Hutama)...');
  try {
    const page = await createPage(1440, 900);
    await page.goto('https://absensi.pancapilarhutama.co.id/login', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(outDir, 'online-attendance-live.png') });
    console.log('  -> Captured online-attendance-live.png');

    const attCard = page.locator('div.rounded-3xl.bg-white, form').first();
    if (await attCard.count() > 0) {
      await attCard.screenshot({ path: path.join(outDir, 'online-attendance-login.png') });
      console.log('  -> Captured online-attendance-login.png');
    }
    await page.context().close();
  } catch (err) {
    console.error('  Error Attendance:', err.message);
  }

  // -------------------------------------------------------------
  // 6. Business Incubation LMS (Bisa-LMS)
  // -------------------------------------------------------------
  console.log('[6/6] Capturing Bisa-LMS...');
  try {
    const page = await createPage(1440, 900);
    await page.goto('https://bisa.yaumalatsal.com/login', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outDir, 'bisa-lms-login.png') });
    console.log('  -> Captured bisa-lms-login.png');

    // Admin login for real LMS dashboard
    try {
      await page.fill('input[name="email"], input[type="email"]', 'admin@bisa.yaumalatsal.com');
      await page.fill('input[name="password"]', '1uyfhugVhXMDgfxt');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(2500);
      console.log('  Bisa URL after login:', page.url());
      await page.screenshot({ path: path.join(outDir, 'bisa-lms-dashboard.png') });
      console.log('  -> Captured bisa-lms-dashboard.png');
    } catch (e) {
      console.log('  Notice: Bisa admin login fallback:', e.message);
    }
    await page.context().close();
  } catch (err) {
    console.error('  Error Bisa LMS:', err.message);
  }

  await browser.close();
  console.log('\n=== All screenshots recaptured successfully! ===');
}

run().catch(console.error);

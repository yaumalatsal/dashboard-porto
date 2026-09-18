import { chromium } from 'playwright';
import path from 'node:path';

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--ignore-certificate-errors']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });

  const page = await context.newPage();
  const outDir = path.resolve('public/images/projects');

  console.log('Navigating to https://absensi.pancapilarhutama.co.id/login ...');
  await page.goto('https://absensi.pancapilarhutama.co.id/login', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  const title = await page.title();
  console.log('Page title:', title);

  await page.screenshot({ path: path.join(outDir, 'online-attendance-live.png') });
  console.log('Captured online-attendance-live.png');

  // Also take a centered modal/card screenshot if available
  const card = await page.$('.bg-white, form, .login-card, [class*="card"], [class*="login"]');
  if (card) {
    await card.screenshot({ path: path.join(outDir, 'online-attendance-card.png') });
    console.log('Captured online-attendance-card.png');
  }

  await browser.close();
  console.log('Done!');
}

main().catch(console.error);

import { expect, test } from "@playwright/test";

test("observatory shows real projects and opens their case studies", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator(".intro-loader")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Yaumal Atsal");
  await expect(page.locator(".obs-project")).toHaveCount(4);
  await expect(page.locator("#contact a[href^='mailto:']").first()).toHaveAttribute("href", "mailto:mdzakiyaumal18@gmail.com");
  await page.locator(".obs-project").first().click();
  await expect(page).toHaveURL(/\/work\/performance-data-centre$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Institutional Performance Data System");
  expect(errors).toEqual([]);
});

test("mobile navigation, experience disclosure, and reduced motion work", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".intro-loader")).toHaveCount(0);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.getByRole("button", { name: "Close navigation" })).toHaveAttribute("aria-expanded", "true");
  await page.locator(".mobile-nav").getByRole("link", { name: "Projects" }).click();
  await expect(page.getByRole("button", { name: "Open navigation" })).toHaveAttribute("aria-expanded", "false");
  await expect.poll(() => page.locator("#work").evaluate(el => Math.abs(el.getBoundingClientRect().top - 95))).toBeLessThan(3);
  const record = page.locator("#experience details").first();
  await record.locator("summary").click();
  await expect(record).toHaveAttribute("open", "");
  await expect(record.locator("p")).toBeVisible();
  await expect(page.locator(".astrolabe-scene")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("original astrolabe retains rotation, reset, and constellation controls", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".celestial-clock-3d canvas")).toBeVisible();
  const rim = page.locator(".orrery__rim-control");
  await rim.focus();
  const initial = await rim.getAttribute("aria-label");
  await page.keyboard.press("ArrowRight");
  await expect(rim).not.toHaveAttribute("aria-label", initial!);
  await page.getByRole("button", { name: "Reset celestial instrument" }).click();
  await expect(rim).toHaveAttribute("aria-label", /pitch 42 degrees, yaw 0 degrees/);
  const map = page.getByRole("group", { name: "Constellation map" });
  await map.getByRole("button", { name: "pisces", exact: true }).click();
  await expect(map.getByRole("button", { name: "pisces", exact: true })).toHaveAttribute("aria-pressed", "true");
  await map.getByRole("button", { name: "aries", exact: true }).click();
  await page.getByRole("button", { name: "Open About at Hamal" }).click();
  await expect.poll(() => page.locator("#about").evaluate(el => Math.abs(el.getBoundingClientRect().top - 95))).toBeLessThan(3);
});

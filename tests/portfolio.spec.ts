import { expect, test } from "@playwright/test";

test("uses the Aries orrery as the primary desktop navigation", async ({ browser }) => {
  test.setTimeout(60_000);
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto("/");
  await expect(page.locator(".intro-loader")).toHaveCount(0, { timeout: 5_000 });
  await expect(page.getByRole("heading", { level: 1, name: "Aether" })).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(2);
  await expect(page.locator(".astrolabe-scene")).toBeVisible();
  await expect(page.locator(".celestial-clock-3d canvas")).toBeVisible();
  await expect(page.locator(".orrery-star")).toHaveCount(6);

  expect(await page.evaluate(() => getComputedStyle(document.body).overflowY)).toBe("hidden");
  await page.mouse.wheel(0, 800);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);

  const clock = page.locator(".celestial-clock-3d");
  const clockCanvas = clock.locator("canvas");
  const ambientFrame = await clockCanvas.screenshot();
  await page.waitForTimeout(400);
  expect((await clockCanvas.screenshot()).equals(ambientFrame)).toBe(false);

  const rimControl = page.locator(".orrery__rim-control");
  const eastRimGrip = page.locator(".orrery__rim-grip--east");
  const initialInstrumentOrientation = await clock.getAttribute("data-instrument-orientation");
  await expect(rimControl).toHaveAttribute("aria-label", /Current pitch 42 degrees, yaw 0 degrees/);
  await expect(eastRimGrip).toHaveAttribute("data-cursor-label", "Orbit");
  const rimBounds = await eastRimGrip.boundingBox();
  expect(rimBounds).not.toBeNull();
  if (rimBounds) {
    const startX = rimBounds.x + rimBounds.width * 0.5;
    const startY = rimBounds.y + rimBounds.height * 0.5;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX - 24, startY + 54, { steps: 6 });
    await expect(rimControl).toHaveClass(/is-dragging/);
    await expect(eastRimGrip).toHaveAttribute("data-cursor-label", "Turning");
    await page.mouse.up();
  }
  await expect(rimControl).not.toHaveClass(/is-dragging/);
  await expect(page.locator(".astrolabe-scene")).toHaveClass(/is-clock-spinning/);
  await expect(eastRimGrip).toHaveAttribute("data-cursor-label", "Coasting");
  await expect.poll(() => clock.getAttribute("data-instrument-orientation")).not.toBe(initialInstrumentOrientation);
  await expect(rimControl).not.toHaveAttribute("aria-label", /Current pitch 42 degrees, yaw 0 degrees/);

  await page.getByRole("button", { name: "Reset celestial instrument" }).click();
  const initialGlobeRotation = await clock.getAttribute("data-globe-rotation");
  await expect(clock).toHaveAttribute("data-cursor-label", "Rotate");
  const globeBounds = await clock.boundingBox();
  expect(globeBounds).not.toBeNull();
  if (globeBounds) {
    const startX = globeBounds.x + globeBounds.width * 0.5;
    const startY = globeBounds.y + globeBounds.height * 0.52;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 72, startY - 32, { steps: 6 });
    await expect(clock).toHaveClass(/is-dragging/);
    await expect(clock).toHaveAttribute("data-cursor-label", "Turning");
    await page.mouse.up();
  }
  await expect(clock).not.toHaveClass(/is-dragging/);
  await expect(clock).toHaveClass(/is-spinning/);
  await expect(clock).toHaveAttribute("data-cursor-label", "Coasting");
  await expect.poll(() => clock.getAttribute("data-globe-rotation")).not.toBe(initialGlobeRotation);

  await clock.focus();
  const draggedGlobeRotation = await clock.getAttribute("data-globe-rotation");
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => clock.getAttribute("data-globe-rotation")).not.toBe(draggedGlobeRotation);

  await page.getByRole("button", { name: "Reset celestial instrument" }).click();

  const hamal = page.getByRole("button", { name: "Open The Practice at Hamal" });
  await expect(hamal).toBeVisible();
  const sheratanBounds = await page.getByRole("button", { name: "Open Field Records at Sheratan" }).boundingBox();
  const mesarthimBounds = await page.getByRole("button", { name: "Open Capabilities at Mesarthim" }).boundingBox();
  expect(sheratanBounds).not.toBeNull();
  expect(mesarthimBounds).not.toBeNull();
  if (sheratanBounds && mesarthimBounds) {
    const separation = Math.hypot(
      sheratanBounds.x - mesarthimBounds.x,
      sheratanBounds.y - mesarthimBounds.y,
    );
    expect(separation).toBeGreaterThan(60);
  }
  await hamal.click();
  await expect(page.locator(".astrolabe-scene")).toHaveAttribute("data-focus-phase", "targeting");
  await expect(hamal).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".orrery-detail--about")).toBeVisible();
  await expect(page.locator(".astrolabe-scene")).toHaveAttribute("data-focus-phase", "reading");
  // Focus closes in enough to read the coordinate but stops well short of filling the
  // frame — past ~1.3 the globe becomes a full-bleed wall behind the chapter text.
  await expect.poll(async () => Number(await clock.getAttribute("data-camera-zoom"))).toBeGreaterThan(1.05);
  const focusedZoom = Number(await clock.getAttribute("data-camera-zoom"));
  expect(focusedZoom).toBeGreaterThan(1.05);
  expect(focusedZoom).toBeLessThan(1.3);
  await expect(page.getByRole("heading", { name: "Making terrain legible." })).toBeVisible();

  // The record and the instrument must occupy separate ground: the instrument slides into
  // the right half so no line of the chapter is set over the brass or the globe.
  const headingBounds = await page.getByRole("heading", { name: "Making terrain legible." }).boundingBox();
  const instrumentBounds = await page.locator(".astrolabe-scene").boundingBox();
  expect(headingBounds).not.toBeNull();
  expect(instrumentBounds).not.toBeNull();
  if (headingBounds && instrumentBounds) {
    expect(headingBounds.x + headingBounds.width).toBeLessThanOrEqual(instrumentBounds.x);
    expect(instrumentBounds.x + instrumentBounds.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  }
  const missionImage = page.getByRole("img", { name: "Interfaces as navigable terrain" });
  await expect(missionImage).toBeVisible();
  await expect.poll(() => missionImage.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await expect(page.locator(".orrery-detail__practice li")).toHaveCount(3);
  await expect(page.locator(".zodiac-overlay")).toHaveCount(0);
  expect(await page.evaluate(() => window.location.hash)).toBe("#about");
  await page.keyboard.press("Escape");
  await expect(page.locator(".orrery-detail")).toHaveCount(0);

  const constellationMap = page.getByRole("group", { name: "Constellation map" });
  await constellationMap.getByRole("button", { name: "pisces" }).click();
  await expect(constellationMap.getByRole("button", { name: "pisces" })).toHaveAttribute("aria-pressed", "true");
  await expect(clock).toHaveAttribute("data-constellation-spotlight", "pisces");
  const alrescha = page.getByRole("button", { name: "Open The Knot at Alrescha" });
  await expect(alrescha).toBeVisible();
  await alrescha.click();
  await expect(clock).toHaveAttribute("data-constellation-spotlight", "pisces");
  await expect(page.getByRole("heading", { name: "Binding the threads." })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".astrolabe-scene")).toHaveAttribute("data-focus-phase", "idle");

  await page.getByRole("link", { name: /Field Records/ }).first().click();
  await expect(page.locator(".orrery-detail--work")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Selected systems" })).toBeVisible();
  await expect(page.locator(".orrery-detail__projects a")).toHaveCount(4);
  await expect(page.getByRole("link", { name: /Nexus Control/ })).toHaveAttribute("href", "/work/nexus-control");
  await page.getByRole("button", { name: "Return to the Aries map" }).click();
  await expect(page.locator(".orrery-detail")).toHaveCount(0);

  await page.getByRole("link", { name: /Field Kit/ }).first().click();
  await expect(page.locator(".orrery-detail--skills")).toBeVisible();
  await expect(page.locator(".orrery-detail__capabilities article")).toHaveCount(4);
  await expect(page.getByRole("heading", { name: "Four working layers" })).toBeVisible();
  await page.keyboard.press("Escape");

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  expect(errors).toEqual([]);
  await context.close();
});

test("keeps case studies separate from the immersive home instrument", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto("/work/nexus-control");
  await expect(page.getByRole("heading", { level: 1, name: "Nexus Control" })).toBeVisible();
  await expect(page.locator(".astrolabe-scene")).toHaveCount(0);
  await expect(page.locator(".case-study-astrolabe")).toBeVisible();
  await expect(page.locator(".case-study-image-container img")).toBeVisible();
  await expect(page.locator(".case-study-image-reticle")).toBeVisible();
  await expect(page.getByRole("heading", { name: "System Notes" })).toBeAttached();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  expect(errors).toEqual([]);
});

test("keeps the star guide usable on mobile with reduced motion", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
    isMobile: true,
    hasTouch: true,
  });
  await context.addInitScript(() => window.sessionStorage.setItem("aether-intro-seen", "true"));
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto("/");
  await expect(page.locator(".intro-loader")).toHaveCount(0);
  await expect(page.locator("canvas")).toHaveCount(2);
  await expect(page.locator(".astrolabe-scene")).toBeVisible();
  await expect(page.locator(".orrery-star")).toHaveCount(6);
  expect(await page.evaluate(() => getComputedStyle(document.body).overflowY)).toBe("hidden");

  const sheratan = page.getByRole("button", { name: "Open Field Records at Sheratan" });
  await sheratan.click();
  await expect(page.getByRole("heading", { name: "Selected systems" })).toBeVisible();
  await expect(page.locator(".orrery-detail__projects a")).toHaveCount(4);
  await expect(page.locator(".zodiac-overlay")).toHaveCount(0);
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.getByRole("button", { name: "Close navigation" })).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(".mobile-nav__instrument")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Open navigation" })).toBeFocused();

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  expect(errors).toEqual([]);
  await context.close();
});


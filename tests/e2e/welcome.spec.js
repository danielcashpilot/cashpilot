// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Welcome Screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/cashpilot_demo.html');
  });

  test('renders CashPilot logo and title', async ({ page }) => {
    await expect(page.locator('.logo')).toContainText('CashPilot');
  });

  test('welcome badge is visible', async ({ page }) => {
    const badge = page.locator('.welcome-badge');
    await expect(badge).toBeVisible();
  });

  test('welcome title contains key text', async ({ page }) => {
    const title = page.locator('#w-title');
    await expect(title).toBeVisible();
    const text = await title.innerText();
    expect(text.length).toBeGreaterThan(5);
  });

  test('privacy notice is visible', async ({ page }) => {
    await expect(page.locator('#w-privacy')).toBeVisible();
  });

  test('3 how-it-works steps are shown', async ({ page }) => {
    const steps = page.locator('.wstep');
    await expect(steps).toHaveCount(3);
  });

  test('demo button is visible', async ({ page }) => {
    await expect(page.locator('#demo-btn')).toBeVisible();
  });

  test('language toggle buttons present', async ({ page }) => {
    await expect(page.locator('#heb-btn')).toBeVisible();
    await expect(page.locator('#en-btn')).toBeVisible();
  });

  test('Hebrew is default language (he button is active)', async ({ page }) => {
    await expect(page.locator('#heb-btn')).toHaveClass(/on/);
    await expect(page.locator('#en-btn')).not.toHaveClass(/on/);
  });

  test('page direction is RTL in Hebrew mode', async ({ page }) => {
    const dir = await page.locator('html').getAttribute('dir');
    expect(dir).toBe('rtl');
  });
});

test.describe('Language Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/cashpilot_demo.html');
  });

  test('switches to English when EN button clicked', async ({ page }) => {
    await page.click('#en-btn');
    await expect(page.locator('#en-btn')).toHaveClass(/on/);
    await expect(page.locator('#heb-btn')).not.toHaveClass(/on/);
  });

  test('page direction becomes LTR in English mode', async ({ page }) => {
    await page.click('#en-btn');
    const dir = await page.locator('html').getAttribute('dir');
    expect(dir).toBe('ltr');
  });

  test('welcome title text changes to English', async ({ page }) => {
    await page.click('#en-btn');
    const text = await page.locator('#w-title').innerText();
    expect(text).toMatch(/understand|money|seconds/i);
  });

  test('privacy text changes to English', async ({ page }) => {
    await page.click('#en-btn');
    const text = await page.locator('#w-privacy').innerText();
    expect(text).toMatch(/deleted|privacy/i);
  });

  test('switches back to Hebrew', async ({ page }) => {
    await page.click('#en-btn');
    await page.click('#heb-btn');
    await expect(page.locator('#heb-btn')).toHaveClass(/on/);
    const dir = await page.locator('html').getAttribute('dir');
    expect(dir).toBe('rtl');
  });

  test('demo button text changes language', async ({ page }) => {
    const heBefore = await page.locator('#demo-btn').innerText();
    await page.click('#en-btn');
    const enAfter = await page.locator('#demo-btn').innerText();
    expect(heBefore).not.toBe(enAfter);
  });
});

test.describe('Wide Mode Toggle', () => {
  test('toggles wide class on wrap', async ({ page }) => {
    await page.goto('/cashpilot_demo.html');
    const wrapBefore = await page.locator('#wrap').getAttribute('class');
    await page.click('#view-btn');
    const wrapAfter = await page.locator('#wrap').getAttribute('class');
    expect(wrapBefore).not.toBe(wrapAfter);
  });
});

// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Demo Dashboard Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/cashpilot_demo.html');
  });

  async function launchDemo(page) {
    await page.click('#w-btn');
    // Wait for the loading to finish and dashboard to appear
    await expect(page.locator('#s-dash')).toHaveClass(/active/, { timeout: 10000 });
  }

  test('clicking start button starts loading animation', async ({ page }) => {
    await page.click('#w-btn');
    // Loading screen should appear briefly
    await expect(page.locator('#s-loading')).toHaveClass(/active/);
  });

  test('dashboard becomes active after loading', async ({ page }) => {
    await launchDemo(page);
    await expect(page.locator('#s-dash')).toHaveClass(/active/);
  });

  test('demo banner is visible on dashboard', async ({ page }) => {
    await launchDemo(page);
    await expect(page.locator('.demo-banner')).toBeVisible();
  });

  test('doc type badge is shown', async ({ page }) => {
    await launchDemo(page);
    await expect(page.locator('#type-badge')).toBeVisible();
    const text = await page.locator('#type-badge').innerText();
    expect(text.length).toBeGreaterThan(0);
    expect(text).not.toBe('—');
  });

  test('company name is shown', async ({ page }) => {
    await launchDemo(page);
    const name = await page.locator('#company-name').innerText();
    expect(name.length).toBeGreaterThan(0);
  });

  test('health score card is visible', async ({ page }) => {
    await launchDemo(page);
    await expect(page.locator('.health-card')).toBeVisible();
  });

  test('health score number is between 0 and 100', async ({ page }) => {
    await launchDemo(page);
    const scoreText = await page.locator('.health-num').first().innerText();
    const score = parseInt(scoreText, 10);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  test('health score label is visible', async ({ page }) => {
    await launchDemo(page);
    await expect(page.locator('.health-label')).toBeVisible();
  });

  test('metrics grid shows cards', async ({ page }) => {
    await launchDemo(page);
    const cards = page.locator('.metric-card');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('coverage table shows rows', async ({ page }) => {
    await launchDemo(page);
    const rows = page.locator('.crow');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test('covered items have green badge', async ({ page }) => {
    await launchDemo(page);
    const greenBadges = page.locator('.cy');
    const count = await greenBadges.count();
    expect(count).toBeGreaterThan(0);
  });

  test('insights section shows at least one card', async ({ page }) => {
    await launchDemo(page);
    const insights = page.locator('.insight-card');
    const count = await insights.count();
    expect(count).toBeGreaterThan(0);
  });

  test('family policy shows people grid with 2 cards', async ({ page }) => {
    await launchDemo(page);
    // First doc is health insurance with 2 people
    const peopleGrid = page.locator('#people-grid');
    await expect(peopleGrid).toBeVisible();
    const cards = peopleGrid.locator('.person-card');
    await expect(cards).toHaveCount(2);
  });

  test('people cards show names', async ({ page }) => {
    await launchDemo(page);
    const cards = page.locator('.person-card-name');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < count; i++) {
      const name = await cards.nth(i).innerText();
      expect(name.length).toBeGreaterThan(0);
    }
  });

  test('PDF switcher has 3 document buttons', async ({ page }) => {
    await launchDemo(page);
    const btns = page.locator('.pdf-btn');
    await expect(btns).toHaveCount(3);
  });

  test('switching to pay stub changes doc type', async ({ page }) => {
    await launchDemo(page);
    const firstType = await page.locator('#type-badge').innerText();
    await page.locator('.pdf-btn').nth(1).click();
    const secondType = await page.locator('#type-badge').innerText();
    expect(firstType).not.toBe(secondType);
  });

  test('switching to life insurance shows no people grid', async ({ page }) => {
    await launchDemo(page);
    await page.locator('.pdf-btn').nth(2).click(); // life insurance — single person
    const display = await page.locator('#people-grid').evaluate(el => el.style.display);
    expect(display).toBe('none');
  });

  test('missing items box shown when there are no-coverage items', async ({ page }) => {
    await launchDemo(page);
    await expect(page.locator('.missing-box')).toBeVisible();
  });

  test('chat FAB is visible on dashboard', async ({ page }) => {
    await launchDemo(page);
    await expect(page.locator('#chat-fab')).toBeVisible();
  });

  test('chat panel opens when FAB clicked', async ({ page }) => {
    await launchDemo(page);
    await page.click('#chat-fab');
    await expect(page.locator('#chat-panel')).toHaveClass(/on/);
  });

  test('chat panel closes when × clicked', async ({ page }) => {
    await launchDemo(page);
    await page.click('#chat-fab');
    await expect(page.locator('#chat-panel')).toHaveClass(/on/);
    await page.locator('.chat-close').click();
    await expect(page.locator('#chat-panel')).not.toHaveClass(/on/);
  });

  test('chat accepts a message and shows response', async ({ page }) => {
    await launchDemo(page);
    await page.click('#chat-fab');
    await page.fill('#chat-input', 'כמה עולה הפרמיה?');
    await page.keyboard.press('Enter');
    // Wait for response (demo chat responds after 600ms)
    await expect(page.locator('.chat-msg.ai').nth(1)).toBeVisible({ timeout: 3000 });
  });

  test('back button returns to welcome screen', async ({ page }) => {
    await launchDemo(page);
    await page.click('#reset-btn');
    await expect(page.locator('#s-welcome')).toHaveClass(/active/);
  });
});

test.describe('Dashboard in English', () => {
  test('all dashboard labels switch to English', async ({ page }) => {
    await page.goto('/cashpilot_demo.html');
    await page.click('#en-btn');
    await page.click('#w-btn');
    await expect(page.locator('#s-dash')).toHaveClass(/active/, { timeout: 10000 });

    const bannerTitle = await page.locator('#demo-banner-title').innerText();
    expect(bannerTitle).toMatch(/demo/i);

    const disc = await page.locator('#dash-disc').innerText();
    expect(disc).toMatch(/sample|advice/i);
  });
});

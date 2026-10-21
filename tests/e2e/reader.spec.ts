import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('real data renders without overflow at desktop, tablet and mobile sizes', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  for (const width of [1440, 1024, 768, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    await expect(page.locator('.article-row').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `artifacts/home-${width}.png` });
  }
  expect(errors).toEqual([]);
});

test('search, publisher filtering and saved articles work across reloads', async ({ page }) => {
  await page.goto('/?source=netflix');
  const row = page.locator('.article-row').first();
  const title = await row.locator('h2').innerText();
  const link = await row.locator('h2 a').getAttribute('href');
  const button = row.locator('[data-bookmark]');
  const originallySaved = await button.getAttribute('aria-pressed') === 'true';
  try {
    if (!originallySaved) { await button.click(); await expect(button).toHaveAttribute('aria-pressed', 'true'); }
    await page.goto('/?view=saved');
    await expect(page.getByRole('link', { name: title, exact: true })).toBeVisible();
    await page.reload();
    await expect(page.locator(`h2 a[href="${link}"]`)).toBeVisible();
    await page.goto('/');
    await page.getByLabel('Tìm bài viết', { exact: true }).fill(title.match(/[A-Za-z]{5,}/)![0]);
    await page.getByLabel('Lọc theo nguồn').selectOption('netflix');
    await page.getByRole('button', { name: 'Tìm kiếm', exact: true }).click();
    await expect(page).toHaveURL(/source=netflix/);
    expect(await page.locator('.article-row').count()).toBeGreaterThan(0);
    for (const publisher of await page.locator('.article-row .publisher').allTextContents()) expect(publisher).toContain('Netflix');
  } finally {
    if (!originallySaved) {
      await page.goto('/?view=saved');
      const savedRow = page.locator('.article-row').filter({ has: page.locator(`h2 a[href="${link}"]`) });
      await savedRow.locator('[data-bookmark]').click();
      await expect(savedRow.locator('[data-bookmark]')).toHaveAttribute('aria-pressed', 'false');
    }
  }
});

test('article reading, original attribution and read state persist', async ({ page, request }) => {
  const result = await (await request.get('/api/articles?source=netflix')).json();
  const article = result.articles[0];
  expect(article).toBeTruthy();
  try {
    await page.goto(`/bai-viet/${article.id}`);
    await expect(page.locator('.prose')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Bài gốc', exact: true })).toHaveAttribute('href', article.url);
    await expect(page.locator('[data-read]')).toHaveAttribute('aria-pressed', 'true');
    await page.reload();
    await expect(page.locator('[data-read]')).toHaveAttribute('aria-pressed', 'true');
    await page.screenshot({ path: 'artifacts/reader-1440.png' });
    await page.setViewportSize({ width: 320, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: 'artifacts/reader-320.png' });
    const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).exclude('.prose').analyze();
    expect(audit.violations.map((violation) => ({ id: violation.id, nodes: violation.nodes.map((node) => node.target) }))).toEqual([]);
  } finally {
    await request.post(`/api/articles/${article.id}/state`, { headers: { origin: new URL(page.url()).origin }, data: { state: 'read', value: article.isRead } });
  }
});

test('source health and mobile navigation remain accessible', async ({ page }) => {
  await page.goto('/nguon');
  await expect(page.locator('.source-entry')).toHaveCount(20);
  await expect(page.locator('.source-info').filter({ hasText: 'DoorDash' })).toContainText('HTTP 403');
  await page.setViewportSize({ width: 320, height: 900 });
  await page.getByRole('button', { name: 'Mở menu', exact: true }).click();
  await expect(page.locator('#navigation')).not.toHaveAttribute('inert', '');
  await page.getByRole('button', { name: 'Đóng menu', exact: true }).first().click();
  await expect(page.locator('#navigation')).toHaveAttribute('inert', '');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(audit.violations.map((violation) => ({ id: violation.id, nodes: violation.nodes.map((node) => node.target) }))).toEqual([]);
});

test('home accessibility and mutation validation', async ({ page, request }) => {
  await page.goto('/');
  const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(audit.violations.map((violation) => ({ id: violation.id, nodes: violation.nodes.map((node) => node.target) }))).toEqual([]);
  const result = await (await request.get('/api/articles')).json();
  const endpoint = `/api/articles/${result.articles[0].id}/state`;
  expect((await request.post(endpoint, { headers: { origin: 'https://example.invalid' }, data: { state: 'saved', value: true } })).status()).toBe(403);
  expect((await request.post(endpoint, { headers: { origin: 'https://example.invalid', 'x-forwarded-host': 'example.invalid', 'x-forwarded-proto': 'https' }, data: { state: 'saved', value: true } })).status()).toBe(403);
  expect((await request.post(endpoint, { headers: { origin: new URL(page.url()).origin }, data: { state: 'saved', value: 'true' } })).status()).toBe(422);
  expect((await request.get('/bai-viet/not-a-uuid')).status()).toBe(404);
});

test('manual refresh runs once, reports completion and keeps the library', async ({ page, request }) => {
  test.setTimeout(180000);
  await page.goto('/');
  const before = await (await request.get('/api/status')).json();
  if (before.run?.finishedAt) {
    const remaining = 60000 - (Date.now() - new Date(before.run.finishedAt).getTime());
    if (remaining > 0) await page.waitForTimeout(remaining + 50);
  }
  const response = page.waitForResponse((response) => response.url().endsWith('/api/refresh') && response.request().method() === 'POST');
  await page.locator('[data-refresh]').click();
  expect((await response).status()).toBe(202);
  const duplicate = await request.post('/api/refresh', { headers: { origin: new URL(page.url()).origin } });
  expect(duplicate.status()).toBe(409);
  await expect(page.locator('[data-refresh]')).toBeEnabled({ timeout: 90000 });
  const after = await (await request.get('/api/status')).json();
  expect(after.run.status).toBe('completed');
  expect(after.stats.total).toBeGreaterThanOrEqual(before.stats.total);
  expect(after.run.failedSources).toBeLessThan(20);
  const cooldown = await request.post('/api/refresh', { headers: { origin: new URL(page.url()).origin } });
  expect(cooldown.status()).toBe(429);
});

test('menu releases page on resize and notifications respect reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Mở menu', exact: true }).click();
  await expect(page.locator('.workspace')).toHaveAttribute('inert', '');
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-menu-toggle]')).toBeFocused();
  await page.getByRole('button', { name: 'Mở menu', exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.locator('body')).not.toHaveClass(/nav-open/);
  await expect(page.locator('.workspace')).not.toHaveAttribute('inert', '');
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.locator('#navigation')).toHaveAttribute('inert', '');

  // Isolate presentation behavior without modifying the user's saved articles.
  await page.route('**/api/articles/*/state', (route) => route.fulfill({ json: { ok: true } }));
  const button = page.locator('[data-bookmark]').first();
  const original = await button.getAttribute('aria-pressed');
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', original === 'true' ? 'false' : 'true');
  await expect(page.locator('#toast')).toHaveClass(/is-open/);
  expect(await page.locator('#toast').evaluate((el) => getComputedStyle(el).transitionDuration)).toBe('0s');
  await page.waitForTimeout(3000);
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', original!);
  await page.waitForTimeout(2000);
  await expect(page.locator('#toast')).toHaveClass(/is-open/);
  await expect(page.locator('#toast')).not.toHaveClass(/is-open/, { timeout: 4000 });
});

test('recommendations show distinct unread sources and stay out of filtered results', async ({ page, request }) => {
  await page.goto('/');
  const section = page.getByRole('region', { name: 'Gợi ý cho bạn.' });
  await expect(section).toBeVisible();
  const cards = section.locator('.recommendation-card');
  const count = await cards.count();
  expect(count).toBeGreaterThan(0);
  expect(count).toBeLessThanOrEqual(3);
  const publishers = await cards.locator('.publisher').allTextContents();
  expect(new Set(publishers).size).toBe(count);
  const href = await cards.first().locator('h3 a').getAttribute('href');
  const id = href!.split('/').at(-1);
  try {
    await cards.first().locator('h3 a').click();
    await expect(page.locator('.reader-header')).toHaveAttribute('data-is-read', 'false');
    await expect(page.locator('[data-read]')).toHaveAttribute('aria-pressed', 'true');
    await page.goto('/');
    await expect(page.locator(`.recommendations a[href="${href}"]`)).toHaveCount(0);
    await page.goto('/?source=netflix');
    await expect(page.locator('.recommendations')).toHaveCount(0);
  } finally {
    await request.post(`/api/articles/${id}/state`, { headers: { origin: new URL(page.url()).origin }, data: { state: 'read', value: false } });
  }
});

test('native app APIs provide catalog, recommendations and sanitized reader content', async ({ request }) => {
  const catalog = await request.get('/api/sources');
  expect(catalog.status()).toBe(200);
  expect((await catalog.json()).sources).toHaveLength(20);
  const picks = await request.get('/api/recommendations');
  expect(picks.status()).toBe(200);
  const articles = (await (await request.get('/api/articles')).json()).articles;
  const response = await request.get(`/api/articles/${articles[0].id}`);
  expect(response.status()).toBe(200);
  const { article } = await response.json();
  expect(article.id).toBe(articles[0].id);
  expect(article.contentHtml ?? '').not.toMatch(/<script|<iframe|\sonclick=/i);
  expect((await request.get('/api/articles/not-a-uuid')).status()).toBe(404);
  expect((await request.get('/api/articles/00000000-0000-4000-8000-000000000000')).status()).toBe(404);
});

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('production reader supports recommendations, saving, search and reading', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.recommendation-card')).toHaveCount(3);
  const title = 'Testing distributed systems with small experiments';
  await page.getByLabel('Tìm bài viết', { exact: true }).fill('small experiments');
  await page.getByRole('button', { name: 'Tìm kiếm', exact: true }).click();
  await expect(page.locator('.article-row')).toHaveCount(1);
  await page.locator('[data-bookmark]').click();
  await expect(page.locator('[data-bookmark]')).toHaveAttribute('aria-pressed', 'true');
  await page.goto('/?view=saved');
  await page.getByRole('link', { name: title, exact: true }).click();
  await expect(page.locator('.prose')).toContainText('Read, learn, repeat');
  await expect(page.locator('[data-read]')).toHaveAttribute('aria-pressed', 'true');
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
});

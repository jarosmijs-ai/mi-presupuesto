import { test, expect } from '@playwright/test';

async function prepare(page, { withRecords = true } = {}) {
  await page.goto('/');
  await page.evaluate((includeRecords) => {
    localStorage.clear();
    localStorage.setItem('premium-onboarding-complete', 'true');
    localStorage.setItem('ux-selected-month', '2026-10');
    localStorage.setItem('god-section', 'home');

    if (includeRecords) {
      localStorage.setItem('monthly-incomes', JSON.stringify([
        { id: 'trend-i-1', amount: 2500, date: '2026-08-14', type: 'Quincena' },
        { id: 'trend-i-2', amount: 3400, date: '2026-09-10', type: 'Quincena' },
        { id: 'trend-i-3', amount: 1100, date: '2026-10-10', type: 'Quincena' },
        { id: 'trend-i-old', amount: 9999, date: '2025-10-10', type: 'Quincena' }
      ]));
      localStorage.setItem('expenses', JSON.stringify([
        { id: 'trend-e-1', amount: 500, date: '2026-08-04', category: 'Otros' },
        { id: 'trend-e-2', amount: 2300, date: '2026-09-16', category: 'Otros' },
        { id: 'trend-e-3', amount: 825, date: '2026-10-17', category: 'Otros' }
      ]));
    }
  }, withRecords);
  await page.reload();
  await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toBeVisible();
}

test('Finance branding appears in title, header and install manifest', async ({ page }) => {
  await prepare(page);
  await expect(page).toHaveTitle(/Finance/);
  await expect(page.locator('.g-brand strong')).toHaveText('Finance');
  const manifest = await page.request.get('/manifest.webmanifest');
  expect(manifest.ok()).toBeTruthy();
  const json = await manifest.json();
  expect(json.name).toBe('Finance');
  expect(json.start_url).toBe('/');
});

test('fluid trend reflects actual ledgers, changes month and preserves stored data', async ({ page }) => {
  await prepare(page);
  const trend = page.getByRole('region', { name: 'Tendencia histórica de ingresos y gastos' });
  await expect(trend).toBeVisible();
  await expect(trend.locator('.y-trend-line')).toHaveCount(2);
  expect(await trend.locator('.y-trend-line').first().getAttribute('d')).toMatch(/^M.*C/);
  await expect(trend.getByRole('button')).toHaveCount(6);
  await expect(trend.locator('.y-trend-selected')).toContainText('octubre');
  await expect(trend.locator('.y-trend-metric.is-income')).toContainText('1,100');
  await expect(trend.locator('.y-trend-metric.is-expense')).toContainText('825');

  const savedBefore = await page.evaluate(() => [localStorage.getItem('monthly-incomes'), localStorage.getItem('expenses')]);
  await trend.getByRole('button', { name: /septiembre de 2026/ }).click();
  await expect(trend.locator('.y-trend-selected')).toContainText('septiembre');
  await expect(trend.locator('.y-trend-metric.is-income')).toContainText('3,400');
  await expect(trend.locator('.y-trend-metric.is-expense')).toContainText('2,300');
  const savedAfter = await page.evaluate(() => [localStorage.getItem('monthly-incomes'), localStorage.getItem('expenses')]);
  expect(savedAfter).toEqual(savedBefore);
});

test('privacy mode conceals trends and reopening restores existing amounts', async ({ page }) => {
  await prepare(page);
  const trend = page.getByRole('region', { name: 'Tendencia histórica de ingresos y gastos' });
  await page.getByRole('button', { name: 'Ocultar montos' }).click();
  await expect(trend.getByText(/Histórico oculto/)).toBeVisible();
  await expect(trend.locator('svg')).toHaveCount(0);
  await page.getByRole('button', { name: 'Mostrar montos' }).click();
  await expect(trend.locator('.y-trend-metric.is-income')).toContainText('1,100');
});

test('empty data shows honest no-data state rather than fictitious trend', async ({ page }) => {
  await prepare(page, { withRecords: false });
  const trend = page.getByRole('region', { name: 'Tendencia histórica de ingresos y gastos' });
  await expect(trend.getByText(/No usamos datos de ejemplo/)).toBeVisible();
  await expect(trend.locator('.y-trend-line')).toHaveCount(0);
});

test('changing active month shifts six-month history without changing underlying records', async ({ page }) => {
  await prepare(page);
  const trend = page.getByRole('region', { name: 'Tendencia histórica de ingresos y gastos' });
  await page.getByRole('button', { name: 'Mes anterior' }).click();
  await expect(trend.locator('.y-trend-selected')).toContainText('septiembre');
  await expect(trend.locator('.y-trend-metric.is-income')).toContainText('3,400');
});

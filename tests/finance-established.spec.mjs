import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function seed(page, records = true) {
  await page.goto('/');
  await page.evaluate((withData) => {
    localStorage.clear();
    localStorage.setItem('premium-onboarding-complete', 'true');
    localStorage.setItem('ux-selected-month', '2026-10');
    localStorage.setItem('god-section', 'moves');
    if (withData) {
      localStorage.setItem('monthly-incomes', JSON.stringify([
        { id: 'journal-i', date: '2026-10-10', amount: 4200, type: 'Ingreso' }
      ]));
      localStorage.setItem('expenses', JSON.stringify([
        { id: 'journal-a', date: '2026-10-03', amount: 120, category: 'Comidas', note: 'Almuerzo' },
        { id: 'journal-b', date: '2026-10-09', amount: 250, category: 'Internet', note: 'Plan' },
        { id: 'journal-c', date: '2026-10-18', amount: 825, category: 'Comidas', note: 'Compras' },
        { id: 'journal-d', date: '2026-10-31', amount: 200, category: 'Transporte', note: 'Viajes' }
      ]));
    }
  }, records);
  await page.reload();
  await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toBeVisible();
}

test('monthly expense rhythm reports real spend in five date bands', async ({ page }) => {
  await seed(page);
  const rhythm = page.getByRole('region', { name: 'Comparación de gastos dentro del mes' });
  await expect(rhythm).toBeVisible();
  await expect(rhythm.getByRole('button')).toHaveCount(5);
  await rhythm.getByRole('button', { name: /Días 15–21/ }).click();
  await expect(rhythm.getByText('DÍAS 15–21')).toBeVisible();
  await expect(rhythm.locator('.y-rhythm-summary')).toContainText('825');
  await expect(rhythm.locator('.y-rhythm-summary')).toContainText('59%');
  await rhythm.getByRole('button', { name: /Días 29–31/ }).click();
  await expect(rhythm.locator('.y-rhythm-summary')).toContainText('200');

  const snapshot = await page.evaluate(() => localStorage.getItem('expenses'));
  await page.getByRole('button', { name: 'Mes anterior' }).click();
  await expect(rhythm.getByText(/No hay gastos registrados/)).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('expenses'))).toEqual(snapshot);
  expect(await page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth + 1));
});

test('privacy and honest empty states also apply to intramonth expenses', async ({ page }) => {
  await seed(page, false);
  const rhythm = page.getByRole('region', { name: 'Comparación de gastos dentro del mes' });
  await expect(rhythm.getByText(/No hay gastos registrados/)).toBeVisible();
  await page.getByRole('button', { name: 'Ocultar montos' }).click();
  await expect(rhythm.getByText(/Comparativa oculta/)).toBeVisible();
  await expect(rhythm.getByRole('button')).toHaveCount(0);
});

test('Established PDF is produced on demand and opens as real multi-page document', async ({ page }) => {
  await seed(page);
  await page.getByRole('navigation', { name: 'Navegación principal' })
    .getByRole('button', { name: 'Más' }).click();
  await page.getByRole('button', { name: /Ajustes y reportes/ }).click();
  const downloaded = page.waitForEvent('download', { timeout: 30000 });
  await page.getByRole('button', { name: 'Descargar PDF' }).click();
  const pdf = await downloaded;
  expect(pdf.suggestedFilename()).toBe('finance-established-2026-10.pdf');
  const content = await readFile(await pdf.path());
  expect(content.subarray(0, 5).toString()).toBe('%PDF-');
  expect(content.length).toBeGreaterThan(10000);
  const pageObjects = content.toString('latin1').match(/\/Type\s*\/Page\b/g) || [];
  expect(pageObjects.length).toBeGreaterThanOrEqual(2);
});

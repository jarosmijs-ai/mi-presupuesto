import { test, expect } from '@playwright/test';

async function visitCleanYoru(page) {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('premium-onboarding-complete', 'true');
    localStorage.setItem('ux-selected-month', '2026-10');
    localStorage.setItem('god-section', 'home');
  });
  await page.reload();
  await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toBeVisible();
}

test('motion cues track route changes without delaying financial text or affecting layout', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await visitCleanYoru(page);
  const nav = page.getByRole('navigation', { name: 'Navegación principal' });

  await expect(page.locator('.y-route-cue')).toHaveAttribute('data-route', 'home');
  await expect(page.locator('.y-balance-block h1')).toBeVisible();
  const styles = await page.locator('.y-balance-block h1').evaluate((el) => ({
    opacity: getComputedStyle(el).opacity,
    visibility: getComputedStyle(el).visibility
  }));
  expect(styles).toEqual({ opacity: '1', visibility: 'visible' });

  for (const [label, route] of [
    ['Movimientos', 'moves'],
    ['Presupuesto', 'budget'],
    ['Préstamo', 'loan'],
    ['Más', 'more'],
    ['Inicio', 'home']
  ]) {
    await nav.getByRole('button', { name: label }).click();
    await expect(page.locator('.y-route-cue')).toHaveAttribute('data-route', route);
    await expect(nav.getByRole('button', { name: label })).toHaveAttribute('aria-current', 'page');
    const width = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth,
      viewport: window.innerWidth
    }));
    expect(width.page, `Horizontal overflow on ${route}`).toBeLessThanOrEqual(width.viewport + 1);
  }

  const activeMotion = await page.locator('.g-bottom-nav button.is-active > span').evaluate(
    (element) => getComputedStyle(element).animationName
  );
  expect(activeMotion).toContain('y-nav-settle');
});

test('reduced motion removes ceremonies but leaves all routes and amounts readable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await visitCleanYoru(page);
  await expect(page.locator('.y-route-cue')).toBeHidden();
  await expect(page.locator('.y-balance-block h1')).toBeVisible();

  const headingAnimation = await page.locator('.y-edition').evaluate((el) =>
    getComputedStyle(el).animationName
  );
  expect(headingAnimation).toBe('none');

  const nav = page.getByRole('navigation', { name: 'Navegación principal' });
  await nav.getByRole('button', { name: 'Presupuesto' }).click();
  await expect(page.locator('.y-route-cue')).toHaveAttribute('data-route', 'budget');
  await expect(page.locator('.y-route-cue')).toBeHidden();
  await expect(nav.getByRole('button', { name: 'Presupuesto' })).toHaveAttribute('aria-current', 'page');
});

test('movement sheet stays interactable during entrance animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await visitCleanYoru(page);
  await page.getByRole('button', { name: /Registrar gasto/i }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: /Guardar gasto/i })).toBeEnabled();
  const hasTransform = await dialog.evaluate((element) => {
    const { pointerEvents, visibility } = getComputedStyle(element);
    return pointerEvents !== 'none' && visibility === 'visible';
  });
  expect(hasTransform).toBe(true);
});

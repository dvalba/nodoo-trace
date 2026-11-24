import { test, expect } from '@playwright/test';

const seedEmail = 'distribuidora@seed.nodoo.local';
const seedPassword = 'Seed1234';

test('US16: login de una organización seed llega al dashboard sin errores de consola', async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => {
    consoleErrors.push(error.message);
  });

  await page.goto('/login');
  await page.locator('#email').fill(seedEmail);
  await page.locator('#password').fill(seedPassword);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();

  await expect(page.getByRole('heading', { name: 'Inicio', level: 1 })).toBeVisible();

  expect(consoleErrors).toEqual([]);
});

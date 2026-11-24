import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

// Capturas «antes»/«después» de la revisión visual (S2-3, US19, FR-1509/FR-1510).
// Queda fuera de la corrida por defecto de `pnpm test:e2e:web`: solo se ejecuta
// con VISUAL_CAPTURES=antes|despues, que también fija el subdirectorio de salida.
const rawMode = process.env.VISUAL_CAPTURES;
const mode: 'antes' | 'despues' | null =
  rawMode === 'antes' || rawMode === 'despues' ? rawMode : null;

const seedEmail = 'distribuidora@seed.nodoo.local';
const seedPassword = 'Seed1234';

const viewports = [
  { name: '1440', size: { width: 1440, height: 900 } },
  { name: '390', size: { width: 390, height: 844 } },
];

interface Screen {
  key: string;
  path: string;
  auth: boolean;
  heading?: string;
}

const screens: Screen[] = [
  { key: 'login', path: '/login', auth: false },
  { key: 'dashboard', path: '/', auth: true, heading: 'Inicio' },
  { key: 'productos', path: '/products', auth: true, heading: 'Productos y casos' },
  { key: 'trace', path: '/trace', auth: true, heading: 'Trazabilidad' },
  { key: 'equipo', path: '/team', auth: true, heading: 'Equipo' },
  { key: 'organizacion', path: '/organization', auth: true, heading: 'Organización' },
];

async function login(page: Page): Promise<void> {
  await page.goto('/login');
  await page.locator('#email').fill(seedEmail);
  await page.locator('#password').fill(seedPassword);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByRole('heading', { name: 'Inicio', level: 1 })).toBeVisible();
}

for (const screen of screens) {
  test(`captura ${screen.key}`, async ({ page }) => {
    test.skip(mode === null, 'VISUAL_CAPTURES no seteado (antes|despues)');
    const outDir = path.resolve(process.cwd(), '../e2e-evidence/sprint-02/visual', mode);
    mkdirSync(outDir, { recursive: true });

    if (screen.auth) {
      await login(page);
      await page.goto(screen.path);
    } else {
      await page.goto(screen.path);
    }

    if (screen.heading) {
      await expect(page.getByRole('heading', { name: screen.heading, level: 1 })).toBeVisible();
    } else {
      await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible();
    }

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    for (const viewport of viewports) {
      await page.setViewportSize(viewport.size);
      await page.waitForTimeout(400);
      await page.screenshot({
        path: path.join(outDir, `${screen.key}-${viewport.name}.png`),
        fullPage: true,
      });
    }
  });
}

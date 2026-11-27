import { expect, test } from '@playwright/test';
import {
  commissionVaccineCases,
  I2,
  login,
  openTrace,
  optionLabel,
  SEED,
  shortOf,
  twinCard,
  V2,
  V2_CONTENT,
  V3,
  VACCINE_PRODUCT,
} from './helpers';

/**
 * US8 — Inspección y agregación (spec 001, US8 y FR-803: la agregación no
 * crea descendencias dobles ni ciclos).
 *
 * El round-trip pack/unpack (tests 2-3) usa los casos V2/V3 del seed y queda
 * neto (el vínculo se quita). El test 4 comisiona tres casos frescos para la
 * cadena anidada A ⊃ B ⊃ C. Las validaciones del servidor (400 por
 * descendencia doble, ciclo o hijo propio) no son alcanzables desde la UI —
 * los candidatos de empaque se filtran en el cliente por producto y por no
 * tener padre —; están cubiertas por la suite e2e del backend.
 *
 * El orden de los tests importa: comparten el estado de la BD sembrada.
 */

test('US8: el custodio inspecciona casos: no conforme → Dañado, conforme → Activo', async ({
  page,
}) => {
  await login(page, SEED.distributor.email);
  await openTrace(page, I2);
  const twin = twinCard(page);
  await expect(twin.getByText('Activo', { exact: true })).toBeVisible();

  await page.getByLabel('No conforme', { exact: true }).check();
  await page.getByRole('button', { name: 'Registrar inspección' }).click();
  await expect(
    page.getByText('Inspección registrada como no conforme.').first(),
  ).toBeVisible();

  await expect(twin.getByText('Dañado', { exact: true })).toBeVisible();

  // Inspección conforme: el caso permanece activo.
  await openTrace(page, V3);
  const other = twinCard(page);
  await expect(other.getByText('Activo', { exact: true })).toBeVisible();

  await page.getByLabel('Conforme', { exact: true }).check();
  await page.getByRole('button', { name: 'Registrar inspección' }).click();
  await expect(
    page.getByText('Inspección registrada como conforme.').first(),
  ).toBeVisible();

  await expect(other.getByText('Activo', { exact: true })).toBeVisible();
});

test('US8: empaquetar contenido bajo un contenedor liga los gemelos sin mezclarlos (FR-803)', async ({
  page,
}) => {
  await login(page, SEED.distributor.email);
  await openTrace(page, V2);
  await expect(twinCard(page)).toBeVisible();

  // V3 es candidato: mismo producto, sin padre, distinto del contenedor.
  // La selección es por etiqueta (no por value): en Angular 21 el value
  // del option de un select multiple no es fiable en el DOM.
  await page
    .locator('#packSel')
    .selectOption({ label: optionLabel(V3, VACCINE_PRODUCT) });
  await page.getByRole('button', { name: 'Empacar' }).click();
  await expect(page.getByText('Casos empaquetados.').first()).toBeVisible();

  // El gemelo del hijo muestra su contenedor; los gemelos siguen separados.
  await openTrace(page, V3);
  const child = twinCard(page);
  await expect(child.getByText('Activo', { exact: true })).toBeVisible();
  await expect(child.getByText('Contenedor', { exact: true })).toBeVisible();
  await expect(child.getByText(shortOf(V2)).first()).toBeVisible();
});

test('US8: desempaquetar quita el vínculo padre-hijo', async ({ page }) => {
  await login(page, SEED.distributor.email);
  await openTrace(page, V2);

  // V2 tiene también sus 2 contenidos del seed (FR-D7): se desempaquetan
  // todos los hijos para dejar el contenedor sin descendientes.
  await page
    .locator('#unpackSel')
    .selectOption([
      optionLabel(V3, VACCINE_PRODUCT),
      optionLabel(V2_CONTENT[0], VACCINE_PRODUCT),
      optionLabel(V2_CONTENT[1], VACCINE_PRODUCT),
    ]);
  await page.getByRole('button', { name: 'Desempaquetar' }).click();
  await expect(page.getByText('Casos desempaquetados.').first()).toBeVisible();

  // Sin hijos, la acción de desempaquetar desaparece.
  await expect(page.locator('#unpackSel')).not.toBeVisible();

  await openTrace(page, V3);
  await expect(
    twinCard(page).getByText('Contenedor', { exact: true }),
  ).not.toBeVisible();
});

test('US8: la agregación anidada mantiene la cadena padre-hijo consistente (FR-803)', async ({
  page,
}) => {
  await login(page, SEED.manufacturer.email);
  const [a, b, c] = await commissionVaccineCases(page, 3);

  // Cadena válida: A ⊃ B ⊃ C. La selección es por etiqueta (ver test 2):
  // en B los candidatos son A y C, y solo la etiqueta desambigua.
  await openTrace(page, a);
  await page
    .locator('#packSel')
    .selectOption({ label: optionLabel(b, VACCINE_PRODUCT) });
  await page.getByRole('button', { name: 'Empacar' }).click();
  await expect(page.getByText('Casos empaquetados.').first()).toBeVisible();

  await openTrace(page, b);
  await page
    .locator('#packSel')
    .selectOption({ label: optionLabel(c, VACCINE_PRODUCT) });
  await page.getByRole('button', { name: 'Empacar' }).click();
  await expect(page.getByText('Casos empaquetados.').first()).toBeVisible();

  // Cada hijo muestra a su contenedor directo, sin cruces en la cadena.
  await openTrace(page, c);
  await expect(
    twinCard(page).getByText(shortOf(b), { exact: true }),
  ).toBeVisible();

  await openTrace(page, b);
  await expect(
    twinCard(page).getByText(shortOf(a), { exact: true }),
  ).toBeVisible();
});

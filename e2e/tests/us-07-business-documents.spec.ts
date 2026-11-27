import { expect, test } from '@playwright/test';
import {
  V2,
  V2_CONTENT,
  V3,
  V3_CONTENT,
  caseRow,
  commissionVaccineCases,
  expectNotFound,
  login,
  openTrace,
  SEED,
  shortOf,
  twinCard,
  urnFromTwinCard,
  VACCINE_PRODUCT,
} from './helpers';

/**
 * US7 — Documentos transaccionales: PO, despatch advice, BOL
 * (spec 001, US7 y FR-701: rol emisor de cada documento).
 *
 * El setup (test 1) comisiona un caso fresco al fabricante y lo deja en
 * custodia de la distribuidora: así la distribuidora es custodio no
 * propietario (puede emitir PO y despatch advice) y el fabricante es
 * propietario (no puede emitir PO, sí factura). Ninguna organización del
 * seed tiene la activity de transportista, por lo que la guía de remisión
 * (BOL) no debe aparecer en la UI; su rol emisor a nivel de API ya está
 * cubierto por la suite e2e del backend.
 *
 * El orden de los tests importa: comparten el estado de la BD sembrada.
 * Cada test es autocontenido respecto a los URN: el caso fresco se
 * distingue en la lista de «Mis casos» por producto y estado, excluyendo
 * los EPC abreviados del seed, y el URN completo se lee de la tarjeta del
 * gemelo de un actor con scope.
 */

const PO_NUMBER = 'PO-E2E-2026-001';
const DESADV_NUMBER = 'ADV-E2E-2026-001';

test('US7: el fabricante comisiona y embarca un caso al distribuidor, que lo recibe', async ({
  page,
}) => {
  await login(page, SEED.manufacturer.email);
  await commissionVaccineCases(page, 1);

  await page
    .locator('#shipDest')
    .selectOption({ label: SEED.distributor.name });
  await page.getByRole('button', { name: 'Enviar caso' }).click();
  await expect(page.getByText('Caso enviado.').first()).toBeVisible();

  // Tras la acción el gemelo se recarga con el nuevo estado; el fabricante
  // sigue siendo owner, así que de su tarjeta se lee el URN completo.
  const urn = await urnFromTwinCard(page);

  await login(page, SEED.distributor.email);
  await page.goto('/trace');

  // El caso aparece en «Mis casos» como shipment a su favor (FR-D5)…
  const row = caseRow(page, {
    product: VACCINE_PRODUCT,
    status: 'En tránsito',
  });
  await expect(row).toHaveCount(1);
  // …pero el gemelo no se divulga antes de recibir: la consulta da 404.
  await openTrace(page, urn);
  await expectNotFound(page, urn);

  // La recepción se hace desde su tarjeta, leyendo la etiqueta física.
  await page.locator('#receiveEpc').fill(urn);
  await page.getByRole('button', { name: 'Recibir caso' }).click();
  await expect(page.getByText('Caso recibido.').first()).toBeVisible();

  await openTrace(page, urn);
  const after = twinCard(page);
  await expect(after.getByText('Activo', { exact: true })).toBeVisible();
  await expect(
    after.getByText(SEED.manufacturer.name, { exact: true }).first(),
  ).toBeVisible();
});

test('US7: el custodio no propietario emite PO y aviso de despacho; el owner no ve PO (FR-701)', async ({
  page,
}) => {
  await login(page, SEED.distributor.email);
  await page.goto('/trace');

  // Su caso fresco: la única vacuna Activa que no es V2, V3 ni los
  // contenidos del seed (ver el filtro).
  const row = caseRow(page, {
    product: VACCINE_PRODUCT,
    status: 'Activo',
    except: [
      shortOf(V2),
      shortOf(V3),
      // Contenidos del seed (FR-D7): también son vacunas activas de la
      // distribuidora y deben quedar fuera del filtro.
      ...V2_CONTENT.map(shortOf),
      ...V3_CONTENT.map(shortOf),
    ],
  });
  await expect(row).toHaveCount(1);
  await row.click();
  await expect(twinCard(page)).toBeVisible();
  const urn = await urnFromTwinCard(page);

  // PO: lo emite un no propietario con transaction:po.
  await page.locator('#poNumber').fill(PO_NUMBER);
  await page
    .getByRole('button', { name: 'Registrar orden de compra' })
    .click();
  await expect(
    page.getByText('Orden de compra registrada.').first(),
  ).toBeVisible();
  await expect(
    page.locator('span', { hasText: `Orden de compra: ${PO_NUMBER}` }),
  ).toBeVisible();

  // Despatch advice: lo emite el custodio con transaction:desadv.
  await page.locator('#desadvNumber').fill(DESADV_NUMBER);
  await page
    .getByRole('button', { name: 'Registrar aviso de despacho' })
    .click();
  await expect(
    page.getByText('Aviso de despacho registrado.').first(),
  ).toBeVisible();
  await expect(
    page.locator('span', { hasText: `Aviso de despacho: ${DESADV_NUMBER}` }),
  ).toBeVisible();

  // Su ventana de custodia: recepción + PO + despatch advice.
  await expect(
    page.getByRole('heading', { name: 'Historial · 3 evento(s)' }),
  ).toBeVisible();

  // BOL: ninguna organización seed tiene la operation transaction:bol →
  // el control no se muestra (gating por activity).
  await expect(page.locator('#bolNumber')).not.toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Registrar guía de remisión' }),
  ).not.toBeVisible();

  // Owner: no emite PO (FR-701) pero sí factura.
  await login(page, SEED.manufacturer.email);
  await openTrace(page, urn);
  await expect(twinCard(page)).toBeVisible();
  await expect(page.locator('#poNumber')).not.toBeVisible();
  await expect(page.locator('#invoiceNumber')).toBeVisible();
});

test('US7: aislamiento entre tenants: una organización ajena no ve el caso (FR-D2)', async ({
  page,
}) => {
  // El caso es ajeno al hospital y no aparece en su lista: el URN se
  // deriva desde la lista del distribuidor (owner), y se consulta con el
  // hospital.
  await login(page, SEED.distributor.email);
  await page.goto('/trace');
  const row = caseRow(page, {
    product: VACCINE_PRODUCT,
    status: 'Activo',
    except: [
      shortOf(V2),
      shortOf(V3),
      // Contenidos del seed (FR-D7): también son vacunas activas de la
      // distribuidora y deben quedar fuera del filtro.
      ...V2_CONTENT.map(shortOf),
      ...V3_CONTENT.map(shortOf),
    ],
  });
  await expect(row).toHaveCount(1);
  await row.click();
  await expect(twinCard(page)).toBeVisible();
  const urn = await urnFromTwinCard(page);

  await login(page, SEED.hospital.email);
  await openTrace(page, urn);
  await expectNotFound(page, urn);
});

import { expect, test } from '@playwright/test';
import {
  V1,
  V1_CONTENT,
  V2,
  caseRow,
  commissionVaccineCases,
  expectNotFound,
  I1,
  login,
  openTrace,
  SEED,
  shortOf,
  twinCard,
  urnFromTwinCard,
  VACCINE_PRODUCT,
} from './helpers';

/**
 * US6 — Custodia: shipment, receiving y visibilidad del ledger
 * (spec 001, US6 y FR-D2..FR-D6, FR-601..FR-606).
 *
 * El caso in-transit del seed (I1) pertenece a esta historia: el test 6 lo
 * recibe y lo consume, y el caso fresco que comisiona el fabricante (test 1)
 * sirve para el flujo de recepción por etiqueta y el scope del destinatario.
 * El orden de los tests importa: comparten el estado de la BD sembrada.
 *
 * Cada test es autocontenido respecto a los URN: las filas de la UI solo
 * muestran el EPC abreviado, así que el URN completo se deriva en el punto
 * de uso desde la tarjeta del gemelo de un actor con scope (owner o
 * custodio), nunca desde un estado de módulo que Playwright puede
 * re-ejecutar tras un fallo.
 *
 * El caso de escaneo de la etiqueta QR con cámara no se ejecuta en la suite
 * (requiere un dispositivo de cámara real en un navegador con permisos);
 * se declara explícitamente en el reporte de cierre (S3-3). La entrada
 * manual del EPC, que es la vía primaria, sí se cubre aquí.
 */

test('US6: el fabricante comisiona un caso y lo embarca al hospital', async ({
  page,
}) => {
  await login(page, SEED.manufacturer.email);

  // Estado inicial del seed: el fabricante es productor de todos los casos
  // pero ya no es propietario de ninguno → no ve casos propios.
  await page.goto('/trace');
  await expect(
    page.getByRole('heading', { name: 'Mis casos · 0' }),
  ).toBeVisible();
  await expect(page.getByText('Aún no tienes casos').first()).toBeVisible();

  await commissionVaccineCases(page, 1);

  // Commissioning: producer = owner = custodian = fabricante, estado active.
  const twin = twinCard(page);
  await expect(twin.getByText('Activo', { exact: true })).toBeVisible();
  await expect(
    twin.getByText(SEED.manufacturer.name, { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Historial · 1 evento(s)' }),
  ).toBeVisible();

  // Camino feliz: embarcar con un destinatario → el gemelo pasa a in_transit.
  await page
    .locator('#shipDest')
    .selectOption({ label: SEED.hospital.name });
  await page.getByRole('button', { name: 'Enviar caso' }).click();
  await expect(page.getByText('Caso enviado.').first()).toBeVisible();

  await expect(twin.getByText('En tránsito', { exact: true })).toBeVisible();
  await expect(twin.getByText('Destino', { exact: true })).toBeVisible();
});

test('US6: el destinatario no propietario ve el shipment en su scope y recibe por etiqueta (FR-D5)', async ({
  page,
}) => {
  // El fabricante es el propietario del caso fresco; su lista tiene un
  // único caso, así que desde su gemelo se lee el URN completo.
  await login(page, SEED.manufacturer.email);
  await page.goto('/trace');
  await expect(
    page.getByRole('heading', { name: 'Mis casos · 1' }),
  ).toBeVisible();
  const ownRow = page.locator('.case-row');
  await expect(ownRow).toHaveCount(1);
  await ownRow.click();
  await expect(twinCard(page)).toBeVisible();
  const urn = await urnFromTwinCard(page);

  await login(page, SEED.hospital.email);
  await page.goto('/trace');

  // El caso in-transit a su favor aparece en «Mis casos» (EPC + producto).
  // V1 (también vacuna) y sus 2 contenidos están en la lista, así que se
  // filtra por estado. Conteo: V1 + 2 contenidos + I1 + 2 contenidos + caso
  // fresco = 7.
  await expect(
    page.getByRole('heading', { name: 'Mis casos · 7' }),
  ).toBeVisible();
  const row = caseRow(page, {
    product: VACCINE_PRODUCT,
    status: 'En tránsito',
  });
  await expect(row).toHaveCount(1);

  // …pero el gemelo no se divulga antes de recibir: la consulta da 404.
  await openTrace(page, urn);
  await expectNotFound(page, urn);

  // La recepción se hace desde su propia tarjeta, leyendo la etiqueta.
  await page.locator('#receiveEpc').fill(urn);
  await page.getByRole('button', { name: 'Recibir caso' }).click();
  await expect(page.getByText('Caso recibido.').first()).toBeVisible();

  // Después de recibir, el gemelo carga con su scope de custodio.
  await openTrace(page, urn);
  const twin = twinCard(page);
  await expect(twin.getByText('Activo', { exact: true })).toBeVisible();
  await expect(
    twin.getByText(SEED.hospital.name, { exact: true }).first(),
  ).toBeVisible();
  await expect(
    twin.getByText(SEED.manufacturer.name, { exact: true }).first(),
  ).toBeVisible();
});

test('US6: recibir un caso ya recibido o ajeno falla (FR-602)', async ({
  page,
}) => {
  await login(page, SEED.hospital.email);
  await page.goto('/trace');

  // El caso recibido en el test anterior es ahora Activo del hospital;
  // entre sus vacunas, el único Activo que no es V1 ni el contenido de V1.
  const row = caseRow(page, {
    product: VACCINE_PRODUCT,
    status: 'Activo',
    except: [shortOf(V1), ...V1_CONTENT.map(shortOf)],
  });
  await expect(row).toHaveCount(1);
  await row.click();
  await expect(twinCard(page)).toBeVisible();
  const urn = await urnFromTwinCard(page);

  // El caso ya no está en tránsito → 400.
  await page.locator('#receiveEpc').fill(urn);
  await page.getByRole('button', { name: 'Recibir caso' }).click();
  await expect(
    page
      .getByText(
        'The EPC is not in transit to the caller and cannot be received.',
      )
      .first(),
  ).toBeVisible();

  // Un caso al que el hospital no tiene relación → 404, nunca 403.
  await page.locator('#receiveEpc').fill(V2);
  await page.getByRole('button', { name: 'Recibir caso' }).click();
  await expect(
    page.getByText(`Epc not found with id:${V2}.`, { exact: true }).first(),
  ).toBeVisible();
});

test('US6: el custodio ve solo su ventana de custodia; el productor ya no propietario ve nada (FR-D4/FR-D6)', async ({
  page,
}) => {
  // Custodio en tránsito: ve al owner (FR-D4), no al productor ni upstream.
  await login(page, SEED.distributor.email);
  await openTrace(page, I1);
  const twin = twinCard(page);
  await expect(twin.getByText('En tránsito', { exact: true })).toBeVisible();
  await expect(
    twin.getByText(SEED.hospital.name, { exact: true }).first(),
  ).toBeVisible();
  await expect(
    twin.getByText(SEED.distributor.name, { exact: true }).first(),
  ).toBeVisible();
  await expect(twin.getByText(SEED.manufacturer.name)).toHaveCount(0);
  // Solo su ventana de custodia: recepción + envío + factura del tramo.
  await expect(
    page.getByRole('heading', { name: 'Historial · 3 evento(s)' }),
  ).toBeVisible();

  // Productor que ya no es propietario: 404 (FR-D6).
  await login(page, SEED.manufacturer.email);
  await openTrace(page, I1);
  await expectNotFound(page, I1);
});

test('US6: desde la UI no se puede embarcar de nuevo un caso en tránsito (spec l.174)', async ({
  page,
}) => {
  await login(page, SEED.distributor.email);
  await openTrace(page, I1);
  await expect(twinCard(page)).toBeVisible();

  // La acción de envío exige un caso active: el control no se muestra.
  await expect(page.locator('#shipDest')).not.toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Enviar caso' }),
  ).not.toBeVisible();
});

test('US6: el hospital recibe I1 y completa la cadena', async ({ page }) => {
  await login(page, SEED.hospital.email);
  await openTrace(page, I1);

  // Owner: ve la cadena completa (7 eventos: los 6 del tramo + el empaque
  // del contenido que el seed agrega al caso, FR-D7) y el gemelo entero.
  const twin = twinCard(page);
  await expect(twin.getByText('En tránsito', { exact: true })).toBeVisible();
  await expect(
    twin.getByText(SEED.manufacturer.name, { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Historial · 7 evento(s)' }),
  ).toBeVisible();

  await page.locator('#receiveEpc').fill(I1);
  await page.getByRole('button', { name: 'Recibir caso' }).click();
  await expect(page.getByText('Caso recibido.').first()).toBeVisible();

  await openTrace(page, I1);
  const after = twinCard(page);
  await expect(after.getByText('Activo', { exact: true })).toBeVisible();
  await expect(
    after.getByText(SEED.hospital.name, { exact: true }).first(),
  ).toBeVisible();
});

test('US6: el scope de «Mis casos» por actor (FR-604)', async ({ page }) => {
  // Hospital: sus dos casos del seed (2 + 2 contenidos) + el caso recibido
  // en esta historia = 7.
  await login(page, SEED.hospital.email);
  await page.goto('/trace');
  await expect(
    page.getByRole('heading', { name: 'Mis casos · 7' }),
  ).toBeVisible();

  // Distribuidora: I1 (la caja) ya no está en su scope, pero los 2
  // contenidos de I1 siguen en tránsito al hospital con custodia de la
  // distribuidora (la recepción es por EPC/etiqueta: solo se recibió la
  // caja). Sus tres casos + 2 contenidos cada uno (9) + 2 contenidos de I1
  // = 11.
  await login(page, SEED.distributor.email);
  await page.goto('/trace');
  await expect(
    page.getByRole('heading', { name: 'Mis casos · 11' }),
  ).toBeVisible();

  // Fabricante: es productor de todos los casos del seed (ya no es
  // propietario de ninguno), pero SÍ es propietario del caso que comisionó
  // en esta historia: el embarque no transfiere la propiedad, solo la
  // factura lo hace → ve exactamente ese caso.
  await login(page, SEED.manufacturer.email);
  await page.goto('/trace');
  await expect(
    page.getByRole('heading', { name: 'Mis casos · 1' }),
  ).toBeVisible();
});

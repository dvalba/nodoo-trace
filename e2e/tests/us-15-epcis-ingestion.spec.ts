import { expect, test, type APIRequestContext } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expectNotFound, login, openTrace, SEED, twinCard } from './helpers';

/**
 * US15 + US17 — Ingesta de documentos EPCIS 2.0 de terceros (spec 001,
 * US15 FR-2001..FR-2005; aislamiento FR-D2).
 *
 * El documento bajo prueba es REAL y no modificado: el fixture
 * `ObjectEvent.json` (recursos de prueba de la comunidad EPCIS,
 * openepcis/openepcis-test-resources) se empuja tal cual, byte a byte, al
 * endpoint de captura. Lo único que aporta la plataforma es el
 * `epcMapping` con el owner y el producto de los EPCs no comisionados
 * (FR-2005).
 *
 * El documento tiene dos ObjectEvents (2005-04-03 shipping y 2005-04-04
 * receiving) con eventID propio (→ eventUid, FR-2002):
 *  - SGTIN_2017 aparece solo en el shipping → queda «En tránsito» (1 evento).
 *  - SGTIN_2018 aparece en ambos → queda «Activo» bajo custodia del que
 *    ingresa (2 eventos), por la proyección local de la recepción (FR-2004).
 *
 * La BD de esta suite se droppea y siembra por corrida (global setup), así
 * que el estado que crean estos tests no necesita limpieza. Cada test hace
 * su propio login de API para ser autocontenido.
 */

const fixturePath = fileURLToPath(
  new URL(
    '../../backend/test/fixtures/epcis/ObjectEvent.json',
    import.meta.url,
  ),
);
// El documento se usa sin modificar: los bytes del fixture son el payload.
const realDocument = JSON.parse(readFileSync(fixturePath, 'utf8')) as unknown;

const SGTIN_2017 = 'urn:epc:id:sgtin:0614141.107346.2017';
const SGTIN_2018 = 'urn:epc:id:sgtin:0614141.107346.2018';

const INGEST_PRODUCT_NAME = 'Producto de ingesta E2E';

async function apiLogin(request: APIRequestContext, email: string): Promise<string> {
  const response = await request.post('/api/v1/auth/login', {
    data: { email, password: SEED.password },
  });
  expect(response.status(), 'login de la organización seed').toBe(201);
  return (await response.json()).accessToken as string;
}

async function distributorActorId(request: APIRequestContext, token: string): Promise<string> {
  const me = await (
    await request.get('/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
  ).json();
  return me.actor.id as string;
}

async function createIngestProduct(
  request: APIRequestContext,
  token: string,
  suffix: string,
): Promise<string> {
  const response = await request.post('/api/v1/products', {
    headers: { Authorization: `Bearer ${token}` },
    data: { sku: `INGEST-E2E-${suffix}`, name: INGEST_PRODUCT_NAME },
  });
  expect(response.status(), 'creación del producto de ingesta').toBe(201);
  return (await response.json()).id as string;
}

test('US15: el documento real sin epcMapping se rechaza sin efectos parciales (FR-2005)', async ({
  page,
  request,
}) => {
  const token = await apiLogin(request, SEED.distributor.email);

  // El documento real, empujado tal cual, sin mapping: sus EPCs no están
  // comisionados en la plataforma y nadie pasó su owner.
  const response = await request.post('/api/v1/epcis/capture', {
    headers: { Authorization: `Bearer ${token}` },
    data: realDocument,
  });
  expect(response.status()).toBe(400);
  const body = await response.json();
  expect(String(body.message)).toContain('without an owner in epcMapping');
  expect(String(body.message)).toContain(SGTIN_2017);

  // Sin efectos parciales: el EPC no existe en la plataforma.
  await login(page, SEED.distributor.email);
  await openTrace(page, SGTIN_2017);
  await expectNotFound(page, SGTIN_2017);
});

test('US15: la organización ingresa el documento real y el gemelo se ve en la UI (FR-2001/FR-2003/FR-2004/FR-2005)', async ({
  page,
  request,
}) => {
  const token = await apiLogin(request, SEED.distributor.email);
  const actorId = await distributorActorId(request, token);
  const productId = await createIngestProduct(request, token, 'A');

  // El documento real envuelto solo con el mapping de owners/productos.
  const response = await request.post('/api/v1/epcis/capture', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      document: realDocument,
      epcMapping: {
        [SGTIN_2017]: { ownerActorId: actorId, productId },
        [SGTIN_2018]: { ownerActorId: actorId, productId },
      },
    },
  });
  expect(response.status()).toBe(201);
  expect(await response.json()).toEqual({
    imported: 2,
    skipped: 0,
    epcsCreated: 2,
  });

  // En la UI: el gemelo del EPC del fixture carga con owner = la
  // organización que ingresó (FR-2005). SGTIN_2017 solo aparece en el
  // shipping del documento → «En tránsito» con su único evento.
  await login(page, SEED.distributor.email);
  await openTrace(page, SGTIN_2017);
  const twin = twinCard(page);
  await expect(twin.getByText('En tránsito', { exact: true })).toBeVisible();
  await expect(
    twin.getByText(SEED.distributor.name, { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Historial · 1 evento(s)' }),
  ).toBeVisible();

  // SGTIN_2018 aparece en los dos eventos: la recepción lo deja «Activo»
  // bajo custodia del que ingresó (proyección local, FR-2004).
  await openTrace(page, SGTIN_2018);
  const other = twinCard(page);
  await expect(other.getByText('Activo', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Historial · 2 evento(s)' }),
  ).toBeVisible();

  // Y ambos EPCs aparecen en «Mis casos» de la organización (la owns).
  const ingestedRows = page
    .locator('.case-row')
    .filter({ hasText: INGEST_PRODUCT_NAME });
  await expect(ingestedRows).toHaveCount(2);
});

test('US15: reenviar el mismo documento es idempotente por eventUid (FR-2002)', async ({
  page,
  request,
}) => {
  const token = await apiLogin(request, SEED.distributor.email);

  // Re-envío del documento REAL sin mapping: los EPCs ya están comisionados
  // por el test anterior, así que el documento plano es aceptable, pero sus
  // eventIDs (eventUid) ya están en el ledger → todo se saltea.
  const response = await request.post('/api/v1/epcis/capture', {
    headers: { Authorization: `Bearer ${token}` },
    data: realDocument,
  });
  expect(response.status()).toBe(201);
  expect(await response.json()).toEqual({
    imported: 0,
    skipped: 2,
    epcsCreated: 0,
  });

  // En la UI el historial no duplica nada.
  await login(page, SEED.distributor.email);
  await openTrace(page, SGTIN_2017);
  await expect(
    page.getByRole('heading', { name: 'Historial · 1 evento(s)' }),
  ).toBeVisible();
});

test('US17: una organización ajena no ve los EPCs ingresados (FR-D2)', async ({
  page,
}) => {
  await login(page, SEED.hospital.email);
  await openTrace(page, SGTIN_2017);
  await expectNotFound(page, SGTIN_2017);

  // Tampoco en su lista: los EPCs de la ingesta no aparecen en «Mis casos».
  const ingestedRows = page
    .locator('.case-row')
    .filter({ hasText: INGEST_PRODUCT_NAME });
  await expect(ingestedRows).toHaveCount(0);
});

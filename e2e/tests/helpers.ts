import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Helpers compartidos de los specs web por historia (S3-2 / US17).
 *
 * El estado bajo prueba es el seed determinista
 * (`backend/src/seed/seed.service.ts`): el global setup de esta suite hace
 * drop/create de la BD `supply_chain_e2e` y la siembra en cada corrida, así
 * que los URN y las cuentas de abajo existen siempre.
 *
 * Estado final del seed que usan los specs:
 *  - V2, V3: owner = custodian = distribuidora, estado active (vacuna).
 *  - I1: owner = hospital, custodian = distribuidora, destination = hospital,
 *    estado in_transit (insulina).
 *  - I2: owner = custodian = distribuidora, estado active (insulina).
 *  - (El quinto caso del seed está owned y custodiado por el hospital.)
 *  - Cada caso contiene 2 EPCs de contenido (FR-D7, G9): gemelos separados
 *    ligados por agregación (PACKING) que viajan con el mismo flujo de
 *    custodia que su caso — por eso también aparecen en «Mis casos» y suman
 *    a los conteos de filas.
 */
export const SEED = {
  password: 'Seed1234',
  manufacturer: {
    email: 'laboratorio@seed.nodoo.local',
    name: 'Laboratorios FarmaSur',
  },
  distributor: {
    email: 'distribuidora@seed.nodoo.local',
    name: 'Distribuidora MediAndes',
  },
  hospital: {
    email: 'hospital@seed.nodoo.local',
    name: 'Hospital San Rafael',
  },
} as const;

export const V1 = 'urn:nodoo:epc:1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
export const V2 = 'urn:nodoo:epc:2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e';
export const V3 = 'urn:nodoo:epc:3c4d5e6f-7a8b-4c9d-0e1f-2a3b4c5d6e7f';
export const I1 = 'urn:nodoo:epc:4d5e6f7a-8b9c-4d0e-1f2a-3b4c5d6e7f8a';
export const I2 = 'urn:nodoo:epc:5e6f7a8b-9c0d-4e1f-2a3b-4c5d6e7f8a9b';

// Contenido de cada caso (FR-D7, G9): 2 EPCs por caso, empaquetados en el
// seed con el paso de negocio de empaquetado. Mismos URN que
// `SEED_EPC_IDS.{vaccine,insulinContent}` de `seed.service.ts`.
export const V1_CONTENT = [
  'urn:nodoo:epc:a1000001-0000-4000-8000-000000000001',
  'urn:nodoo:epc:a2000002-0000-4000-8000-000000000002',
] as const;
export const V2_CONTENT = [
  'urn:nodoo:epc:a3000003-0000-4000-8000-000000000003',
  'urn:nodoo:epc:a4000004-0000-4000-8000-000000000004',
] as const;
export const V3_CONTENT = [
  'urn:nodoo:epc:a5000005-0000-4000-8000-000000000005',
  'urn:nodoo:epc:a6000006-0000-4000-8000-000000000006',
] as const;
export const I1_CONTENT = [
  'urn:nodoo:epc:a7000007-0000-4000-8000-000000000007',
  'urn:nodoo:epc:a8000008-0000-4000-8000-000000000008',
] as const;
export const I2_CONTENT = [
  'urn:nodoo:epc:a9000009-0000-4000-8000-000000000009',
  'urn:nodoo:epc:aa00000a-0000-4000-8000-00000000000a',
] as const;

export const VACCINE_PRODUCT = 'Vacuna antigripal 0.5 mL';
export const VACCINE_BATCH = 'LOTE-VAC-2026-1117-A';
export const INSULIN_PRODUCT = 'Insulina glargina 100 UI/mL';

/**
 * La UI muestra cada EPC abreviado: los primeros 8 caracteres del último
 * segmento del URN (ver `short()` en la página de trazabilidad).
 */
export function shortOf(urn: string): string {
  return urn.split(':').pop()?.slice(0, 8) ?? '';
}

/**
 * Etiqueta de una opción de los multi-select de la página de trazabilidad
 * (empaque, desempaque, asociaciones): `short · nombre del producto`,
 * idéntica al template de la UI.
 *
 * Se necesita porque en Angular 21 el `value` del option de un select
 * multiple no es confiable en el DOM; la selección estable es por etiqueta.
 */
export function optionLabel(urn: string, product: string): string {
  return `${shortOf(urn)} · ${product}`;
}

/**
 * Fila de «Mis casos» filtrada por producto y estado, excluyendo los EPC
 * abreviados conocidos (los casos del seed) para aislar el caso fresco
 * comisionado por un test anterior del mismo archivo. Las filas muestran
 * solo el EPC abreviado, así que la exclusión es por ese texto.
 */
export function caseRow(
  page: Page,
  opts: { product?: string; status?: string; except?: string[] } = {},
): Locator {
  let row = page.locator('.case-row');
  if (opts.product) row = row.filter({ hasText: opts.product });
  if (opts.status) row = row.filter({ hasText: opts.status });
  for (const short of opts.except ?? []) {
    row = row.filter({ hasNotText: short });
  }
  return row;
}

/**
 * Lee el URN completo que la tarjeta del gemelo muestra en texto plano
 * (las filas de «Mis casos» solo muestran el EPC abreviado, y la carga
 * desde la lista no modifica la URL). Solo sirve cuando el actor puede ver
 * el gemelo; para actores sin scope, el URN se deriva desde un actor que
 * sí lo ve (owner o custodio).
 */
export async function urnFromTwinCard(page: Page): Promise<string> {
  const urnEl = twinCard(page).locator('div.break-all');
  await expect(urnEl).toHaveCount(1);
  const urn = (await urnEl.first().textContent())?.trim() ?? '';
  if (!urn.startsWith('urn:nodoo:epc:')) {
    throw new Error('Falta el URN completo en la tarjeta del gemelo');
  }
  return urn;
}

export async function login(page: Page, email: string): Promise<void> {
  // La sesión persistida en localStorage hace que la página de login
  // redirija a «Inicio» antes de poder escribir el formulario (ngOnInit de
  // Login). Se limpia el token antes de cada login para poder cambiar de
  // actor dentro del mismo test; el token que el login recién emite ya no
  // existe en este punto.
  await page.goto('/login');
  await page.evaluate(() => localStorage.removeItem('nodoo:token'));
  await page.goto('/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(SEED.password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(
    page.getByRole('heading', { name: 'Inicio', level: 1 }),
  ).toBeVisible();
}

/** Deep link `/trace?epc=<urn>`: la página de trazabilidad carga el gemelo en el init. */
export async function openTrace(page: Page, urn: string): Promise<void> {
  await page.goto(`/trace?epc=${encodeURIComponent(urn)}`);
  await expect(
    page.getByRole('heading', { name: 'Trazabilidad', level: 1 }),
  ).toBeVisible();
}

export function twinCard(page: Page): Locator {
  return page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Gemelo digital' }) })
    .first();
}

/**
 * FR-D2/FR-D6: una organización sin scope legible recibe 404 (nunca 403);
 * la página de trazabilidad renderiza el mensaje de la API en su div de
 * error y no muestra el gemelo.
 */
export async function expectNotFound(page: Page, urn: string): Promise<void> {
  await expect(
    page.getByText(`Epc not found with id:${urn}.`, { exact: true }),
  ).toBeVisible();
  await expect(twinCard(page)).not.toBeVisible();
}

/**
 * Comisiona `count` casos del lote de vacuna desde la página de productos
 * (Paso 3), uno por visita — la lista de casos creados es por sesión — y
 * sigue cada caso hasta su gemelo para leer el URN completo. Devuelve los
 * URN en orden de comisionamiento.
 */
export async function commissionVaccineCases(
  page: Page,
  count: number,
): Promise<string[]> {
  const urns: string[] = [];

  for (let i = 0; i < count; i += 1) {
    await page.goto('/products');
    await expect(
      page.getByRole('heading', { name: 'Productos y casos', level: 1 }),
    ).toBeVisible();

    const batchSelect = page
      .locator('select')
      .filter({ has: page.getByRole('option', { name: VACCINE_BATCH }) });
    await batchSelect.selectOption({ label: VACCINE_BATCH });

    // El select de lote, el input de cantidad y «Generar» comparten el
    // mismo contenedor en la fila del producto.
    const form = batchSelect.locator('..');
    await form.locator('input[type="number"]').fill('1');
    await form.getByRole('button', { name: 'Generar' }).click();

    const row = page
      .locator('.case-row')
      .filter({ hasText: VACCINE_PRODUCT })
      .first();
    await expect(row).toBeVisible();
    await row.click();

    await expect(
      page.getByRole('heading', { name: 'Trazabilidad', level: 1 }),
    ).toBeVisible();

    const urn = new URL(page.url()).searchParams.get('epc');
    if (!urn) {
      throw new Error('Falta el URN en la URL tras comisionar el caso');
    }
    urns.push(urn);
  }

  return urns;
}

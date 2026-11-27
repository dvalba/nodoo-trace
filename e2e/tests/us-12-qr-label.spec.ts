import { expect, test } from '@playwright/test';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import {
  V1,
  V2,
  expectNotFound,
  login,
  openTrace,
  SEED,
  shortOf,
  twinCard,
} from './helpers';

/**
 * US12 — Etiqueta QR del caso (spec 001, US12 y FR-1204).
 *
 * El QR se genera en el cliente al cargar el gemelo (Clarifications
 * 2026-11-26) y codifica el URN exacto del EPC. Este test decodifica en
 * Node (jsQR + pngjs) el data URL del <img>: los mismos bytes que
 * descargaría la organización al imprimir la etiqueta. El consumo de esa
 * misma etiqueta con la cámara (FR-602) es el escaneo de la propia app; el
 * caso de cámara no se ejecuta en la suite (requiere un dispositivo real)
 * y se declara en el reporte de cierre (S3-3).
 */

const DATA_URL_PREFIX = 'data:image/png;base64,';

test('US12: la tarjeta del gemelo muestra un QR descargable que decodifica al URN (FR-1204)', async ({
  page,
}) => {
  await login(page, SEED.distributor.email);
  await openTrace(page, V2);

  const twin = twinCard(page);
  await expect(twin.getByText('Activo', { exact: true })).toBeVisible();

  // El QR se genera al cargar el gemelo, junto al URN en texto plano.
  const img = page.locator('#qrLabel');
  await expect(img).toBeVisible();
  const src = (await img.getAttribute('src')) ?? '';
  expect(src.startsWith(DATA_URL_PREFIX)).toBe(true);

  // La opción de descarga apunta a la misma imagen y la nombra por EPC.
  const download = page.locator('#qrDownload');
  await expect(download).toBeVisible();
  expect(await download.getAttribute('href')).toBe(src);
  expect(await download.getAttribute('download')).toBe(
    `etiqueta-${shortOf(V2)}.png`,
  );

  // Decodifica el QR y aserta el payload exacto.
  const b64 = src.slice(DATA_URL_PREFIX.length);
  const png = PNG.sync.read(Buffer.from(b64, 'base64'));
  const decoded = jsQR(new Uint8Array(png.data), png.width, png.height);
  expect(decoded, 'el QR de la etiqueta no se decodificó').not.toBeNull();
  expect(decoded!.data).toBe(V2);

  // Al consultar un caso sin scope, el gemelo no carga y la etiqueta
  // anterior no debe persistir en pantalla.
  await openTrace(page, V1);
  await expectNotFound(page, V1);
  await expect(page.locator('#qrLabel')).not.toBeVisible();
});

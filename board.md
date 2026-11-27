# Tablero — nodoo-trace (kanban de tareas)

> Nota (2026-11-24): este archivo no estaba en este clon (en el clon original
> era un symlink local al vault de Obsidian, ignorado por `.gitignore`);
> reconstruido a partir de `sprints/sprint-02-handoff.md`,
> `specs/001-platform/tasks.md` y `sprints/sprint-02.md`. Desde el 2026-11-24
> es un archivo regular bajo control de versiones, en formato de la extensión
> **Kanban de Obsidian** (columnas `##`, tarjetas `- [ ]`/`- [x]`, bloque
> `%% kanban:settings` al final); el vault de Windows enlaza aquí. Una tarea a
> la vez; al terminar: gates verdes + checkbox en `tasks.md` + tarjeta movida
> aquí.

## Por hacer

## En curso

## Hecho

- [x] **S4-2** [Sprint 04 · US15 · FR-2001..FR-2005 · R6] Ingesta de
  documentos EPCIS 2.0 de terceros. Cerrado (2026-11-27): endpoint
  `POST /api/v1/epcis/capture` (`@Auth()` con credencial por organización —
  patrón EPCIS 2.0 Capture de la decisión R6 en S4-1): parser puro
  `epcis-capture.parser.ts` (ObjectEvent/TransactionEvent/AggregationEvent/
  TransformationEvent; `eventUid` desde el `eventID` del documento) +
  `EpcisCaptureService` en una transacción única: pre-crea los EPCs no
  comisionados según `epcMapping` (owner=producer=custodian=organización que
  ingresa; sin owner → 400 sin efectos parciales, FR-2005), dedupe por
  `eventUid` precargado (FR-2002), persiste con `source: 'external'`
  (data-model.md) y proyecta al twin vía `TwinProjector` con las reglas
  locales (FR-2004); `bizTransactionType` ensanchado a `text`; G11 cerrado
  como precondición de FR-2002. Evidencia: specs unit de parser+service 16/16
  + `backend/test/epcis-ingest.e2e-spec.ts` 12/12.
- [x] **S4-3** [Sprint 04 · US17/US15 · FR-1506/FR-1507 + FR-2001..2005]
  Test E2E de la historia de ingesta + evidencia del sprint. Cerrado
  (2026-11-27): `e2e/tests/us-15-epcis-ingestion.spec.ts` — 4 tests
  autocontenidos que empujan al endpoint de captura un documento EPCIS 2.0
  REAL y no modificado, byte a byte (fixture de la comunidad openepcis en
  `backend/test/fixtures/epcis/ObjectEvent.json`: dos ObjectEvents con
  `eventID` propio): (1) documento plano sin `epcMapping` → 400 sin efectos
  parciales (FR-2005); (2) con `epcMapping` → `{imported:2, skipped:0,
  epcsCreated:2}` + en la UI SGTIN_2017 «En tránsito» (solo shipping, 1
  evento) y SGTIN_2018 «Activo» (shipping+receiving, 2 eventos, FR-2004) y 2
  filas en «Mis casos»; (3) re-envío plano (EPCs ya comisionados) →
  idempotente `{imported:0, skipped:2, epcsCreated:0}` por `eventUid`
  (FR-2002); (4) organización ajena → 404 + cero filas (US17/FR-D2). Sin
  `test.skip`/esperas fijas (FR-1507). `pnpm test:e2e:web` 20/20; evidencia en
  `e2e-evidence/sprint-04/` (20 carpetas por test + `visual/despues` 12 PNG +
  6 videos + `summary.md`); destino visual de `visual-captures.spec.ts`
  ajustado a `sprint-04`.
- [x] **G11** [#gap · Sprint 04 · FR-D1, NFR-6] Cerrado (2026-11-27,
  precondición de FR-2002): `append` (y el camino de commissioning) persisten
  `eventUid: randomUUID()` en cada evento local — ningún evento del ledger
  queda con `eventUid: null` y el índice único de `LedgerEvent.eventUid` sí se
  ejercita (es el dedupe de la ingesta). Cubierto por las specs unit del
  ledger + `epcis-ingest.e2e-spec.ts` (idempotencia por eventUid).
- [x] **G9** [#gap · Sprint 04 · FR-D7, FR-1301] Cerrado (2026-11-27): el
  seed comisiona además 2 unidades de contenido por caso (10 EPCs de
  contenido) como gemelos de primera clase: agregación `PACKING` (caja ⊃
  contenido) y custodia propia (ship/invoice/receive por EPC) — la
  separabilidad case/contenido se ejercita en la demo y en la suite web
  (scopes us-06, unpack de 3 hijos en us-08, QR en us-12). URNs con prefijo
  de 8 caracteres único (la UI abrevia con `short()`): casos
  `1a2b3c4d`–`5e6f7a8b`, contenidos `a1000001`–`aa00000a`. Consecuencia
  aceptada en spec: los EPCs de contenido aparecen en «Mis casos» (son
  gemelos con custodia propia).
- [x] **G6** [#gap · Sprint 04 · FR-204/205] Cerrado (2026-11-27):
  `accept` y `createCustom` (`operations.service.ts`) lanzan
  `ConflictException` (409 «The organization has already completed its
  onboarding.») si el actor ya tiene activities — onboarding «solo una vez»
  como documenta el contrato Swagger. Cubierto por
  `backend/test/onboarding.e2e-spec.ts` (3 casos: segundo accept, createCustom
  tras accept y viceversa → 409).
- [x] **G8** [#gap · Sprint 04 · FR-1401] Cerrado (2026-11-27):
  `FileEmailSender` (`common/providers/file-email-sender.ts`) ya no lee
  `process.env.MAIL_OUTBOX_PATH` a brutas: la ruta sale de `ConfigService`
  (default validado por Joi en `env.validation.ts`). Cubierto por
  `email-sender.factory.spec.ts` + `env.validation.spec.ts`.
- [x] **G12** [#gap · Sprint 04 · FR-1402 · documentación] Cerrado
  (2026-11-27): `spec.md` corregida — el fallback `from` documentado es
  `no-reply@nodoo.local` (E19/FR-1402), en consonancia con el default de
  `env.validation.ts`, `.env.example` y `smtp-email-sender.ts`; sin cambio de
  código.
- [x] **S4-1** [Sprint 04 · US15 · FR-2001/FR-2005 · R6] Clarificación del
  canal de importación EPCIS 2.0 de terceros + tratamiento de EPCs no
  comisionados. Resuelto (2026-11-27, decisión del dueño): **endpoint REST**
  (patrón EPCIS 2.0 Capture) — el tercero empuja el documento en una petición
  autenticada con credencial por organización; fuera de scope: subida manual de
  archivo y poll/notify. EPCs no comisionados → **owner pasado por el endpoint**:
  con owner se crea el EPC con ese owner; sin owner, 400 sin efectos parciales
  (FR-2005). Spec actualizada: FR-2001 reformulado, FR-2005, escenarios/edge
  cases de US15, Clarifications 2026-11-27, R6 de `research.md`, `data-model.md`
  y `contracts/api.md` en sincronía.
- [x] **S3-2** [Sprint 03 · US17 · FR-1506/FR-1507] Tests E2E por historia del
  sprint. Cerrado (2026-11-26): `us-06-custody-shipment-receipt.spec.ts` (7
  tests), `us-07-business-documents.spec.ts` (3) y
  `us-08-inspection-aggregation.spec.ts` (4) + `helpers.ts`. Primera corrida
  12/16 fallados → 4 causas raíz resueltas: G13 (fix de app), G14 (selección
  por etiqueta), sesión persistente obsoleta (`helpers.login()` borra
  `nodoo:token`) y re-evaluación de módulo de Playwright (tests autocontenidos:
  el URN completo se deriva en el punto de uso desde la tarjeta del gemelo de
  un actor con scope, `urnFromTwinCard`). Suite final 16/16 verde (incl. us-12
  y us16-smoke); sin `test.skip`/esperas fijas; caso de cámara declarado en el
  reporte S3-3 (FR-602).
- [x] **S3-3** [Sprint 03 · US18 · FR-1508] Evidencia de cierre en
  `e2e-evidence/sprint-03/`. Cerrado (2026-11-26): 16 carpetas por test
  (`video.webm` + `test-finished-1.png`) + `summary.md` a mano con tabla final
  (historia → test → resultado → video), declaración del caso de cámara, triage
  de causas raíz y verificación de los 5 Quality Gates en verde. O1/O2
  (observaciones S2-4) corregidas en la documentación de la spec: O1 E19→US14
  (título + Clarifications 2026-11-26); O2 FR-210/211→FR-206 (`data-model.md`
  l.8/11, `contracts/api.md`) — la referencia de actor devuelve id, name,
  activities y operaciones derivadas, y `Organization` no tiene
  `contactEmail`/`contactName`/`phone`/`logoUrl` (solo `organizationNumber`
  opcional, como en la entidad).
- [x] **S3-4** [Sprint 03 · US12 · FR-1204 · Clarifications 2026-11-26]
  Generación del QR de la etiqueta física en el frontend. Cerrado
  (2026-11-26): QR generado en el cliente al cargar el gemelo (`toDataURL` de
  `qrcode`, width 320, ECC M; signal `qrUrl` reseteado en cada `load()`);
  template: QR junto al URN + descarga `etiqueta-<short>.png`; e2e
  `us-12-qr-label.spec.ts` decodifica los bytes exactos del `<img>` (jsQR +
  pngjs) y aserta payload === URN, y que la etiqueta no persiste en un 404.
- [x] **G13** [#bug · Sprint 03 · FR-1203 · hallazgo web e2e (S3-2)]
  Los mensajes de éxito de las acciones de trace nunca se mostraban: `runAction`
  fijaba `actionMessage` ANTES de `load()`, que lo limpiaba. Cerrado
  (2026-11-26) en `frontend/src/app/pages/trace/trace.ts`: el mensaje se fija
  DESPUÉS de `load()` + `loadCases()` (con comentario explicativo);
  `receiveByLabel` no se veía afectado. Cubierto por todos los tests de acción
  (us-06 t1/t2, us-07 t1/t2, us-08 t1–t4).
- [x] **G14** [#test · Sprint 03 · hallazgo web e2e (S3-2) · lado test, sin cambio de app]
  En los multi-select de trace, el valor DOM de cada `<option>` es la
  codificación interna de Angular (truncada), no el URN: `selectOption(urn)`
  nunca coincidía. Cerrado (2026-11-26) solo en los specs: selección por
  etiqueta exacta del template (`optionLabel` = `short(urn) · producto`) en
  us-08 t2/t3/t4; la app no cambia (el modelo recibía el URN real).
- [x] **S3-1** [Sprint 03 · FR-D3..FR-D6, FR-601, FR-602, FR-701, FR-803 · notas 1–2]
  Cerrar los gaps de S2-4 de custody/visibilidad/ledger (G1, G2, G3, G4, G5,
  G10) con sus tests unit/e2e API. Cerrado (2026-11-24): G1 vistas por scope
  (`EpcView` + `twinScope`/`scopedView` en twin/list/search/history, cláusula
  `EPC_SCOPE_CLAUSE`, veto FR-D6 al producer no-owner incluso en list); G2
  receiving por etiqueta en la página de trace (entrada manual primaria +
  cámara opcional con jsQR) y recepción desde la lista eliminada; G3 guardas
  de receiving (solo destination de un case `in_transit`; re-recepción y
  case sin destinatario → 400; ajeno → 404); G4 guard de shipping
  (`in_transit` → 400); G5 chequeo de descendencia profunda en agregación ADD
  (ambas direcciones → 400); G10 rol emisor de documentos (PO: no-owner;
  desadv/bol: custodian; ajeno → 404). Evidencia: spec unit
  `event-ledger.service.spec.ts` (14 tests) + 6 casos nuevos en
  `test/traceability.e2e-spec.ts` (12/12). Gates: lint exit 0, unit 47/47,
  build OK, e2e API 12/12. `tasks.md` S3-1 marcado.
- [x] **G1** [#gap · Sprint 03 · FR-D4/FR-D5/FR-D6, FR-604/605/606 · nota 1 de la spec]
  Sobre-exposición de la visibilidad cerrada: `canRead` (`event-ledger.service.ts`
  l.960-967) incluye el producer (FR-D6: un producer no-owner no ve nada) y el
  destinatario (FR-D5/605: solo EPC + producto del shipment a su favor);
  `getHistory` (l.620-636) devuelve el historial completo al custodian actual
  (FR-D4: solo su ventana de custodia; la rama `custodianWindow` solo es
  alcanzable para ajenos/ex-custodios); `listEpc` (l.516) y `search` (l.550)
  usan la cláusula de 4 roles producer∨owner∨custodian∨destination (FR-604).
  El desvío ya está documentado en Swagger (`epcs.controller.ts` l.54/306/326/337).
  Cerrado en S3-1 (2026-11-24).
- [x] **G2** [#gap · Sprint 03 · FR-D5, FR-602 · nota 2 de la spec]
  Receiving sin lectura de la etiqueta física: la UI recibe con un botón desde
  la lista (`trace.ts` l.313-315, l.1037-1040; `api.service.ts` l.114-117,
  `POST /epcs/:epc/receive`). Duda de spec l.631 **resuelta (2026-11-24,
  Clarifications)**: entrada manual del EPC como flujo primario + cámara del
  navegador opcional (getUserMedia + decodificador QR); el flujo manual es el
  testeado en la e2e por historia (US17), el de cámara se declara no ejecutable
  en el reporte (spec l.349). Cerrado en S3-1 (2026-11-24).
- [x] **G3** [#gap · Sprint 03 · FR-602 + estado límite «recibir sin destinatario o ya recibido → 400» (spec l.169/384) · hallazgo nuevo]
  Receiving sin guardas: `findReceivableEpc` (l.907-923) acepta
  owner∨custodian∨destination sin chequear estado `in_transit` ni destinatario
  → owner/custodian pueden «recibir» cases no in-transit y re-recibir
  (ReceivingEvent duplicado). Cerrado en S3-1 (2026-11-24).
- [x] **G4** [#gap · Sprint 03 · FR-601 + estado límite «embarcar un case in_transit → 400» (spec l.170) · hallazgo nuevo]
  Shipping sin guard de estado: `ship` (l.222-264) solo verifica custodia
  (`findCustodiedEpcs`) → un case `in_transit` puede re-embarcarse. Cerrado en
  S3-1 (2026-11-24).
- [x] **G5** [#gap · Sprint 03 · FR-803 + estado límite «descendencia → 400» (spec l.201/385) · hallazgo nuevo]
  Agregación solo bloquea el ciclo directo: `aggregate` (l.385-439) rechaza
  `childIds.includes(parentId)` pero no la descendencia profunda (A⊃B, B⊃C →
  agregar C bajo A), aunque el proyector sí mantiene `parentId` en los hijos.
  Cerrado en S3-1 (2026-11-24).
- [x] **G10** [#gap · Sprint 03 · FR-701 · hallazgo nuevo]
  Documentos transaccionales sin rol emisor: `registerBusinessTransaction`
  (l.309-343) solo verifica `findReadableEpc` + gating de la operación; no
  aplica el rol de la spec (po: no-owner; desadv/bol: custodian) → cualquier
  actor legible con la operación puede emitir. Cerrado en S3-1 (2026-11-24).
- [x] **Docs** [reproducibilidad de evidencia e2e] `e2e-evidence/` es git-ignorada y se
  **construye en cada máquina**: procedimiento para clon nuevo (setup +
  `playwright install chromium` + `pnpm test:e2e:web` +
  `VISUAL_CAPTURES=despues pnpm test:visual`) documentado en `e2e/README.md` (nuevo)
  + bullet en `AGENTS.md` (Gotchas). Verificado con corrida completa: smoke 1
  passed + 6 capturas passed (12 PNG «después» + 6 videos regenerados). No
  regenerable desde el HEAD: baseline `antes` congelada (pre-S2-3b) y
  `summary.md`/`NOTAS.md` escritos a mano (se mueven con tar).
- [x] **T1–T11** [Sprint 01 · SDD + email provider] Sprint 01 completado
  (2026-11-23, commit `d0a4ed4`): scaffolding SDD (constitución, tablero,
  specs, skills) + spec 001 email provider `file`/`smtp` (RF-1..RF-5, hoy
  FR-1401..1405/US14). Tarjetas originales no están en este board (reconstruido
  el 2026-11-24); registro en `sprints/sprint-01.md`.
- [x] **S2-5** [Sprint 02 · US18] Cierre de Sprint 02 (2026-11-24): Quality Gates
  verificados — lint/test/build/e2e API exit 0; `pnpm test:e2e:web` 1 passed /
  0 skipped; gate (2) verde tras S2-6; gate (3) evidencia US16 (video +
  captura) y US19 (12×2 PNG + 6 videos + NOTAS); gate (4) neutralidad (S2-3);
  gate (5) `tasks.md` S2-1..S2-6 + tarjetas. Tabla final y verificación de
  gates en `e2e-evidence/sprint-02/summary.md`; Cierre + Retro en
  `sprints/sprint-02.md`. **Sprint 02 cerrado.**
- [x] **S2-6** [Sprint 02 · US16/US19 · FR-1502/FR-1504/FR-1507/FR-1509] Cumplimiento de
  FR-1507 en la suite web (gate (2) del cierre, detectado en S2-5): enmienda de
  spec (FR-1502 `testIgnore`, FR-1504 script `pnpm test:visual`, FR-1509 utility
  fuera de la suite por defecto), `e2e/playwright.config.ts` con
  `testIgnore: /visual-captures/`, nuevo `e2e/playwright.visual.config.ts`
  (hereda la base; `testMatch` solo-capturas) y reescritura de
  `e2e/tests/visual-captures.spec.ts` sin `test.skip` ni `waitForTimeout`
  (auto-wait del heading/botón tras cada cambio de viewport + `networkidle`;
  fallo explícito si `VISUAL_CAPTURES` ausente). Gates: `pnpm test:e2e:web`
  1 passed / 0 skipped; `VISUAL_CAPTURES=despues pnpm test:visual` 6 passed
  (evidencia regenerada); lint/test/build/e2e API exit 0.
- [x] **S2-4** [Sprint 02 · revisión de cumplimiento] Revisión de cumplimiento E1–E25 vs. spec 001:
  auditada la capa ledger/visibilidad (FR-D1..D10, FR-5xx..8xx, notas 1–4) y el
  resto (auth, invitations, users, onboarding, admin, catálogo, notices, email,
  seed, frontend US12, US14) contra sus FR. Resultado: 12 desvíos identificados
  (G1–G12): 11 tarjetas `#gap` arriba (G1–G6, G8–G12 → Sprints 03/04) + G7
  fuera de scope (nota 4, endpoint de rechazo de organizaciones — Out of
  scope, spec l.601; sin sprint de cierre) + 2 observaciones de spec (O1: E19
  sin mapear a ninguna US; O2: `data-model.md` cita FR-210/211 inexistentes).
  Scope de cierre: Sprint 03 (G1–G5, G10) y Sprint 04 (G6, G8, G9, G11, G12)
  en `sprints/sprint-03.md` / `sprints/sprint-04.md`. Sin cambios de código de
  app (NFR-12).
- [x] **S2-3** [Sprint 02 · US19 · FR-1509/FR-1510] Revisión visual de las 6
  pantallas (login, dashboard, productos, trace, equipo, organización):
  12 capturas «antes» + 12 «después» (1440x900 y 390x844) en
  `e2e-evidence/sprint-02/visual/{antes,despues}/`, 6 correcciones de
  neutralidad de sector aplicadas (4 archivos, 6 líneas), `NOTAS.md` con la
  descripción por pantalla. Gates verdes: lint, test (39/39), build,
  `pnpm test:e2e:web` (smoke US16 401 ms; las 6 visuales quedaban fuera de la
  suite — corregido en S2-6: `testIgnore` + `pnpm test:visual`).
  Incluye fix de infra mínima en `e2e/playwright.config.ts` (webServer con
  readiness en backend `:3001/api/v1/activity-types` + web `:4200`), necesaria
  porque el gate anterior solo cubría `:4200` y el smoke fallaba por carrera
  con la compilación en frío de `nest start --watch`.
- [x] **S2-2** [Sprint 02 · US16 · FR-1501..1508] Infraestructura Playwright +
  smoke test: paquete `e2e/`, BD dedicada `supply_chain_e2e` (drop/create/seed
  por ejecución), `pnpm test:e2e:web` con video/capturas/trace fuera de git,
  evidencia copiada a `e2e-evidence/sprint-02/`.
- [x] **S2-1** [Sprint 02] Plan de la spec 001: `specs/001-platform/plan.md` +
  `specs/001-platform/tasks.md` (Constitution Check PASS).

%% kanban:settings
```
{"kanban-plugin":"board","list-collapse":[false,false,true]}
```
%%

# Tasks: Plataforma de trazabilidad nodoo-trace (spec 001)

**Input**: Design documents from `/specs/001-platform/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: la spec los exige (US16 smoke, US17 tests por historia, US18 evidencia) → incluidos.

**Nota de organización (spec-first)**: US1–US14 son **baseline as-built** (código ya existe; Sprint 01 + repo previo): no hay tareas de implementación para ellas. Este archivo descompone el trabajo ejecutable en slices verticales alineados con `board.md`: Sprint 02 (S2-1..S2-4, en curso), y los sprints propuestos 03/04 como backlog planificado. Las IDs `S2-N` coinciden 1:1 con las tarjetas del tablero (una tarea a la vez, al terminar: gates verdes + checkbox + tarjeta movida).

**Citaciones de data-model.md**: Sprint 02 no crea ni modifica entidades de dominio (data-model.md: "Impacto del Sprint 02 — Ninguna entidad nueva"), por lo que no hay campos con restricción que citar en tareas de este sprint. Las tareas de Sprint 03/04 que toquen dominio deberán citar `Entity.field` de `data-model.md`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: historia de la spec a la que pertenece (US16, US19...). S2-1/S2-4 no tienen story propia (plan y auditoría transversal).

---

## Phase 1: Setup (Sprint 02)

**Purpose**: planificar la spec (ya es la fuente de verdad aprobada).

- [X] S2-1 Generar el plan de la spec: `specs/001-platform/plan.md` (Technical Context + Constitution Check + Project Structure + fases 0/1) y `specs/001-platform/tasks.md` (este archivo), desde `specs/001-platform/spec.md`

**Checkpoint**: spec planificada; Constitution Check PASS; se puede empezar la capa E2E.

---

## Phase 2: User Story 16 — Infraestructura E2E con Playwright (Priority: P1) 🎯 MVP

**Goal**: `pnpm test:e2e:web` ejecuta un smoke test (login con cuenta seed → dashboard sin errores de consola) sobre una BD e2e dedicada recreada y sembrada por ejecución, y produce video `.webm` + screenshots + trace en carpetas fijas fuera de git. (US16; incluye la infra de evidencia de US18.)

**Independent Test**: correr `pnpm test:e2e:web` dos veces seguidas: ambas verdes con el mismo resultado; `e2e/test-results/` tiene video/capturas del smoke; `e2e-evidence/sprint-02/` tiene la evidencia copiada; la BD dev (`supply_chain_db`) queda sin cambios. `pnpm test` sigue corriendo solo unit tests del backend.

**Tarjeta de tablero**: S2-2.

- [x] S2-2 [US16] Montar la infraestructura Playwright y el smoke test (US16, FR-1501..FR-1505, FR-1507, FR-1508; US18 infra de evidencia):
  - `pnpm-workspace.yaml`: añadir `e2e` a los paquetes.
  - `e2e/package.json` (name `e2e`, private; devDep `@playwright/test`; scripts `test` = `playwright test`, `reset-db`, `evidence`).
  - `e2e/playwright.config.ts`: único proyecto `chromium`; `video: 'on'`, `screenshot: 'on'`, `trace: 'retain-on-failure'`; `baseURL: 'http://localhost:4200'`; `outputDir: e2e/test-results`; `globalSetup` → `e2e/scripts/reset-e2e-db.ts`; `webServer` = `concurrently "DB_NAME=supply_chain_e2e pnpm --filter backend start:dev" "pnpm --filter nodoo-trace-web start"`, `url: http://localhost:4200`, `timeout: 120000`, `reuseExistingServer: false`.
  - `e2e/scripts/reset-e2e-db.ts`: `pnpm db:up` (idempotente) → `dropdb/createdb supply_chain_e2e` vía `docker compose -f backend/docker-compose.yml exec -T postgres` → `DB_NAME=supply_chain_e2e pnpm seed` (research R2).
  - `e2e/scripts/copy-evidence.ts`: copiar por test `video.webm` + screenshots a `e2e-evidence/sprint-NN/<nombre-test>/` (sprint por arg/env, defecto `sprint-02`); llamarlo al final del script `test` (research R4).
  - `e2e/tests/us16-smoke.spec.ts`: login con `distribuidora@seed.nodoo.local` / `Seed1234` → esperar el dashboard (condición explícita, sin `waitForTimeout` fijo) → aserción de que no hay errores de consola (FR-1506/FR-1507, US16).
  - `package.json` (raíz): script `test:e2e:web` = `pnpm --filter e2e test`.
  - `.gitignore`: añadir `e2e/test-results/`, `e2e/playwright-report/`, `e2e-evidence/`.
  - `AGENTS.md` + `README.md`: documentar `pnpm test:e2e:web` (precondición: stack de dev detenido; quickstart Q3).

**Checkpoint**: MVP de Sprint 02 — `pnpm test:e2e:web` verde y repetible, con evidencia fuera de git.

---

## Phase 3: User Story 19 — Revisión visual de la interfaz (Priority: P2)

**Goal**: capturar las pantallas actuales en 1440x900 y 390x844, examinarlas con la herramienta Read, corregir problemas con cambios pequeños y justificados, y dejar capturas antes/después con descripción de 2-3 líneas. (US19, FR-1509/FR-1510.)

**Independent Test**: `e2e-evidence/sprint-02/visual/` contiene, por pantalla revisada: capturas «antes» y «después» en ambos viewports y una descripción de 2-3 líneas por pantalla; ninguna pantalla revisada contiene vocabulario de sector (FR-1510).

**Tarjeta de tablero**: S2-3.

- [x] S2-3 [US19] Generar las capturas de las pantallas actuales en 1440x900 y 390x844 con Playwright (spec `e2e/tests/visual-captures.spec.ts` o script de `e2e/scripts/`), guardadas «antes» en `e2e-evidence/sprint-02/visual/antes/` (login, dashboard, productos, trace, equipo, organización)

- [x] S2-3 [US19] Examinar las capturas con la herramienta Read (jerarquía, espaciado, alineación, contraste, estados vacíos/carga/error, truncados, consistencia, neutralidad de sector) y aplicar las correcciones de UI pequeñas y justificadas en `frontend/src/app/pages/` (sin funcionalidades ni componentes que la spec no pida; NFR-12)

- [x] S2-3 [US19] Regenerar las capturas «después» en `e2e-evidence/sprint-02/visual/despues/` y escribir `e2e-evidence/sprint-02/visual/NOTAS.md` con la descripción de 2-3 líneas por pantalla (qué se revisó y qué mejoró)

**Checkpoint**: revisión visual completa y documentada; UI neutra verificada.

---

## Phase 4: Revisión de cumplimiento E1–E25 (auditoría transversal)

**Goal**: auditar el código as-built (E1–E25) contra los FR de la spec y registrar cada desvío con su FR y el sprint de cierre propuesto. Sin re-implementación en Sprint 02.

**Independent Test**: `board.md` contiene tarjetas nuevas por desvío (con FR de referencia) y `sprints/sprint-03.md` (y `sprint-04.md` si aplica) los incorporan como scope; la auditoría cubre al menos las Notas de cumplimiento 1–6 de la spec y el resto de E1–E25.

**Tarjeta de tablero**: S2-4.

- [x] S2-4 [P] Auditar la capa ledger/visibilidad (`backend/src/event-ledger/`, `backend/src/operations/`, controlador `epcs`) contra FR-D2..FR-D6 y FR-5xx..FR-8xx (incl. notas 1–4: sobre-exposición en `canRead`/`listEpc`/`search`/`getHistory`, receiving sin escaneo físico, 409 de receiving único, endpoint de rechazo de actor)

- [x] S2-4 [P] Auditar el resto de E1–E25 (auth, invitations, users, actor/onboarding, admin, products/batches, notices/acks, email provider, seed) contra sus FR (incl. notas 5–6: `MAIL_OUTBOX_PATH` leído desde `process.env`, seed que comisiona solo cases)

- [x] S2-4 Registrar los desvíos en `board.md` (nuevas tarjetas con FR y etiqueta `#gap`) y en `sprints/sprint-03.md` / `sprints/sprint-04.md` (scope de cierre, sin re-implementar ahora)

**Checkpoint**: lista de gaps completa, trazable (FR → tarjeta → sprint de cierre).

---

## Phase 5: Cumplimiento FR-1507 de la suite web (S2-6)

**Goal**: todos los specs que ejecuta `pnpm test:e2e:web` cumplen FR-1507 (sin `test.skip` ni esperas fijas); la utility de capturas (US19) queda fuera de la corrida por defecto y corre con su propio config y script raíz.

**Tarjeta de tablero**: S2-6.

- [x] S2-6 Enmiendar la spec (FR-1502/FR-1504/FR-1509): la utility de capturas se excluye de la suite por defecto (`testIgnore`) y corre con su propio config (`playwright.visual.config.ts`) y script raíz `pnpm test:visual`

- [x] S2-6 Implementar la exclusión y el config/script dedicados (`e2e/playwright.config.ts`, `e2e/playwright.visual.config.ts`, `package.json` raíz y `e2e/package.json`)

- [x] S2-6 Reescribir `e2e/tests/visual-captures.spec.ts` sin `test.skip` ni `waitForTimeout` fijos (esperas sobre condiciones explícitas; fallo explícito si `VISUAL_CAPTURES` no está seteado)

**Independent Test**: `pnpm test:e2e:web` corre solo el smoke (0 skip) y `VISUAL_CAPTURES=despues pnpm test:visual` corre las 6 capturas y regenera la evidencia.

---

## Phase 6: Cierre de Sprint 02 (US18)

- [x] S2-5 [US18] Cerrar Sprint 02: verificar los Quality Gates de la constitución (lint/test/build/e2e API + `pnpm test:e2e:web`), escribir la tabla final `e2e-evidence/sprint-02/summary.md` (fila por historia: historia → test → resultado → enlace al video) y completar el cierre en `sprints/sprint-02.md` + tarjetas en `board.md`

---

## Backlog planificado (sprints propuestos; se refinan al llegarles el turno)

> No son tareas ejecutables ahora: su scope se cierra cuando el sprint anterior termina (la constitución manda una tarea a la vez). Se listan para trazabilidad FR → sprint.

### Sprint 03 (propuesto) — gaps de custody/visibilidad + tests por historia (US17)
- [x] S3-1 Cerrar los gaps de S2-4 de custody/visibilidad (FR-D3..FR-D6, FR-602; notas 1–2) con sus unit/e2e API tests (cerrado 2026-11-24: G1 vistas por scope `EpcView`/`twinScope`/`scopedView` + `EPC_SCOPE_CLAUSE`, G2 receiving por etiqueta en `trace.ts` (manual + cámara jsQR opcional) sin recepción desde la lista, G3 guardas de receiving `in_transit`+destination, G4 guard de shipping `in_transit`→400, G5 descendencia profunda en agregación→400, G10 rol emisor PO/desadv/bol; spec unit 14 tests + 6 casos e2e API nuevos, gates lint/unit 47/build/e2e 12 verdes)
- [x] S3-2 [US17] Tests E2E por historia del sprint (cerrado 2026-11-26: `us-06-custody-shipment-receipt.spec.ts` 7 tests, `us-07-business-documents.spec.ts` 3, `us-08-inspection-aggregation.spec.ts` 4 + `helpers.ts`; camino feliz, validaciones, FR-D2..D6, aislamiento entre tenants, estados límite; FR-1507: sin `test.skip`/esperas fijas; el caso de cámara se declara en el reporte S3-3, no se skip). Primera corrida 12/16 fallados → 4 causas raíz resueltas (G13 fix de app, G14 selección por etiqueta, sesión persistente obsoleta en `helpers.login()`, tests autocontenidos por re-evaluación de módulo de Playwright) → suite final 16/16 verde
- [x] S3-4 [US12] Generación del código QR de la etiqueta física en el frontend (cerrado 2026-11-26: `toDataURL` de `qrcode` en `trace.ts` (width 320, ECC M) al cargar el gemelo, signal `qrUrl` reseteado en cada `load()`; template: QR en la tarjeta junto al URN + descarga `etiqueta-<short>.png`; e2e `us-12-qr-label.spec.ts` decodifica el data URL exacto del `<img>` con jsQR+pngjs y aserta payload === URN, y que no persiste etiqueta en 404)
- [x] S3-3 [US18] Evidencia de cierre en `e2e-evidence/sprint-03/` + tabla final (cerrado 2026-11-26: 16 carpetas por test con video + PNG; `summary.md` a mano con tabla final historia → test → resultado → video, declaración del caso de cámara (FR-602), triage de las 4 causas raíz y verificación de los 5 Quality Gates en verde; evidencia copiada con argumento explícito `sprint-03`)

### Sprint 04 (propuesto) — ingesta EPCIS 2.0 (US15)
- [x] S4-1 Resolver la clarificación de R6 (canal de importación + tratamiento de EPCs no comisionados) con el dueño; actualizar la spec (resuelto 2026-11-27: endpoint REST patrón EPCIS 2.0 Capture con credencial por organización; EPCs no comisionados → owner pasado por el endpoint, si no 400 sin efectos parciales; FR-2001 reformulado + FR-2005 nuevo + Clarifications 2026-11-27)
- [x] S4-2 [US15] Implementar la ingesta (FR-2001..FR-2005): dedupe por `LedgerEvent.eventUid` (data-model.md), `source` ≠ `platform` (data-model.md), proyección al twin con las reglas locales; tests unit + e2e API (cerrado 2026-11-27: endpoint `POST /api/v1/epcis/capture` — `@Auth()` por organización, patrón EPCIS 2.0 Capture de la decisión R6 de S4-1; parser puro `epcis-capture.parser.ts` (ObjectEvent/TransactionEvent/AggregationEvent/TransformationEvent, `eventUid` desde el `eventID` del documento) + `EpcisCaptureService` en una transacción única: pre-crea los EPCs no comisionados según `epcMapping` (owner=producer=custodian=organización que ingresa; sin owner → 400 sin efectos parciales, FR-2005), dedupe por `eventUid` precargado (FR-2002), persiste con `source: 'external'` (data-model.md) y proyecta al twin vía `TwinProjector` con las reglas locales (FR-2004); `bizTransactionType` ensanchado a `text`; `bizTransactionType`/`source` en la vista del historial; G11 como precondición: `eventUid` en cada evento local. Evidencia: unit specs de parser+service 16/16 + `backend/test/epcis-ingest.e2e-spec.ts` 12/12)
- [x] S4-3 [US17] Test E2E de la historia de ingesta + evidencia `e2e-evidence/sprint-04/` (cerrado 2026-11-27: `e2e/tests/us-15-epcis-ingestion.spec.ts` — 4 tests autocontenidos que empujan al endpoint de captura un documento EPCIS 2.0 REAL y no modificado, byte a byte (fixture de la comunidad openepcis `backend/test/fixtures/epcis/ObjectEvent.json`, dos ObjectEvents con `eventID` propio): (1) documento plano sin `epcMapping` → 400 + sin efectos parciales (FR-2005); (2) con `epcMapping` → `{imported:2, skipped:0, epcsCreated:2}` y en la UI el gemelo SGTIN_2017 queda «En tránsito» (solo shipping, 1 evento) y SGTIN_2018 «Activo» (shipping+receiving, 2 eventos, proyección local FR-2004) + 2 filas en «Mis casos»; (3) re-envío del documento plano (EPCs ya comisionados) → idempotente `{imported:0, skipped:2, epcsCreated:0}` por `eventUid` (FR-2002); (4) organización ajena → 404 + cero filas (US17/FR-D2). Sin `test.skip`/esperas fijas (FR-1507). `pnpm test:e2e:web` 20/20; evidencia en `e2e-evidence/sprint-04/` (20 carpetas por test + `visual/despues` 12 PNG + 6 videos + `summary.md`); destino visual de `visual-captures.spec.ts` ajustado a `sprint-04`. G9 cerrado como parte del scope: seed con 10 EPCs de contenido (FR-D7) y suite web actualizada)

---

## Dependencies & Execution Order

### Phase Dependencies

- **S2-1 (plan)**: sin dependencias — completado al generar este archivo.
- **S2-2 (US16)**: depende de S2-1. **Bloquea** S2-3 (necesita la infra de capturas) y S2-5.
- **S2-3 (US19)**: depende de S2-2.
- **S2-4 (auditoría)**: independiente de S2-2/S2-3 (solo lee código) → paralelizable con S2-3.
- **S2-5 (cierre)**: depende de S2-2 + S2-3 + S2-4 + S2-6.
- **S2-6 (FR-1507)**: depende de S2-2 + S2-3 (corrige la suite que entregaron). **Bloquea** S2-5.
- **Sprint 03**: depende de S2-4 (los gaps definen el scope) y de S2-2 (infra).
- **Sprint 04**: depende de la clarificación R6 (dueño) + infra E2E.

### User Story Dependencies

- **US16 (P1)**: tras S2-1. Independiente del resto.
- **US19 (P2)**: tras US16 (reutiliza Playwright para capturar).
- **US18 (P1)**: infra en US16; la tabla final al cierre (S2-5) y por sprint.
- **US17 (P1, Sprint 03)**: tras S2-4 + US16.
- **US15 (P3, Sprint 04)**: tras clarificación R6.

### Parallel Opportunities

- S2-4 (auditoría) y S2-3 (revisión visual) pueden avanzar en paralelo (archivos y dominios distintos).
- Dentro de S2-4, las dos auditorías (ledger vs. resto) son paralelizables [P].
- US1–US14 no requieren trabajo; solo son auditadas en S2-4.

---

## Parallel Example: Sprint 02

```text
Tras S2-2 (MVP):
  Rama A: S2-3 capturas → revisión → correcciones → antes/después   (frontend/e2e-evidence)
  Rama B: S2-4 auditoría ledger + auditoría resto → board/sprints   (backend, board.md)
Ambas convergen en S2-5 (cierre: gates + tabla + sprint-02.md).
```

---

## Implementation Strategy

### MVP First (S2-2)

1. S2-1 (hecho): plan + tasks.
2. S2-2: `pnpm test:e2e:web` verde y repetible con evidencia. **VALIDAR** corriendo la suite dos veces.
3. Detener aquí si el sprint se corta: se entrega infra E2E verificable.

### Incremental Delivery

1. S2-2 → infra E2E funcionando (MVP).
2. S2-3 → revisión visual documentada (antes/después).
3. S2-4 → gaps registrados (sin código).
4. S2-5 → cierre de sprint con tabla de evidencia.
5. Sprint 03 → gaps + tests por historia (US17) con el criterio de cierre completo.
6. Sprint 04 → ingesta EPCIS (US15).

### Reglas transversales (constitución)

- Una tarea a la vez; cada tarea entrega algo verificable de punta a punta.
- Gates al terminar cada tarea: `pnpm lint` y `pnpm test` (más `pnpm build` / `pnpm --filter backend test:e2e` / `pnpm test:e2e:web` si la tarea las toca).
- No añadir funcionalidades, abstracciones ni config que la spec no pida (NFR-12).
- Sin `test.skip` ni `waitForTimeout` fijo; esperas sobre condiciones explícitas (FR-1507).
- Sin commits salvo que el usuario lo pida; si se pide, un commit por tarea con su ID (S2-N).

---

## Notes

- [P] = distinto archivo/sin dependencias.
- Cada tarea S2-N es una tarjeta de `board.md`; al terminar: gates verdes, checkbox aquí, tarjeta movida.
- La evidencia de cierre vive en `e2e-evidence/sprint-NN/` (fuera de git): video + capturas clave + resultado por historia + tabla final (SC-007, US18).
- US1–US14: baseline as-built — si S2-4 detecta desvíos, el cierre es Sprint 03/04, nunca Sprint 02.
- `specs/001-platform/quickstart.md` Q1–Q5 describe cómo validar cada slice.

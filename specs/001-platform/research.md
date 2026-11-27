# Research: spec 001 (Sprint 02)

Fase 0 de `/speckit.plan`. Resuelve las incógnitas técnicas del plan (US16–US19). Cada decisión: qué se eligió, por qué, y qué alternativas se descartaron.

## R1 — Paquete `e2e/` en el workspace pnpm (FR-1501, FR-1504)

**Decision**: tercer paquete del workspace: `e2e/package.json` (name `e2e`, private) con `@playwright/test` en devDependencies y script `"test": "playwright test"`; el script raíz `pnpm test:e2e:web` lo delega con `pnpm --filter e2e test`. Los specs viven en `e2e/tests/` (fuera de cualquier `src/`).

**Rationale**: el dueño decidió explícitamente un paquete aparte (Clarifications, 2026-11-23). Quedar fuera de `backend/` y `frontend/` evita que vitest (backend) y el builder de Angular (frontend) recojan los specs; `pnpm test` sigue corriendo solo unit tests del backend (SC-006, US16).

**Alternatives considered**:
- `frontend/e2e/` dentro del paquete Angular — descartado: los specs quedarían dentro del paquete web y sus tooling los vería; además mezcla el cliente delgado con infra de pruebas.
- Paquetizar la suite como monorepo independiente — descartado: innecesario; el workspace pnpm ya resuelve la separación.

## R2 — Bootstrap de la BD e2e dedicada (FR-1505, SC-006)

**Decision**: por cada ejecución de la suite: (1) asegurar Postgres con `pnpm db:up` (idempotente); (2) `DROP DATABASE IF EXISTS supply_chain_e2e; CREATE DATABASE supply_chain_e2e;` contra la misma instancia local; (3) `DB_NAME=supply_chain_e2e pnpm seed` (construye el backend y corre `dist/scripts/seed.js` con el override; TypeORM `synchronize` crea el esquema y el seed inserta los datos deterministas); (4) la API arranca con el mismo override `DB_NAME=supply_chain_e2e`.

**Rationale**: la app lee `DB_NAME` por `ConfigService` (`app.module.ts`), así que el override por variable de entorno no toca código ni `.env` (NFR-12, FR-1505). Drop/create + seed por ejecución da estado conocido y repetible (SC-006) sin acumular datos. `synchronize` no crea la base de datos, por eso el create explícito.

**Alternatives considered**:
- Schema/namespace aparte en la misma BD — descartado: `synchronize` y el seed asumen una base por app; aislar por base es más simple y garantiza "no toca la base de desarrollo".
- Segundo contenedor Postgres — descartado: la spec manda la misma instancia local (NFR-10, FR-1505).
- `createdb`/`dropdb` del cliente local vs. `docker compose exec postgres` — se usará `docker compose -f backend/docker-compose.yml exec -T postgres` (no asume cliente pg instalado en la máquina del desarrollador); el override de env se pasa al seed y al API.

## R3 — Arranque del stack bajo Playwright (NFR-10)

**Decision**: `playwright.config.ts` con una entrada `webServer` que arranca API + web con el override de BD: `concurrently "DB_NAME=supply_chain_e2e pnpm --filter backend start:dev" "pnpm --filter nodoo-trace-web start"`, `url: http://localhost:4200`, `timeout: 120_000` y `reuseExistingServer: false`. El quickstart documenta detener `pnpm dev` antes de correr la suite.

**Rationale**: `reuseExistingServer: false` garantiza que la suite siempre use SU API contra la BD e2e (FR-1505): si hubiera un stack de dev corriendo en :3001 (contra la BD dev), reutilizarlo haría que la suite tocara datos de desarrollo. El fallo por puerto ocupado es explícito y el quickstart lo cubre. `concurrently` ya es devDependency raíz.

**Alternatives considered**:
- `reuseExistingServer: true` (o condicional) — descartado: no hay forma fiable de saber si el API en :3001 apunta a la BD e2e; rompería la determinación del dato.
- Detección y kill del proceso en el puerto — descartado: destruiría el stack de dev del usuario.
- Arrancar el API en otro puerto solo para e2e — descartado: la spec fija `baseURL: http://localhost:4200` y el proxy de la web apunta a :3001 (FR-1502); cambiar puertos exigiría tocar la config de la app (NFR-12).

## R4 — Artefactos de test y evidencia por historia (FR-1502, FR-1503, FR-1508)

**Decision**: `playwright.config.ts`: `video: 'on'`, `screenshot: 'on'`, `trace: 'retain-on-failure'`, `outputDir: e2e/test-results`, `use: { baseURL: 'http://localhost:4200' }`. Un script de post-test (`e2e/scripts/copy-evidence.ts`, llamado por el script `test` tras `playwright test`) copia por test su `video.webm` y sus screenshots a `e2e-evidence/sprint-NN/<nombre-test>/`; la tabla final (historia → test → resultado → enlace al video) se escribe al cierre del sprint como `e2e-evidence/sprint-NN/summary.md`. `e2e-evidence/`, `e2e/test-results/` y `e2e/playwright-report/` entran en `.gitignore`.

**Rationale**: la evidencia de cierre debe existir por historia al cerrar (SC-007); automatizar la copia evita olvidos y hace el cierre verificable. El número de sprint lo toma el script de un argumento/variable de entorno (por defecto el sprint activo).

**Alternatives considered**:
- Configurar `outputDir` directamente en `e2e-evidence/` — descartado: Playwright reescribe esa carpeta en cada run y borraría la evidencia de sprints anteriores; separar "resultados brutos" de "evidencia de cierre" es más limpio.
- Copiar a mano al cerrar — descartado: frágil y no verificable.

## R5 — Solo Chromium y fallos explícitos (NFR-11, US16/US17)

**Decision**: un único proyecto en `playwright.config.ts`: `chromium` (viewports: escritorio 1440x900 y móvil 390x844 disponibles por test vía `use.viewport`). Si el navegador no está instalado, Playwright falla con error explícito (se documenta `npx playwright install chromium` en el quickstart); ningún test se omite en silencio. La revisión visual (S2-3) reutiliza las mismas capturas de la suite.

**Rationale**: la spec restringe a Chromium y exige declarar lo no ejecutable (NFR-11, US17 edge case). Un solo proyecto mantiene la suite simple y determinista.

**Alternatives considered**:
- Firefox/WebKit — descartado: fuera de spec.
- `test.skip` condicionado a navegador ausente — prohibido explícitamente (FR-1507).

## R6 — Clarificación de US15 (FR-2001): canal de importación EPCIS

**Decision**: se dejó **sin resolver y fuera del alcance del Sprint 02** y se resolvió el 2026-11-27 con el dueño (Clarifications de la spec, S4-1): el canal es un **endpoint REST** (patrón EPCIS 2.0 Capture): el tercero empuja el documento en una petición autenticada con credencial por organización. Tratamiento de EPCs no comisionados: **el owner se pasa por el endpoint**; si la petición no lo pasa, el documento se rechaza con 400 sin efectos parciales (FR-2005). Fuera de scope para el MVP: subida manual de archivo y suscripción poll/notify (pull). No había tarea de Sprint 02 que dependiera de ello.

**Rationale**: la spec lo marcaba como NEEDS CLARIFICATION y lo agendaba a Sprint 04; investigar el canal entonces habría sido trabajo sin spec aprobada (principio I). El plan solo fija la restricción futura: `eventUid` como clave de dedupe y `source` distinto de `platform` (FR-2002/FR-2003, constitución X).

**Alternatives considered**: presuponer "endpoint REST" — descartado: inventar el canal violaría el principio I.

## R7 — Duda abierta: escaneo QR del receiving (FR-602)

**Decision**: sin resolver ahora. El código actual recibe con un botón sobre la lista (Nota de cumplimiento 2); el gap se audita en S2-4 y se cierra en Sprint 03 con la forma que el dueño apruebe (cámara del navegador o entrada manual del EPC). Los tests E2E de Sprint 03 cubrirán el receiving tal como lo defina la spec aprobada.

**Rationale**: es una Open Question de la spec, no una incógnita técnica de Sprint 02.

## Incógnitas resueltas por la spec (sin investigación adicional)

- Nombre y aislamiento de la BD e2e: Clarifications de 2026-11-23 (R2).
- Localización de Playwright y de la evidencia: Clarifications de 2026-11-23 (R1, R4).
- Puertos y entorno: NFR-3/NFR-10 (R3).
- Plugin SWC para la e2e API existente: NFR-9 (no se toca en Sprint 02).

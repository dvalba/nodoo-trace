# Quickstart: spec 001 (Sprint 02)

Fase 1 de `/speckit.plan`. Escenarios de verificación de la spec contra el repo (baseline + nueva capa E2E).

## Prerequisitos (todos los escenarios)

- Docker, pnpm 10, Node 24.
- `pnpm setup` (crea `backend/.env` desde `.env.example`) y `pnpm install`.
- Cuentas seed (tras `pnpm seed`): `laboratorio@seed.nodoo.local`, `distribuidora@seed.nodoo.local`, `hospital@seed.nodoo.local`, contraseña `Seed1234`.

## Q1 — Baseline: arrancar y navegar (US1–US12)

1. `pnpm start` (sube Postgres :5434, API :3001, web :4200).
2. `pnpm seed` (cadena demo idempotente, 3 organizaciones).
3. Abrir `http://localhost:4200`, registrarse o login con una cuenta seed.
4. Navegar: dashboard, productos/lotes, EPC (search por EPC/SKU/lote), historial de un EPC, equipo, organización, avisos.

**Expected**: la app carga sin errores de consola; un EPC del seed muestra historial con visibilidad cerrada (el owner ve toda la cadena; una org ajena no ve el EPC → `404`); los datos del seed son los deterministas de `seed.service.ts`.

## Q2 — Gatos de calidad de la constitución (todo cambio)

```bash
pnpm lint                 # oxlint (backend), 0 errores
pnpm test                 # vitest unit (backend), 39/39 en baseline
pnpm build                # nest build + ng build (typecheck)
pnpm --filter backend test:e2e   # e2e API (vitest + SWC), 6/6 en baseline
```

**Expected**: los cuatro en verde.

## Q3 — Suite web E2E (US16–US19, disponible tras S2-2)

1. Detener el stack de dev: `pnpm db:down` no es necesario (Postgres sigue); solo matar API+web (`pnpm dev` no corriendo) — los puertos :3001/:4200 deben estar libres.
2. `pnpm test:e2e:web`.
3. El bootstrap recrea `supply_chain_e2e` (drop/create + seed), arranca API (con `DB_NAME=supply_chain_e2e`) + web, y corre la suite Chromium.
4. Ver resultados: `e2e/playwright-report/` (HTML) y evidencia por historia en `e2e-evidence/sprint-NN/` (video + capturas).
5. La BD de desarrollo (`supply_chain_db`) no debe quedar modificada por la suite.

**Expected**: smoke test (S2-2) verde: login con cuenta seed, navegación a una pantalla principal, y una acción de ledger (p. ej. ver historial de un EPC del seed) con video/captura generados. `e2e-evidence/sprint-NN/` contiene la evidencia por historia y la tabla final al cierre.

## Q4 — Revisión visual (S2-3)

1. Con el stack de dev corriendo (Q1), capturar las pantallas actuales a 1440x900 y 390x844 (la suite/Playwright o capturas manuales).
2. Registrar antes/después con descripción de 2–3 líneas por pantalla en `e2e-evidence/sprint-NN/`.

**Expected**: cada pantalla principal tiene capturas en ambos viewports; el texto de UI, iconos y estados vacíos usan lenguaje neutro (FR-1510, sin vocabulario de sector salvo dato concreto del tenant).

## Q5 — Revisión de cumplimiento (S2-4)

1. Auditar el código as-built E1–E25 contra los FR de la spec (puntos de partida: las Notas de cumplimiento 1–6 de la spec).
2. Registrar cada desvío en `board.md`/sprints con su FR y el sprint de cierre propuesto (sin re-implementar en Sprint 02).

**Expected**: lista de desvíos con FR, descripción y sprint de cierre; nada re-implementado en Sprint 02.

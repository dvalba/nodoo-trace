# Implementation Plan: Plataforma de trazabilidad nodoo-trace (spec 001)

**Branch**: `develop` (feature dir `001-platform`) | **Date**: 2026-11-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-platform/spec.md`

## Summary

Spec-first de legado: la plataforma ya existe (E1–E25, US1–US14) y la spec la codifica como baseline. Lo único sin construir son dos bloques: la ingesta de documentos EPCIS 2.0 de terceros (US15, Sprint 04, pendiente de clarificación del canal) y la capa E2E con Playwright (US16–US19, Sprint 02). El trabajo del Sprint 02 es: planificar la spec (S2-1), montar la infraestructura Playwright + smoke test (S2-2), revisar visualmente las pantallas actuales (S2-3) y auditar el código existente contra la spec (S2-4, sin re-implementación).

Enfoque técnico: no se toca el stack existente (pnpm workspace, NestJS 12 + TypeORM + Postgres 16, Angular 21). Se añade un paquete `e2e/` con `@playwright/test` que ejecuta la suite web contra una BD e2e dedicada en la misma instancia local de Postgres, recreada y sembrada por ejecución; la evidencia de cierre vive en `e2e-evidence/` (fuera de git).

## Technical Context

**Language/Version**: TypeScript — backend Node.js v24 (@types/node 24), frontend Angular 21

**Primary Dependencies**: NestJS 12, TypeORM (pg), PostgreSQL 16, Joi, nodemailer, Angular 21; nueva: `@playwright/test` (solo paquete `e2e/`)

**Storage**: PostgreSQL 16 local (docker compose, puerto 5434); TypeORM `synchronize` cuando `NODE_ENV !== 'production'`

**Testing**: Vitest (unit + e2e API del backend, plugin SWC por `design:paramtypes`), oxlint (type-aware); nueva: Playwright (solo Chromium) para la suite web

**Target Platform**: Desarrollo local en Linux; Docker para Postgres; API :3001, web :4200

**Project Type**: Web application (API REST + SPA) en workspace pnpm de tres paquetes

**Performance Goals**: N/A — SaaS local de demo; la spec no fija objetivos de carga

**Constraints**: sin dependencias nuevas sin justificación de la spec; puertos no estándar intencionales (3001/5434/4200); backend ESM con imports `.js`; secretos solo en `backend/.env` (validado con Joi); la suite web no puede tocar la BD de desarrollo (FR-1505); la infra de tests no modifica la app (NFR-12)

**Scale/Scope**: un solo Postgres local; cadena demo de 3 organizaciones; 19 user stories (14 as-built + US15 EPCIS + US16–US19 capa E2E)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principio | Resultado |
|---|-----------|-----------|
| I | La spec manda | PASS — el código existe como baseline; la spec es la única fuente de verdad; la revisión S2-4 audita desvíos |
| II | Una tarea a la vez, vertical slice | PASS — S2-1..S2-4 entregan algo ejecutable de punta a punta (plan; suite smoke con evidencia; revisión visual antes/después; auditoría con desvíos registrados) |
| III | Stack cerrado | PASS — la única dependencia nueva es `@playwright/test` en `e2e/`, justificada por US16 (FR-1501) |
| IV | Backend ESM | PASS — Sprint 02 no modifica imports del backend |
| V | Todo requisito tiene test | PASS — US16 cubierto por el smoke; US17 lo será por sprint; los FR as-built ya tienen unit/e2e (Sprint 01: 39/39 unit, 6/6 e2e) |
| VI | Visibilidad cerrada del ledger | PASS — Sprint 02 no cambia la lógica de visibilidad; la verificarán los tests E2E (Sprint 03) |
| VII | Sin secretos en el repo | PASS — `e2e/` reutiliza `backend/.env` (git-ignored); no hay secretos nuevos |
| VIII | Idiomas | PASS — código/identificadores en inglés; plan, tasks y sprints en español |
| IX | Frontend delgado | PASS — no se añade lógica de negocio al frontend; NFR-12 prohíbe que la infra de tests lo modifique |
| X | Interoperabilidad EPCIS 2.0 | PASS — Sprint 02 no altera el ledger; la ingesta (US15) queda en Sprint 04 |
| XI | Plataforma genérica, agnóstica de sector | PASS — smoke y evidencia usan cuentas seed con nombres genéricos; la revisión visual (S2-3) verifica neutralidad (FR-1510) |

**Gate: PASS** — sin violaciones que justificar; la sección Complexity Tracking no se aplica.

## Project Structure

### Documentation (this feature)

```text
specs/001-platform/
├── spec.md              # Spec aprobada (2026-11-23)
├── plan.md              # Este archivo (/speckit.plan)
├── research.md          # Fase 0 (/speckit.plan)
├── data-model.md        # Fase 1 (/speckit.plan)
├── quickstart.md        # Fase 1 (/speckit.plan)
├── contracts/           # Fase 1 (/speckit.plan)
└── tasks.md             # Salida de /speckit.tasks
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── auth/            # US1: registro, verificación, login (JWT, guards)
│   ├── actor/           # US2: organización, onboarding, referencia de actor
│   ├── activity-types/  # US2: catálogo builtin de activities (8)
│   ├── operations/      # US2: 15 operaciones EPCIS, sugerencias, gating
│   ├── users/           # US3: miembros del equipo
│   ├── invitations/     # US3 + US14: invitaciones + envío de email (file/smtp)
│   ├── admin/           # US2: aprobación de organizaciones por staff
│   ├── products/        # US4: productos, lotes, búsqueda
│   ├── event-ledger/    # US5–US10 (+US15): eventos EPCIS, EPCs, gemelos (epics-core/)
│   └── notices/         # US11: avisos y acuses
├── test/                # e2e API (vitest + SWC, AppModule real)
└── docker-compose.yml   # Postgres 16 (:5434)

frontend/                # nodoo-trace-web (Angular 21, frontend delgado)
└── src/app/
    ├── pages/           # US12: login, registro, verificación, invitaciones, onboarding,
    │                    #      dashboard, productos, equipo, organización, staff, avisos, trace
    └── core/            # cliente API /api/v1, auth, modelos

e2e/                     # NUEVO (Sprint 02, US16–US19): paquete @playwright/test
├── playwright.config.ts # Chromium, video/screenshot/trace, baseURL :4200, webServer
├── scripts/             # bootstrap BD e2e (drop/create + seed) y copia de evidencia
├── tests/               # specs: smoke (S2-2) + un archivo por historia (Sprint 03+)
├── test-results/        # git-ignored (videos, capturas, traces)
└── playwright-report/   # git-ignored

e2e-evidence/            # NUEVO: evidencia de cierre por sprint (git-ignored)
└── sprint-NN/           # video + capturas clave + resultado por historia + tabla final

sprints/sprint-02.md     # narrativa del sprint + cierre
board.md                 # kanban de tareas
```

**Structure Decision**: workspace pnpm existente (`backend` + `nodoo-trace-web`) ampliado con un tercer paquete `e2e/` (FR-1501): los specs quedan fuera de cualquier `src/` para que los builders de unit tests no los recojan; resultados (`e2e/test-results/`, `e2e/playwright-report/`) y evidencia (`e2e-evidence/`) quedan fuera de git (FR-1503). La aplicación no se modifica (NFR-12): el único cambio en el workspace es el script raíz `pnpm test:e2e:web` (FR-1504).

## Complexity Tracking

> No se aplica: el Constitution Check pasa sin violaciones.

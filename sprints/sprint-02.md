# Sprint 02 — Plan de spec 001 + capa E2E Playwright + revisión de cumplimiento

Objetivo: descomponer la spec 001 (plataforma, que incluye la capa E2E) en tareas,
montar la capa de pruebas E2E con Playwright (infraestructura + smoke test), hacer la
revisión visual de las pantallas actuales y auditar el código existente contra la spec
(revisión de cumplimiento).

Tareas: S2-1, S2-2, S2-3, S2-4, S2-6, S2-5 (orden en `board.md`; se implementa una a la vez)

- S2-1: Plan de spec 001 (`specs/001-platform/plan.md` + `tasks.md`).
- S2-2: Infraestructura Playwright + smoke test (spec 001, US16, FR-1501..1505, FR-1507).
- S2-3: Revisión visual de las pantallas actuales (spec 001, US19, FR-1509/FR-1510): capturas 1440x900 y 390x844, antes/después + descripción de 2-3 líneas.
- S2-4: Revisión de cumplimiento E1–E25 vs. spec 001 (desvíos → board/sprints; sin re-implementación).
- S2-6: Cumplimiento FR-1507 de la suite web: la utility de capturas queda fuera de la suite por defecto (`testIgnore` + config y script propios `pnpm test:visual`) y el spec se reescribe sin `test.skip`/`waitForTimeout` (enmienda de spec FR-1502/FR-1504/FR-1509).
- S2-5: Cierre de Sprint 02 (Quality Gates + tabla final `e2e-evidence/sprint-02/summary.md` + cierre en este archivo).

Cierre (solo si se cumple TODO el criterio de cierre de la constitución, Quality Gates):
- Evidencia del sprint en `e2e-evidence/sprint-02/`: smoke (video + capturas) y revisión visual (antes/después + descripción). ✅
- La revisión de cumplimiento queda registrada en `board.md`/sprints con su FR y el sprint de cierre. ✅ (11 `#gap` G1–G6, G8–G12 → Sprints 03/04; G7 fuera de scope; O1/O2 documentadas)
- Quality Gates (2026-11-24): `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm --filter backend test:e2e` exit 0; `pnpm test:e2e:web` 1 passed / 0 skipped; gate (2) verde tras S2-6 (`pnpm test:visual` 6 passed). Ver `e2e-evidence/sprint-02/summary.md`. ✅
- **Cerrado**: 2026-11-24.

Retro: la suite E2E web entregada en el sprint (S2-2/S2-3) no se verificó contra sus
propios FR hasta el cierre: la utility de capturas se entregó con `test.skip`
condicional + esperas fijas (FR-1507) y el gate (2) solo se detectó en S2-5. Regla
añadida a AGENTS.md (Gotchas): el gate (2) aplica a TODOS los specs que corre
`pnpm test:e2e:web`, incluidas las utilities; lo que debe quedar fuera de esa corrida
se excluye por config (`testIgnore`) y corre con su propio script (`pnpm test:visual`),
nunca con `test.skip`.

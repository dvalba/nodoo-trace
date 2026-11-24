# Sprint 04 — Ingesta EPCIS 2.0 de terceros (US15) + gaps restantes de S2-4

Objetivo: resolver la clarificación del canal de importación (S4-1),
implementar la ingesta de documentos EPCIS 2.0 de terceros (FR-2001..2004) y
cerrar los gaps restantes que la revisión de cumplimiento S2-4 registró
(G6, G8, G9, G11, G12).

Tareas: S4-1, S4-2, S4-3 + gaps G6, G8, G9, G11, G12 (orden en `board.md`;
una a la vez)

- S4-1: Resolver la clarificación R6 (canal de importación + tratamiento de
  EPCs no comisionados) con el dueño; actualizar la spec.
- S4-2: [US15] Implementar la ingesta (FR-2001..FR-2004): dedupe por
  `LedgerEvent.eventUid` (data-model.md), `source` ≠ `platform`, proyección al
  twin con las reglas locales; tests unit + e2e API.
- S4-3: [US17] Test E2E de la historia de ingesta + evidencia
  `e2e-evidence/sprint-04/`.

## Scope de cierre (gaps de S2-4)

| Gap | FR | Desvío (código as-built) |
|-----|----|---------------------------|
| G6 | FR-204/205 (nota 3) | `accept`/`createCustom` sin 409 «solo una vez» aunque el contrato Swagger lo documenta |
| G8 | FR-1401 (nota 5) | `FileEmailSender` lee `process.env.MAIL_OUTBOX_PATH` en vez de `ConfigService` (default validado por Joi) |
| G9 | FR-D7, FR-1301 (nota 6) | El seed comisiona solo cases, sin EPCs de contenido: la separabilidad case/contenido no se ejercita en la demo |
| G11 | FR-D1, NFR-6 | Los eventos locales persisten `eventUid: null`; el dedupe de la ingesta (FR-2002) exige que cada evento lleve su eventUid |
| G12 | FR-1402 | Typo de `spec.md`: fallback `from` (`noreply@nodoo-trace.local` vs. `no-reply@nodoo.local` del código) — fix de documentación, sin cambio de código |

**G7** (nota 4, endpoint de rechazo de organizaciones, US2): fuera de scope por
decisión de la spec (Out of scope, spec l.601) — desvío documentado, sin sprint
de cierre.

Cierre (solo si se cumple TODO el criterio de cierre de la constitución, Quality Gates):
- `pnpm lint`, `pnpm test`, `pnpm build` en verde.
- `pnpm --filter backend test:e2e` en verde (incl. la historia de ingesta).
- `pnpm test:e2e:web` en verde con evidencia en `e2e-evidence/sprint-04/`.
- G6, G8, G9, G11 y G12 cerrados con sus tests.

Retro: (se rellena al cerrar el sprint: qué regla faltaba en AGENTS.md o en una skill)

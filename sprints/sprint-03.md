# Sprint 03 — Cierre de gaps de custody/visibilidad (spec 001) + tests E2E por historia

Objetivo: cerrar los gaps de ledger/custodia/visibilidad que la revisión de
cumplimiento S2-4 registró (G1–G5, G10) con sus tests unit/e2e API, y entregar
los tests E2E por historia del sprint (US17) con la evidencia de cierre (US18).
Primer sprint con user stories: aplica el criterio de cierre completo de la
constitución (Quality Gates).

Tareas: S3-1, S3-2, S3-3 (orden en `board.md`; una a la vez)

- S3-1: Cerrar los gaps de S2-4 de custody/visibilidad/ledger
  (FR-D3..FR-D6, FR-601, FR-602, FR-701, FR-803; notas 1–2 de la spec +
  hallazgos nuevos de la auditoría) con sus tests unit/e2e API.
- S3-2: [US17] Tests E2E por historia del sprint
  (`e2e/tests/us-NN-*.spec.ts`, un archivo por historia, nombres genéricos;
  camino feliz, validaciones, FR-D2..D6, aislamiento entre tenants, estados
  límite; FR-1506/FR-1507).
- S3-3: [US18] Evidencia de cierre en `e2e-evidence/sprint-03/` + tabla final
  (historia → test → resultado → enlace al video).

## Scope de cierre (gaps de S2-4)

| Gap | FR | Desvío (código as-built) |
|-----|----|---------------------------|
| G1 | FR-D4/FR-D5/FR-D6, FR-604/605/606 (nota 1) | `canRead` incluye producer y destination; `getHistory` devuelve el historial completo al custodian actual; `listEpc`/`search` con la cláusula de 4 roles (`event-ledger.service.ts`) |
| G2 | FR-D5, FR-602 (nota 2) | Receiving por botón desde la lista (`trace.ts`/`api.service.ts`), no por escaneo de la etiqueta física EPC |
| G3 | FR-602 + estado límite «recibir sin destinatario o ya recibido → 400» (spec l.169/384) | `findReceivableEpc` sin guardas de estado `in_transit` ni de destinatario: re-receiving posible |
| G4 | FR-601 + estado límite «embarcar un case in_transit → 400» (spec l.170) | `ship` sin guard de estado: un case `in_transit` puede re-embarcarse |
| G5 | FR-803 + estado límite «descendencia → 400» (spec l.201/385) | `aggregate` solo bloquea el ciclo directo, no la descendencia profunda (el proyector sí mantiene `parentId`) |
| G10 | FR-701 | `registerBusinessTransaction` no aplica el rol emisor (po: no-owner; desadv/bol: custodian) |

Antes de S3-1: cerrar la duda abierta de la spec (¿cámara o entrada manual del
EPC en el receiving, spec l.631) — condiciona el diseño de G2.

## Observaciones de spec (fix de documentación; no son gaps de código)

- **O1**: E19 no aparece en el mapeo de historias (US10=E18 → US11=E20/E21):
  SC-004 «cubre E1–E25» queda incompleto sin mapear E19 a una US o documentar
  su destino.
- **O2**: `data-model.md` l.11 cita `FR-210`/`FR-211` (US2) que no existen en
  `spec.md` (el equivalente actual es FR-206): referencia obsoleta.

Cierre (solo si se cumple TODO el criterio de cierre de la constitución, Quality Gates):
- `pnpm lint`, `pnpm test`, `pnpm build` en verde.
- `pnpm --filter backend test:e2e` en verde.
- `pnpm test:e2e:web` en verde: tests por historia (US17, FR-1506/1507) +
  evidencia por historia (US18, FR-1508) en `e2e-evidence/sprint-03/` con la
  tabla final.
- G1–G5 y G10 cerrados con sus tests; O1/O2 corregidas en la documentación de
  la spec.

Retro: (se rellena al cerrar el sprint: qué regla faltaba en AGENTS.md o en una skill)

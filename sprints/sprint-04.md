# Sprint 04 — Ingesta EPCIS 2.0 de terceros (US15) + gaps restantes de S2-4

Objetivo: resolver la clarificación del canal de importación (S4-1),
implementar la ingesta de documentos EPCIS 2.0 de terceros (FR-2001..2005) y
cerrar los gaps restantes que la revisión de cumplimiento S2-4 registró
(G6, G8, G9, G11, G12).

Tareas: S4-1, S4-2, S4-3 + gaps G6, G8, G9, G11, G12 (orden en `board.md`;
una a la vez)

- S4-1: Resolver la clarificación R6 (canal de importación + tratamiento de
  EPCs no comisionados) con el dueño; actualizar la spec. (Resuelto 2026-11-27:
  endpoint REST patrón EPCIS 2.0 Capture con credencial por organización; EPCs
  no comisionados → owner pasado por el endpoint, si no 400 sin efectos
  parciales. FR-2001 reformulado + FR-2005 + Clarifications de la spec.)
- S4-2: [US15] Implementar la ingesta (FR-2001..FR-2005): dedupe por
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
- `pnpm lint` (exit 0; 6 warnings preexistentes, ninguno en archivos del sprint),
  `pnpm test` (63/63), `pnpm build` (nest build + ng build OK) en verde. ✅ (2026-11-27)
- `pnpm --filter backend test:e2e` en verde: 28/28, incluye la historia de ingesta
  (`epcis-ingest.e2e-spec.ts` 12/12) y el onboarding 409 de G6. ✅ (2026-11-27)
- `pnpm test:e2e:web` en verde: 20/20 (us-06 ×7, us-07 ×3, us-08 ×4, us-12 ×1,
  us-15 ×4 — de ellos 1 de US17 —, us16-smoke ×1; 0 `test.skip`, 0 esperas fijas)
  con evidencia en `e2e-evidence/sprint-04/` (20 carpetas por test + `visual/despues`
  12 PNG + 6 videos + `summary.md`). `VISUAL_CAPTURES=despues pnpm test:visual`
  6 passed. ✅ (2026-11-27)
- G6, G8, G9, G11 y G12 cerrados con sus tests (notas de cierre en `board.md`;
  G7 fuera de scope por decisión de la spec). ✅ (2026-11-27)
- **Cerrado**: 2026-11-27. Con este sprint quedan cumplidas las user stories
  P0/P1/P2 de la spec 001 (US1–US19 salvo las explícitamente fuera de scope):
  **MVP cumplido**.

Retro (2026-11-27):

- **La abreviatura de EPC de la UI es un contrato de test**: la suite web
  selecciona opciones por etiqueta (`short(urn) · producto`) y `short()` toma los
  8 primeros caracteres del último segmento `:`. Los URNs de contenido del seed
  originales (`urn:nodoo:epc:11111111-…`) colisionaban los 10 entre sí → dos
  opciones idénticas en el multi-select de unpack y conteos de scope rotos
  (2 fallos de la primera corrida de S4-3). Regla añadida a `helpers.ts`
  (comentario del bloque de URNs): **cualquier URN que entre en un multi-select o
  un conteo de la UI debe tener prefijo de 8 caracteres único**.
- **El estado del seed es el contrato de la suite web**: G9 cambió la siembra
  (15 EPCs, PACKING, custodia propia del contenido) y arrastró conteos de scope
  y selecciones en us-06/us-07/us-08. La documentación del estado sembrado vive
  en el header de `e2e/tests/helpers.ts`; al tocar el seed, actualizar ese header
  y releer los specs que asierten conteos (patrón documentado ahora en el
  comentario de `SEED_EPC_IDS` de `seed.service.ts`).
- **Convención de destino de evidencia pendiente de sprint en sprint**: el
  destino de `visual-captures.spec.ts` seguía apuntando a `sprint-02` desde S2-3
  (S3-3 lo dejó sin ajustar). Ajustado a `sprint-04` en S4-3; queda pendiente
  ajustarlo al siguiente sprint (o hacerlo configurable por env sin violar
  FR-1507).
- **Documentos reales de terceros**: los fixtures EPCIS 2.0 se guardan tal cual
  (bytes del documento = payload del endpoint; la plataforma solo aporta el
  `epcMapping` de owners/productos, FR-2005). Cualquier transformación del
  fixture anularía el valor de US15: no «arreglar» fixtures para que pasen;
  ajustar el parser.

# Tablero — nodoo-trace (kanban de tareas)

> Nota (2026-11-24): este archivo no estaba en este clon (en el clon original
> era un symlink local al vault de Obsidian, ignorado por `.gitignore`);
> reconstruido a partir de `sprints/sprint-02-handoff.md`,
> `specs/001-platform/tasks.md` y `sprints/sprint-02.md`. Desde el 2026-11-24
> es un archivo regular bajo control de versiones. Una tarea a la vez; al
> terminar: gates verdes + checkbox en `tasks.md` + tarjeta movida aquí.

## Por hacer

- **S3-2** [Sprint 03 · US17 · FR-1506/FR-1507] Tests E2E por historia del
  sprint: `e2e/tests/us-NN-*.spec.ts` (un archivo por historia, nombres
  genéricos; camino feliz, validaciones, FR-D2..D6, aislamiento entre tenants,
  estados límite).
- **S3-3** [Sprint 03 · US18 · FR-1508] Evidencia de cierre en
  `e2e-evidence/sprint-03/` + tabla final (historia → test → resultado →
  video).

### Sprint 03 — Cierre de gaps de custody/visibilidad (orden: S3-1 → S3-2 → S3-3)

### Gaps de la revisión de cumplimiento S2-4 (cierre Sprint 03)

- **G1** [#gap · Sprint 03 · FR-D4/FR-D5/FR-D6, FR-604/605/606 · nota 1 de la spec]
  Sobre-exposición de la visibilidad cerrada: `canRead` (`event-ledger.service.ts`
  l.960-967) incluye el producer (FR-D6: un producer no-owner no ve nada) y el
  destinatario (FR-D5/605: solo EPC + producto del shipment a su favor);
  `getHistory` (l.620-636) devuelve el historial completo al custodian actual
  (FR-D4: solo su ventana de custodia; la rama `custodianWindow` solo es
  alcanzable para ajenos/ex-custodios); `listEpc` (l.516) y `search` (l.550)
  usan la cláusula de 4 roles producer∨owner∨custodian∨destination (FR-604).
  El desvío ya está documentado en Swagger (`epcs.controller.ts` l.54/306/326/337).
- **G2** [#gap · Sprint 03 · FR-D5, FR-602 · nota 2 de la spec]
  Receiving sin lectura de la etiqueta física: la UI recibe con un botón desde
  la lista (`trace.ts` l.313-315, l.1037-1040; `api.service.ts` l.114-117,
  `POST /epcs/:epc/receive`). Duda de spec l.631 **resuelta (2026-11-24,
  Clarifications)**: entrada manual del EPC como flujo primario + cámara del
  navegador opcional (getUserMedia + decodificador QR); el flujo manual es el
  testeado en la e2e por historia (US17), el de cámara se declara no ejecutable
  en el reporte (spec l.349).
- **G3** [#gap · Sprint 03 · FR-602 + estado límite «recibir sin destinatario o ya recibido → 400» (spec l.169/384) · hallazgo nuevo]
  Receiving sin guardas: `findReceivableEpc` (l.907-923) acepta
  owner∨custodian∨destination sin chequear estado `in_transit` ni destinatario
  → owner/custodian pueden «recibir» cases no in-transit y re-recibir
  (ReceivingEvent duplicado).
- **G4** [#gap · Sprint 03 · FR-601 + estado límite «embarcar un case in_transit → 400» (spec l.170) · hallazgo nuevo]
  Shipping sin guard de estado: `ship` (l.222-264) solo verifica custodia
  (`findCustodiedEpcs`) → un case `in_transit` puede re-embarcarse.
- **G5** [#gap · Sprint 03 · FR-803 + estado límite «descendencia → 400» (spec l.201/385) · hallazgo nuevo]
  Agregación solo bloquea el ciclo directo: `aggregate` (l.385-439) rechaza
  `childIds.includes(parentId)` pero no la descendencia profunda (A⊃B, B⊃C →
  agregar C bajo A), aunque el proyector sí mantiene `parentId` en los hijos.
- **G10** [#gap · Sprint 03 · FR-701 · hallazgo nuevo]
  Documentos transaccionales sin rol emisor: `registerBusinessTransaction`
  (l.309-343) solo verifica `findReadableEpc` + gating de la operación; no
  aplica el rol de la spec (po: no-owner; desadv/bol: custodian) → cualquier
  actor legible con la operación puede emitir.

### Gaps de la revisión de cumplimiento S2-4 (cierre Sprint 04)

- **G6** [#gap · Sprint 04 · FR-204/205 · nota 3 de la spec]
  Onboarding «solo una vez»: `accept` (`operations.service.ts` l.61-88) y
  `createCustom` (l.90-138) no rechazan con 409 si el actor ya tiene
  activities, aunque el contrato Swagger lo documenta.
- **G8** [#gap · Sprint 04 · FR-1401 · nota 5 de la spec]
  `FileEmailSender` lee `process.env.MAIL_OUTBOX_PATH` directamente
  (`file-email-sender.ts` l.17) en vez de `ConfigService`, sin pasar por el
  default validado por Joi.
- **G9** [#gap · Sprint 04 · FR-D7, FR-1301 · nota 6 de la spec]
  El seed comisiona solo cases (5 EPCs, `seed.service.ts` l.150-174), sin EPCs
  de contenido: la separabilidad case/contenido (FR-D7) no se ejercita en la
  demo.
- **G11** [#gap · Sprint 04 · FR-D1, NFR-6 · hallazgo nuevo]
  Los eventos locales persisten `eventUid: null` (`append`, l.805): FR-D1 pide
  eventUid único e inmutable en cada evento; el índice único de
  `LedgerEvent.eventUid` existe pero la plataforma nunca lo usa (lo requiere el
  dedupe de US15, FR-2002).
- **G12** [#gap · Sprint 04 · FR-1402 · hallazgo nuevo · documentación]
  Fallback `from` discordante: la spec dice `noreply@nodoo-trace.local`; el
  código usa `no-reply@nodoo.local` (`smtp-email-sender.ts`, default de
  `env.validation.ts`, `.env.example`) — typo de `spec.md`; corregir la spec,
  sin cambio de código.

## En curso

- **S3-1** [Sprint 03 · FR-D3..FR-D6, FR-601, FR-602, FR-701, FR-803 · notas 1–2]
  Cerrar los gaps de S2-4 de custody/visibilidad/ledger (G1, G2, G3, G4, G5,
  G10) con sus tests unit/e2e API. Precondición cumplida: duda de spec l.631
  resuelta (2026-11-24): entrada manual del EPC + cámara opcional. Análisis
  completado (2026-11-24): G1/G3/G4/G5/G10 en `event-ledger.service.ts`
  (+ Swagger en `epcs.controller.ts`), G2 en `trace.ts`/`api.service.ts`;
  implementación en curso, gap a gap.

## Hecho

- **Docs** [reproducibilidad de evidencia e2e] `e2e-evidence/` es git-ignorada y se
  **construye en cada máquina**: procedimiento para clon nuevo (setup +
  `playwright install chromium` + `pnpm test:e2e:web` +
  `VISUAL_CAPTURES=despues pnpm test:visual`) documentado en `e2e/README.md` (nuevo)
  + bullet en `AGENTS.md` (Gotchas). Verificado con corrida completa: smoke 1
  passed + 6 capturas passed (12 PNG «después» + 6 videos regenerados). No
  regenerable desde el HEAD: baseline `antes` congelada (pre-S2-3b) y
  `summary.md`/`NOTAS.md` escritos a mano (se mueven con tar).
- **T1–T11** [Sprint 01 · SDD + email provider] Sprint 01 completado
  (2026-11-23, commit `d0a4ed4`): scaffolding SDD (constitución, tablero,
  specs, skills) + spec 001 email provider `file`/`smtp` (RF-1..RF-5, hoy
  FR-1401..1405/US14). Tarjetas originales no están en este board (reconstruido
  el 2026-11-24); registro en `sprints/sprint-01.md`.
- **S2-5** [Sprint 02 · US18] Cierre de Sprint 02 (2026-11-24): Quality Gates
  verificados — lint/test/build/e2e API exit 0; `pnpm test:e2e:web` 1 passed /
  0 skipped; gate (2) verde tras S2-6; gate (3) evidencia US16 (video +
  captura) y US19 (12×2 PNG + 6 videos + NOTAS); gate (4) neutralidad (S2-3);
  gate (5) `tasks.md` S2-1..S2-6 + tarjetas. Tabla final y verificación de
  gates en `e2e-evidence/sprint-02/summary.md`; Cierre + Retro en
  `sprints/sprint-02.md`. **Sprint 02 cerrado.**
- **S2-6** [Sprint 02 · US16/US19 · FR-1502/FR-1504/FR-1507/FR-1509] Cumplimiento de
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
- **S2-4** [Sprint 02 · revisión de cumplimiento] Revisión de cumplimiento E1–E25 vs. spec 001:
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
- **S2-3** [Sprint 02 · US19 · FR-1509/FR-1510] Revisión visual de las 6
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
- **S2-2** [Sprint 02 · US16 · FR-1501..1508] Infraestructura Playwright +
  smoke test: paquete `e2e/`, BD dedicada `supply_chain_e2e` (drop/create/seed
  por ejecución), `pnpm test:e2e:web` con video/capturas/trace fuera de git,
  evidencia copiada a `e2e-evidence/sprint-02/`.
- **S2-1** [Sprint 02] Plan de la spec 001: `specs/001-platform/plan.md` +
  `specs/001-platform/tasks.md` (Constitution Check PASS).

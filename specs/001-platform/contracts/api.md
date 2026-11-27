# Contracts: spec 001

Fase 1 de `/speckit.plan`. La interfaz externa del proyecto es la **API REST** bajo `/api/v1` (JSON, auth por JWT bearer). Aquí se documenta la superficie as-built (baseline) que la capa E2E consumirá; el detalle de payloads lo sirve Swagger en `http://localhost:3001/api/v1/docs`.

## Transporte

- Base URL: `http://localhost:3001/api/v1` (la web en :4200 proxy-rea `/api/v1` → :3001, `frontend/proxy.conf.json`).
- Auth: `Authorization: Bearer <JWT>` salvo los endpoints públicos (register, login, verification/resend, verify, preview).
- Errores: `401` no autenticado, `403` sin permiso/operación no habilitada, `404` cuando el recurso o la relación de visibilidad no existe para el tenant (visibilidad cerrada: nunca `403` para "no te pertenece"), `409` conflictos (p. ej. receiving dos veces, pendiente de auditoría S2-4).

## Endpoints por módulo (as-built)

### Auth — `auth` (US1)
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/auth/register` | Crea actor + owner (pendiente verificación) + envía email de verificación (transaccional) |
| POST | `/auth/login` | Login, devuelve JWT |
| GET | `/auth/me` | Sesión actual |
| POST | `/auth/verification/resend` | Reenvía verificación (cooldown; solo sin verificar) |

### Invitaciones + verificación — `invitations` (US1, US3)
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/invitations` | Invita un miembro (email + role) |
| POST | `/invitations/verify` | Verifica token (doble uso: verificación de registro y aceptación previa) |
| GET | `/invitations/:token/preview` | Vista previa de la invitación (público) |
| POST | `/invitations/accept` | Acepta la invitación (crea el user verificado) |

### Actor / organización — `actors` (US2)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/actors` | Lista de actores (propio + referencias permitidas) |
| GET | `/actors/:actorId` | Info del actor; la referencia de otro actor devuelve id, name, activities y operaciones derivadas (FR-206) |

### Admin (staff) — `admin` (US2)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/admin/actors/pending` | Organizaciones pendientes de aprobación |
| PATCH | `/admin/actors/:id/approval` | Aprueba/rechaza organización |

### Actividad — `activity-types` (US2)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/activity-types` | Catálogo builtin (8) |

### Operaciones EPCIS — `actor/operations` (US2, US8)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/actor/operations` | Lista de operaciones habilitadas para la org (gating por activities) |
| POST | `/actor/operations/suggestions` | Sugerencias de operaciones según contexto |
| POST | `/actor/operations/accept` | Acepta una sugerencia |
| POST | `/actor/operations/custom` | Crea operación personalizada |

### Usuarios (equipo) — `users` (US3)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/users` | Lista de miembros |
| PATCH | `/users/:userId` | Cambia role / datos |
| DELETE | `/users/:userId` | Elimina miembro (no el owner) |

### Productos y lotes — `products` (US4)
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/products` | Crea producto (SKU unique por org) |
| GET | `/products` | Lista/búsqueda |
| GET | `/products/:productId` | Detalle |
| POST | `/products/:productId/batches` | Crea lote |
| GET | `/products/:productId/batches` | Lotes del producto |

### Ledger / EPCs — `epcs` (US5–US10)
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/epcs` | Comisiona/registra un EPC (case) |
| GET | `/epcs` | Lista de EPCs de la org |
| GET | `/epcs/search?epc=&sku=&lot=` | Búsqueda por EPC, SKU o lote (US5/US6) |
| GET | `/epcs/:epc` | Estado actual (twin) |
| GET | `/epcs/:epc/history` | Historial con visibilidad cerrada (FR-D2..D6) |
| POST | `/epcs/:epc/receive` | Receiving (destino; completa la custodia) |
| POST | `/epcs/:epc/ship` | Ship (custodia → tránsito, dirigido a un actor) |
| POST | `/epcs/:epc/invoice` | Invoice |
| POST | `/epcs/:epc/purchase-order` | Documento purchase-order |
| POST | `/epcs/:epc/despatch-advice` | Documento despatch-advice |
| POST | `/epcs/:epc/bill-of-lading` | Documento bill-of-lading |
| POST | `/epcs/:epc/inspect` | Inspección |
| POST | `/epcs/:epc/aggregate` | Agrega contenido al case |
| POST | `/epcs/:epc/disaggregate` | Desagrega |
| POST | `/epcs/:epc/pack` | Pack |
| POST | `/epcs/:epc/unpack` | Unpack (mover contenido entre cases) |
| POST | `/epcs/:epc/associate` | Asocia EPCs |
| POST | `/epcs/:epc/disassociate` | Desasocia |
| POST | `/epcs/transform` | Transforma (inputs → outputs) |

> Todas las operaciones de ledger están gateadas por `@RequiresOperation` (gating por activities del onboarding) y emiten un `LedgerEvent` EPCIS con `eventUid`.

### Avisos — `notices` / `products/:productId/notices` (US11)
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/products/:productId/notices` | Crea aviso de producto |
| GET | `/products/:productId/notices` | Lista avisos del producto |
| GET | `/notices/:noticeId` | Detalle del aviso |
| POST | `/notices/:noticeId/ack` | Acuse de recibo |
| GET | `/notices/:noticeId/acks` | Lista de acuses |

### Ingesta EPCIS 2.0 — `epcis` (US15, FR-2001..FR-2005)
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/epcis/capture` | Captura un documento EPCIS 2.0 de un tercero (patrón EPCIS 2.0 Capture, R6 resuelto 2026-11-27) |

- Autenticado con la credencial de la organización que empuja (sin gating por `@RequiresOperation`; FR-2001 solo exige credencial). La organización llantera es la `actorId` de todos los eventos importados.
- Body: el documento EPCIS 2.0 **sin modificar** como body completo (solo si todos los EPCs referenciados ya están comisionados) **o** el wrapper `{ document, epcMapping }` donde `epcMapping` lleva `{ ownerActorId, productId }` por cada EPC no comisionado (FR-2005). Sin el owner de un EPC no comisionado → `400` y sin efectos parciales (todo el documento se importa en una sola transacción).
- Eventos persistidos con `source='external'` y `eventUid` = `eventID` del documento (o digest determinista `urn:nodoo:ingest:sha256` cuando el evento no la tiene); re-púsh con `eventUid` ya existente → ignorado (FR-2002, idempotente).
- Proyección al twin con las reglas locales (FR-2004); los EPCs pre-creados por FR-2005 nunca se re-crean.
- Respuesta `201`: `{ imported, skipped, epcsCreated }`.

### Storage — `storage`
- Controlador placeholder sin endpoints (futuro ingreso masivo desde ERP). La ingesta EPCIS de US15 (Sprint 04) ya no entra aquí: vive en `epcis-capture.controller.ts` (módulo `event-ledger`), decisión S4-2.

## Contrato del paquete `e2e/` (nuevo, Sprint 02)

No es una interfaz de dominio, es el contrato operativo de la capa de pruebas (FR-1501..1505, FR-1507, FR-1508):

- **Script raíz**: `pnpm test:e2e:web` → `pnpm --filter e2e test` → `playwright test` (Chromium, `baseURL http://localhost:4200`).
- **Precondición**: `pnpm db:up` y stack de dev detenido (quickstart).
- **Bootstrap por run** (script de `e2e/`): drop/create `supply_chain_e2e` + `DB_NAME=supply_chain_e2e pnpm seed` + API arrancada con el mismo override.
- **Artefactos**: `e2e/test-results/` (video/screenshot/trace por test) y `e2e/playwright-report/`; copia por historia en `e2e-evidence/sprint-NN/<test>/` + `summary.md` al cierre. Todo git-ignored.
- **Reglas de specs**: un archivo por historia, nombres genéricos, sin `test.skip` ni `waitForTimeout` fijo, wait sobre condiciones explícitas.

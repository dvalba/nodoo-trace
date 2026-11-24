# Data Model: spec 001

Fase 1 de `/speckit.plan`. Documenta el modelo de datos as-built (baseline E1–E25). **El Sprint 02 no modifica el modelo**: no hay entidades nuevas; la única adición estructural del repo es la infra de tests (`e2e/`, fuera del dominio).

## Entidades del dominio (as-built)

### Organization (actor / tenant)
- `id` (UUID), `name`, `contactEmail`, `contactName`, `phone` (optional), `logoUrl` (optional), `status` (`PENDING_APPROVAL` | `APPROVED`), `createdAt`, `updatedAt`
- **Onboarding** (US2, FR-201..208): el actor crea la organización desde su cuenta de propietario; selecciona `activities` (tipologías); el estado pasa de `PENDING_APPROVAL` a `APPROVED` por el staff (admin).
- Un actor tiene exactamente una organización; un `User` pertenece a una organización (relación `User → Organization`).
- La referencia de otro actor se resuelve por `contactEmail` (US2, FR-210) y expone solo `name` (FR-211, visibilidad cerrada).

### User
- `id`, `email` (unique por organización), `passwordHash`, `name`, `role` (`OWNER` | `MANAGER` | `OPERATOR`), `organizationId` (FK), `emailVerifiedAt`, `createdAt`, `updatedAt`
- `role` controla permisos (US3, FR-302..304): `OWNER`/`MANAGER` gestionan miembros; `OPERATOR` opera sin gestión de equipo.
- Validaciones: email único por org; el `OWNER` no puede ser eliminado ni degradado (US3).

### Invitation
- `id`, `organizationId` (FK), `email`, `role` ofrecido, `token` (unique), `status` (`PENDING` | `ACCEPTED` | `REVOKED` | `EXPIRED`), `invitedBy` (FK User), `createdAt`, `acceptedAt` (nullable)
- Ciclo de vida (US3): crear → verificar (email) → aceptar → user creado con `emailVerifiedAt`.
- Un solo `PENDING` por email+org (FR-305).

### Product
- `id`, `organizationId` (FK), `name`, `sku` (unique por org), `description` (optional), `createdAt`, `updatedAt`
- CRUD con SKU/lote (US4, FR-401..404).

### Batch (lote)
- `id`, `productId` (FK), `organizationId` (FK), `lotNumber` (unique por producto), `quantity` (optional), `status`, `createdAt`
- Un producto tiene muchos lotes (US4, FR-405).

### Epc (unidad rastreable)
- `id`, `organizationId` (FK, propietario/comisionador), `epc` (string, unique), `productId` (FK), `batchId` (FK, lote), `status` (derivable del twin: `IN_CUSTODY`, `IN_TRANSIT`, `RECEIVED`, `VOID`...), `createdAt`
- Serialización del case (US5, FR-501..503). Un EPC pertenece a una org (comisionador) y a un lote.
- Búsqueda por EPC, SKU o lote (US5/US6, FR-504..506).

### LedgerEvent (evento EPCIS 2.0)
- `id`, `eventUid` (unique, clave de dedupe), `organizationId` (FK, emisor/tenant), `eventType` (enum EPCIS: `ObjectEvent`, `TransactionEvent`, `TransformationEvent`, `aggregation`...), `eventTime`, `epc` (string, FK lógico a Epc), `operation` (referencia a la operación aplicada), `action` (`ADD` | `OBSERVE` | `DELETE`), `disposition` (optional), `recordedBy` (org), `source` (`platform` | `external`), `payload` (JSON, campos EPCIS: `bizStep`, `bizLocation`, `urn`...), `createdAt`
- **Visibilidad cerrada** (US7, FR-D2..D6): el owner ve toda la cadena; el custodiante ve su ventana de custodia (incl. identidad del owner) pero no la cadena aguas arriba; el destino ve solo el caso en tránsito a su nombre; una org que ya no es owner no ve nada; una org sin relación recibe `404` (no `403`).
- Ingesta externa (US15, FR-2001..2004): `eventUid` dedupe; `source = 'external'`; EPCs no comisionados no crean unidades.

### Twin (gemelo digital, estado actual por EPC)
- Proyección mantenida por `twin-projector.ts`: estado actual, custodiante actual, ubicación/disposición actual, últimos eventos. Derivado de `LedgerEvent` (no fuente de verdad). US10, FR-D1.

### Operation (catálogo de operaciones EPCIS)
- `id`, `organizationId` (FK, para custom), `name`, `code`, `epcisEventType` (mapeo a tipo de evento), `group` (ship/receive/invoice/document/inspect/aggregate/transform...), `isCustom` (bool), `enabled`, `sortOrder`
- 15 operaciones builtin en 6 grupos + custom (US2/US8, FR-801..806). Gating por `activities` de la organización (onboarding).

### ActivityType (tipología de actividad)
- `id`, `code` (unique), `name`, `description`, `isBuiltin`
- Catálogo builtin de 8 (US2, FR-201). Seleccionadas en onboarding.

### Notice (aviso de producto)
- `id`, `organizationId` (FK), `productId` (FK, opcional), `title`, `body`, `severity`, `status` (`OPEN` | `ACKNOWLEDGED`...), `createdAt`
- Avisos + acuses (US11, FR-1101..1104).

### Ack (acuse de recibo)
- `id`, `noticeId` (FK), `userOrganizationId` (FK, org que acusa), `acknowledgedAt`, `comment` (optional)
- Detalle, ack, listar (US11, FR-1105).

## Relaciones (resumen)

```
Organization 1—N User
Organization 1—N Invitation
Organization 1—N Product
Product      1—N Batch
Organization 1—N Epc
Epc          N—1 Batch
Epc          N—1 Product (vía Batch/ProductId)
Organization 1—N LedgerEvent
Epc          1—N LedgerEvent
Organization 1—N Operation (custom)
Organization 1—N ActivityType (selección en onboarding, many-to-many implícito)
Product      1—N Notice
Notice       1—N Ack
Epc          1—1 Twin (proyección, derivada)
```

## Estados principales

- **Organization**: `PENDING_APPROVAL` → `APPROVED` (admin).
- **Invitation**: `PENDING` → `ACCEPTED` | `REVOKED` | `EXPIRED`.
- **Epc / Twin**: `IN_CUSTODY` → `IN_TRANSIT` (ship) → `RECEIVED` (receive); `VOID`/desagregado según operación.
- **Notice**: `OPEN` → `ACKNOWLEDGED` (por ack).

## Validaciones clave (uniqueness / integridad)

- `User.email` unique por `Organization`.
- `Product.sku` unique por `Organization`.
- `Batch.lotNumber` unique por `Product`.
- `Epc.epc` unique (global).
- `LedgerEvent.eventUid` unique (dedupe ingesta).
- `Invitation.token` unique.
- `ActivityType.code` unique.

## Impacto del Sprint 02

- **Ninguna entidad nueva ni cambio de esquema.** La capa E2E solo lee/escribe a través de la API REST existente contra la BD e2e (mismo esquema por `synchronize`).
- **Sprint 04 (US15)**: no requiere nueva entidad; reutiliza `LedgerEvent` con `source='external'` y dedupe por `eventUid` (R6 de research.md).

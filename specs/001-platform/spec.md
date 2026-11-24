# Feature Specification: Plataforma de trazabilidad nodoo-trace

**Feature Branch**: `develop`
**Created**: 2026-11-23
**Status**: Aprobada (2026-11-23)
**Input**: Spec-first legado: la plataforma ya existe (E1–E25) y su comportamiento se codifica aquí como baseline antes de planificar. La sección «Requisitos nuevos / a implementar» recoge lo pendiente de construir: la ingesta EPCIS 2.0 de terceros (US15) y la capa E2E con Playwright (US16–US19).

## Contexto y objetivo

nodoo-trace es una plataforma de trazabilidad de cadena de suministro basada en EPCIS 2.0. Es un pnpm workspace con dos paquetes: `backend/` (NestJS 12 + TypeORM + PostgreSQL 16) y `frontend/` (Angular 21, paquete `nodoo-trace-web`).

El flujo normal de Spec Kit es spec → plan → implement. Aquí se invierte: el código existe, así que esta spec es la baseline de todo lo construido (historias E1–E25). El orden de trabajo posterior:

1. **Plan**: `plan.md` + `tasks.md` descomponen cada historia en tareas ejecutables.
2. **Revisión de cumplimiento**: se audita el código contra cada FR y se registran los desvíos en `board.md`/sprints — no se re-implementa nada en este paso.
3. **Sprints**: se cierran los gaps y se construyen los requisitos nuevos.

Los requisitos codifican el comportamiento correcto (reglas de negocio acordadas + as-built). Los desvíos del código se reportan como gaps en la revisión de cumplimiento, no como requisitos nuevos.

## Naturaleza de la plataforma

nodoo-trace es una plataforma SaaS multi-tenant de trazabilidad **genérica, agnóstica de sector**: no es una plataforma farmacéutica, sanitaria, ni de ningún sector en particular. Los datos del seed (cuentas `laboratorio@`, `distribuidora@`, `hospital@seed.nodoo.local`) son **solo datos de demostración** de un ejemplo de cadena; no definen el producto ni su público. La interfaz y los tests usan **lenguaje neutro** (organización, actor, producto, lote, unidad, envío, recepción, custodia, evento); el vocabulario de un sector solo proviene de los datos de una organización concreta. El aislamiento entre tenants es una propiedad que los tests deben verificar (US17, FR-1506; forma parte del criterio de cierre de sprint de la constitución).

## Clarifications

### Session 2026-11-23

- Q: ¿Se migra el flujo de trabajo actual a la forma de Spec Kit (templates oficiales, `plan.md`/`tasks.md` generados por comandos)? → A: Sí, migrar todo al formato de Spec Kit (contenido y estructura).
- Q: ¿Cómo se trata el código existente (E1–E25)? → A: Spec-first legado: se especifica primero como baseline, se planifica, y después se hace una revisión de cumplimiento código vs. spec (no se re-implementa).
- Q: ¿Cuántas specs se crean para el código existente? → A: Una sola spec 001 de toda la plataforma, organizada por vertical slices y sprints explícitos.
- Q: ¿Qué principios lleva la constitución? → A: Los 8 principios actuales + frontend delgado + interoperabilidad EPCIS 2.0.
- Q: ¿Dónde quedan los requisitos que no están construidos? → A: Sección «Requisitos nuevos / a implementar» dentro de la spec 001; los desvíos del código no son requisitos, salen en la revisión de cumplimiento.
- Q: ¿Quién ve qué en el ledger? → A: Regla de visibilidad cerrada: el propietario ve el historial completo; el custodio solo su ventana de custodia (incluida la identidad del propietario), nunca la cadena upstream; el destinatario de un case en tránsito lo ve solo como shipment a su favor y el receiving se ejecuta escaneando la etiqueta física EPC; un producer que ya no es propietario no ve nada; los ajenos reciben 404, nunca 403.
- Q: ¿Un case, su contenido y su pallet son el mismo gemelo? → A: No. Un case reutilizable y cada unidad de contenido son gemelos propios (cada uno con su EPC e historial) ligados por agregación, y son completamente separables: el contenido puede moverse entre cases y un case puede devolverse vacío. El envase desechable/indistinto no se serializa: sin EPC, sin gemelo, sin historial.
- Q: ¿Qué terminología usa la spec? → A: Vocabulario estándar de cadena de suministro / EPCIS 2.0 (commissioning, shipment, receiving, custody, aggregation, deaggregation, transformation, disposition, recall). Prohibido inventar términos.
- Q: ¿Dónde vive Playwright? → A: En un paquete `e2e/` aparte del workspace pnpm (no dentro de `frontend/`), con `@playwright/test`; los specs quedan fuera de cualquier `src/`.
- Q: ¿Cómo se aíslan los datos de la suite E2E? → A: Base de datos e2e dedicada en la misma instancia local de Postgres (nombre de BD distinto): drop/create + `pnpm seed` por ejecución, con la API arrancada con override del nombre de BD por env; nunca toca la base de desarrollo.
- Q: ¿La evidencia E2E se commitea? → A: No: `e2e-evidence/` y los resultados de Playwright (test-results, report) quedan fuera de git (`.gitignore`); los videos son pesados.

## Usuarios / actores

- **Manufacturer / producer** (supplier, manufacturer): comisiona EPCs, transforma, inspecciona.
- **Distributor / wholesaler**: custodia, agrupa, emite documentos (PO, despatch advice, BOL).
- **Destination** (retailer u otra organización de destino): recibe cases en tránsito escaneando la etiqueta física.
- **Transporter** (local/intl carrier): custodia en tránsito, BOL.
- **Warehouse**: custodia, inspección, agrupación.
- **Staff de la plataforma**: aprueba organizaciones, ve pendientes.
- **Operador**: consume la UI web y el seed de demo.

## User Scenarios & Testing

Cada historia es una vertical slice: entrega ejecutable de punta a punta. P1 es el journey crítico de trazabilidad.

### User Story 1 — Acceso: registro, verificación y login (E1, E2) - Priority: P1

**Why this priority**: sin acceso no hay nada; es la puerta de toda la plataforma.

**Independent Test**: registrar una organización desde la UI, verificar el email con el enlace y loguearse.

**Acceptance Scenarios**:

- **Given** una organización sin cuenta, **When** el administrador se registra (razón social, número de organización, nombre, email y password del admin), **Then** el sistema crea en una sola transacción el actor (estado `pending_approval`), el usuario admin (rol `owner`, estado `email_unverified`) y la invitación de verificación del owner, y envía el email de verificación.
- **Given** el registro anterior, **When** el envío del email falla, **Then** el sistema igual persiste el registro y responde `emailSent: false` con la opción de reenviar.
- **Given** un owner registrado sin verificar, **When** pide reenviar la verificación, **Then** el sistema re-emite el token respetando el cooldown de reenvío (409 `RETRY_LATER` con `retryAfterMinutes`); si ya está verificado responde 409.
- **Given** un owner registrado, **When** usa el enlace de verificación, **Then** el sistema valida el token (HMAC), marca la invitación como aceptada, y el usuario pasa a `active` si la organización ya está aprobada, o a `awaiting_approval` si no; repetir el enlace no falla (idempotente).
- **Given** un usuario `active` de una organización `approved`, **When** hace login con credenciales válidas, **Then** el sistema devuelve un JWT y los datos del usuario; si el email no está verificado, está pendiente de aprobación, o está suspendido/baneado, responde 401 con código distinto (`EMAIL_UNVERIFIED`, `AWAITING_APPROVAL`, `ACCOUNT_DISABLED`).
- **Given** un login, **When** el email no existe o el password es incorrecta, **Then** el sistema responde el mismo mensaje `Invalid credentials` (no distingue cuál de los dos).
- **Given** un usuario autenticado, **When** pide su perfil, **Then** el sistema devuelve el usuario, su actor con sus activities y las operaciones derivadas.

**Edge Cases**:

- Reenvío durante cooldown → 409 `RETRY_LATER`; email ya verificado → 409; token expirado → 404.

### User Story 2 — Organización, onboarding y gating (E5, E6, E7, E8) - Priority: P1

**Why this priority**: las activities son las que habilitan las operaciones EPCIS (gating); sin ellas no se puede comisionar ni custodiar.

**Independent Test**: una organización aprobada recorre el onboarding (operaciones → sugerencia → aceptar) y puede comisionar; otra sin la activity correspondiente recibe 403.

**Acceptance Scenarios**:

- **Given** cualquier llamada, **When** pide el catálogo de activities (`GET /activity-types`), **Then** el sistema devuelve las 8 activities builtin (code, name, description) sin autenticación.
- **Given** un owner, **When** pide el catálogo de operaciones (`GET /actor/operations`), **Then** el sistema devuelve las 15 operaciones EPCIS (code, label, group, sortOrder) agrupadas.
- **Given** un owner, **When** selecciona operaciones, **Then** el sistema devuelve hasta 3 combinaciones de activities builtin (máx. 3 activities por combinación) que cubren todas las operaciones seleccionadas, ordenadas por menos activities, luego menos operaciones extra, luego code; la sugerencia no persiste nada.
- **Given** un owner, **When** acepta una combinación de activities, **Then** el sistema valida que cubren todas las operaciones seleccionadas (400 si no) y las asigna al actor, habilitando las operaciones correspondientes.
- **Given** un owner, **When** crea una activity personalizada (nombre + operaciones), **Then** el sistema valida que las operaciones existen (400 si no), crea el tipo global con code `custom-<slug>-<suffix>` y lo asigna al actor.
- **Given** un usuario autenticado, **When** pide la lista de organizaciones (`GET /actors`), **Then** el sistema devuelve solo las `approved` (id, name) como picker de destinatarios; con `GET /actors/:id` devuelve la referencia del actor (id, name, activities, operaciones derivadas).
- **Given** un staff, **When** aprueba una organización pendiente (`PATCH /admin/actors/:id/approval`), **Then** el sistema pone el actor en `approved` y, en la misma transacción, activa todos sus usuarios `awaiting_approval`; la re-aprobación es un no-op.
- **Given** un staff, **When** lista organizaciones pendientes, **Then** el sistema devuelve id, nombre y número de organización.

**Edge Cases**:

- Aceptar activities sin cubrir todas las operaciones → 400.
- Custom activity con operación inexistente → 400.
- Aceptar activities cuando el actor ya tiene activities → el contrato lo documenta como 409 «solo una vez» (ver Nota de cumplimiento 3).

### User Story 3 — Equipo e invitaciones (E3, E4) - Priority: P2

**Why this priority**: un actor de la cadena necesita miembros; el journey demo funciona con un solo usuario por organización.

**Independent Test**: el owner invita un email, el invitado previewea y acepta el enlace, y aparece en la lista de miembros con sus roles.

**Acceptance Scenarios**:

- **Given** un owner, **When** invita un email con roles, **Then** el sistema rechaza si el email ya existe en la plataforma o en la organización (409), respeta el cooldown de reissue (409 `RETRY_LATER`), re-emite una única invitación pendiente por email+organización, almacena solo el hash del token y envía el email (la invitación se persiste aunque el envío falle, `emailSent: false`).
- **Given** un enlace de invitación, **When** cualquier persona lo usa, **Then** el sistema devuelve el preview sin autenticación: organización, email, roles, expiración y si el email ya tiene cuenta.
- **Given** un invitado sin cuenta, **When** acepta el enlace con nombre completo y password, **Then** el sistema crea el usuario `active` con los roles invitados y marca la invitación como aceptada; si el email ya tiene cuenta responde 400 (usar el enlace de verificación); si la organización no está aprobada responde 403.
- **Given** una invitación, **When** expira (después de `INVITATION_EXPIRES_IN`) o se usa, **Then** el token deja de valer: el sistema responde 404 con el mismo mensaje que un token inexistente (no revela si existió).
- **Given** un miembro de la organización, **When** lista miembros, **Then** el sistema devuelve los usuarios con roles y estado.
- **Given** un owner o admin, **When** suma roles a un miembro, **Then** el sistema los aplica de forma aditiva y nunca asigna el rol `owner`.
- **Given** un owner o admin, **When** elimina un miembro, **Then** el sistema lo prohíbe si es el owner de la organización o si es él mismo.

**Edge Cases**:

- Aceptar la invitación de una organización no aprobada → 403.
- Verificar un token cuyo email no tiene usuario en el actor → 400.
- Eliminar al owner o a uno mismo → 409.

### User Story 4 — Catálogo: productos, lotes y búsqueda (E9, E10, E12) - Priority: P1

**Why this priority**: todo EPC cuelga de un producto (y opcionalmente un lote); sin catálogo no hay qué serializar.

**Independent Test**: crear producto + lote, y buscarlos por nombre, SKU y batchCode.

**Acceptance Scenarios**:

- **Given** un owner, **When** crea un producto (SKU, nombre), **Then** el sistema lo persiste; el SKU es único por organización (409 en colisión).
- **Given** un owner, **When** crea un lote para su producto (batchCode), **Then** el sistema lo persiste; el código es único por producto (409).
- **Given** una organización, **When** lista o busca sus productos y lotes, **Then** el sistema devuelve solo los propios; los de otras organizaciones dan 404.
- **Given** una organización, **When** busca (por EPC, nombre/SKU o batchCode), **Then** el sistema devuelve los EPCs, productos y lotes propios que matchean, dentro de su scope de visibilidad.

**Edge Cases**:

- SKU repetido de otra organización → válido (el índice es por owner).
- BatchCode repetido de otro producto → válido.

### User Story 5 — Serialización: commissioning (E11) - Priority: P1

**Why this priority**: es el nacimiento del gemelo digital; sin EPC no hay trazabilidad.

**Independent Test**: una organización con la operation de commissioning comisiona un EPC y el gemelo aparece.

**Acceptance Scenarios**:

- **Given** una organización con la operation `object:commissioning`, **When** comisiona un EPC para un producto (y opcionalmente lote), **Then** el sistema crea el gemelo digital: `producer` = `owner` = `custodian` = la organización comisionante, estado `active`, identidad URN, y registra un CommissioningEvent en el ledger.
- **Given** una organización sin la operation, **When** intenta comisionar, **Then** el sistema responde 403 (gating por activity).

**Edge Cases**:

- Case sin contenido: un gemelo sin children es válido (FR-D7).

### User Story 6 — Custodia: shipment, receiving, invoice y visibilidad (E13, E14) - Priority: P1

**Why this priority**: es el corazón de la trazabilidad: el case viaja, cambia de manos, y cada actor ve exactamente lo que debe ver.

**Independent Test**: el producer comisiona y embarca a un distribuidor; el distribuidor recibe escaneando el EPC y factura a la organización de destino; cada actor consulta el historial y ve solo su scope.

**Acceptance Scenarios**:

- **Given** el custodian de un case `active` con la operation `object:shipping`, **When** lo embarca con un destinatario, **Then** el sistema registra un ShippingEvent y el gemelo pasa a `in_transit` con el destinatario.
- **Given** el destinatario de un case `in_transit` con la operation `object:receiving`, **When** escanea la etiqueta física EPC del case, **Then** el sistema registra un ReceivingEvent: `custodian` = destinatario, sin `destination`, estado `active`.
- **Given** el owner de un case con la operation `transaction:inv`, **When** emite una factura con `ownershipTransferTo`, **Then** el sistema registra un TransactionEvent y el owner del gemelo pasa a la organización destinataria; sin `ownershipTransferTo` el owner pasa a la emisora.
- **Given** un actor, **When** lista EPCs, **Then** el sistema devuelve solo los de su scope: el owner los suyos; el custodian los de su custodia; el destinatario los `in_transit` a su favor; el producer que ya no es owner no ve nada.
- **Given** un custodian, **When** ve el gemelo de un EPC, **Then** no ve el producer ni la cadena upstream; **Given** el destinatario, **Then** ve solo el EPC y el producto del shipment a su favor.
- **Given** el owner, **When** pide el historial de un EPC, **Then** el sistema devuelve todo; **Given** un custodian, **Then** solo su ventana de custodia (incluida la identidad del owner); **Given** el destinatario antes de recibir, **Then** 404; **Given** una organización ajena, **Then** 404, nunca 403.

**Edge Cases**:

- Recibir un case sin destinatario o ya recibido → 400.
- Embarcar un case `in_transit` → 400.
- Factura sin `ownershipTransferTo` → el owner pasa a la emisora.

### User Story 7 — Documentos transaccionales: PO, despatch advice, BOL (E15) - Priority: P2

**Why this priority**: enriquecen el ledger con la dimensión comercial; no alteran el gemelo (solo la invoice).

**Independent Test**: emitir PO / despatch advice / BOL para un EPC y verlos en el historial.

**Acceptance Scenarios**:

- **Given** una organización con la operation correspondiente, **When** emite un purchase order (`transaction:po`, no-owner), un despatch advice (`transaction:desadv`, custodian) o un bill of lading (`transaction:bol`, custodian), **Then** el sistema registra un TransactionEvent con `bizTransactionType` y `bizTransactionId` en el ledger; solo la invoice altera el gemelo (US6).

**Edge Cases**:

- Documento sin la operation correspondiente → 403.

### User Story 8 — Inspección y agregación (E16) - Priority: P2

**Why this priority**: agrupa contenido en cases reutilizables y registra calidad; es la base del modelo case/contenido.

**Independent Test**: inspeccionar un EPC y agregar varios EPCs de contenido bajo un case padre (y viceversa).

**Acceptance Scenarios**:

- **Given** el custodian con la operation `object:inspecting`, **When** inspecciona un EPC como passed/failed, **Then** el sistema registra un InspectionEvent y el estado pasa a `active` (passed) o `damaged` (failed).
- **Given** el custodian con la operation de agregación, **When** agrupa EPCs del mismo producto bajo un case padre (pack / `aggregation:ADD`), **Then** el sistema registra un AggregationEvent y liga padre e hijos manteniendo los gemelos separados; la desagregación (unpack / `aggregation:DELETE`) quita el vínculo.

**Edge Cases**:

- Agregar EPCs de productos distintos → 400.
- Agregar un EPC bajo sí mismo (descendencia) → 400.

### User Story 9 — Asociación y transformación (E17) - Priority: P3

**Why this priority**: casos avanzados de valor agregado; el journey core funciona sin ellos.

**Independent Test**: asociar/desasociar EPCs y transformar inputs en un producto nuevo.

**Acceptance Scenarios**:

- **Given** el custodian con la operation de asociación, **When** asocia o desasocia EPCs, **Then** el sistema registra un AssociationEvent sin alterar el gemelo.
- **Given** el custodian con la operation `transformation:transforming`, **When** transforma EPCs de entrada en un producto nuevo, **Then** el sistema registra un TransformationEvent: los inputs pasan a `consumed` y los outputs son gemelos nuevos (`producer` = `owner` = `custodian` = la organización que transforma, estado `active`).

**Edge Cases**:

- Transformación sin outputs válidos → 400.

### User Story 10 — Gemelo digital: estado actual por EPC (E18) - Priority: P1

**Why this priority**: el gemelo es la cara pública del ledger (estado actual, no historial); toda la UI lo consume.

**Independent Test**: tras cada operación del journey (US5–US9), el gemelo refleja el estado esperado.

**Acceptance Scenarios**:

- **Given** el ledger, **When** se consulta el gemelo de un EPC, **Then** el sistema devuelve el estado actual proyectado por el twin-projector a partir de cada tipo de evento (commissioning, receiving, shipping, inspection, transaction/invoice, aggregation, transformation); el gemelo no es una fuente de verdad independiente del ledger.

**Edge Cases**:

- EPC no comisionado → no existe gemelo (404).

### User Story 11 — Avisos y acuses: notices y acks (E20, E21) - Priority: P2

**Why this priority**: el recall es el caso de uso que da valor a la trazabilidad hacia el consumidor.

**Independent Test**: el owner publica un recall contra un lote/EPC; las organizaciones relacionadas lo ven y lo ackean.

**Acceptance Scenarios**:

- **Given** el owner de un producto, **When** publica un recall o advisory (título, descripción, objetivo: lote y/o lista de EPCs), **Then** el sistema persiste el aviso con sus vínculos.
- **Given** un aviso, **When** se consulta, **Then** el sistema lo muestra al owner del producto y a las organizaciones con relación vigente (owner, custodian, producer) sobre un EPC objetivo o sobre el lote objetivo; los ajenos reciben 404.
- **Given** una organización que ve un aviso, **When** lo ackea, **Then** el sistema registra un único ack por aviso+organización (idempotente).
- **Given** un aviso, **When** se listan sus acks, **Then** el sistema los devuelve solo a quien tiene acceso al aviso.

**Edge Cases**:

- Aviso sin lote y sin EPCs → 400.
- Aviso que apunta a un lote de otra organización → 404.

### User Story 12 — Frontend (E22, E23, E24) - Priority: P1

**Why this priority**: es el único cliente de la plataforma; los journeys de US1–US11 deben ser navegables.

**Independent Test**: desde cero (sin API manual) completar el journey seed: login → onboarding → comisionar → ship → receive → invoice → notice → ack.

**Acceptance Scenarios**:

- **Given** la UI, **When** se usa, **Then** no contiene lógica de negocio: consume la REST API `/api/v1` y la visibilidad, el gating y el estado los decide el backend (frontend delgado).
- **Given** la UI, **When** se navega, **Then** están disponibles: login, registro, verificación, invitación (preview/aceptar), onboarding (operaciones → sugerencia → aceptar/custom), dashboard, productos, equipo, organización, aprobación de staff, avisos y trazabilidad (trace).
- **Given** la página de trace, **When** se abre un EPC, **Then** se ve el gemelo, el historial dentro del scope del actor y las acciones que puede ejecutar según sus operations y el estado del case.

**Edge Cases**:

- Ninguno propio: los errores de dominio los produce la API y la UI los muestra.

### User Story 13 — Seed de demo (E25) - Priority: P3

**Why this priority**: permite probar y demo la plataforma sin construir datos a mano.

**Independent Test**: `pnpm seed` dos veces sobre la misma BD da el mismo resultado (idempotente) y el journey es navegable con las 3 cuentas.

**Acceptance Scenarios**:

- **Given** una BD, **When** se ejecuta el seed, **Then** el sistema crea, como datos de demostración de un ejemplo de cadena, una cadena demo idempotente de 3 organizaciones (un producer, un distribuidor y una organización de destino) con IDs deterministas, desde el commissioning hasta un notice; repetir el seed no duplica datos.

**Edge Cases**:

- Seed con `.env` ausente o BD caída → falla con mensaje claro (no media creación).

### User Story 14 — Proveedor de correo conmutable file/smtp (antes spec 001, RF-1..RF-5) - Priority: P2

**Why this priority**: el acceso (US1) y las invitaciones (US3) dependen de él; ya está construido y se incorpora aquí como baseline.

**Independent Test**: arrancar con `EMAIL_PROVIDER=file` escribe el outbox JSON; con `smtp` entrega por SMTP; con config inválida el arranque falla antes de servir.

**Acceptance Scenarios**:

- **Given** la configuración, **When** el proveedor no está definido o es `file`, **Then** el sistema usa `FileEmailSender`, que escribe cada mensaje en un outbox JSON (`MAIL_OUTBOX_PATH`, default `backend/.mail-outbox.json`); cuando es `smtp` usa `SmtpEmailSender` (nodemailer).
- **Given** `SmtpEmailSender`, **When** envía, **Then** mapea `from` (default `SMTP_FROM`, fallback `noreply@nodoo-trace.local`), `to`, `subject`, `text` y `html`, con puerto default 587 y `secure` default false, y propaga cualquier error de `sendMail` sin capturarlos.
- **Given** la validación de env, **When** `EMAIL_PROVIDER=smtp`, **Then** exige `SMTP_HOST`, `SMTP_USER` y `SMTP_PASS` no vacía (error nombrando las variables faltantes); cuando es `file` o ausente no exige `SMTP_*`.
- **Given** un valor inválido de `EMAIL_PROVIDER`, **When** arranca la app, **Then** la validación (Joi) rechaza el arranque nombrando la variable.
- **Given** el env, **When** se documenta, **Then** `.env.example` incluye la sección `# EMAIL` con cada variable y su default, y `pnpm setup` la propaga al `.env`.

**Edge Cases**:

- `SMTP_PASS` vacía → rechazo (no «presente pero vacía»).
- Falla al escribir el outbox (disco) → error de envío propagado.

### User Story 15 — Ingesta de documentos EPCIS 2.0 de terceros (NUEVO) - Priority: P3

**Why this priority**: es el único requisito no construido; permite que la plataforma ingrese eventos generados fuera (otras plataformas, EPCIS canonical).

**Independent Test**: importar un EPCISDocument de terceros y ver que sus eventos aparecen en el historial sin duplicarse en re-importaciones.

**Acceptance Scenarios**:

- **Given** un documento EPCIS 2.0 de un tercero (conjunto de eventos con enlaces EPC), **When** se importa, **Then** el sistema crea o extiende el historial de los EPCs referenciados. [NEEDS CLARIFICATION: canal de importación — archivo manual, endpoint REST o suscripción EPCIS poll/notify]
- **Given** un evento importado, **When** su `eventUid` ya existe, **Then** el sistema lo ignora (importación idempotente).
- **Given** un evento importado, **When** se persiste, **Then** lleva `source` distinto de `platform`.
- **Given** eventos importados, **When** se proyectan, **Then** el gemelo se actualiza con las mismas reglas que los eventos locales.

**Edge Cases**:

- Evento que referencia un EPC no comisionado en la plataforma → crear el EPC con los datos del evento, o rechazar (NEEDS CLARIFICATION junto con el canal).
- Documento vacío o malformado → 400 sin efectos parciales.

### User Story 16 — Infraestructura E2E con Playwright (NUEVO) - Priority: P1

**Why this priority**: sin infraestructura no hay tests web, videos ni criterio de cierre de sprint.

**Independent Test**: `pnpm test:e2e:web` ejecuta un smoke test (login con una cuenta seed + dashboard) y produce video, screenshots y trace en una carpeta fija fuera de git.

**Acceptance Scenarios**:

- **Given** el paquete `e2e/` con Playwright configurado, **When** se ejecuta la suite, **Then** cada test deja un video `.webm`, screenshots y trace (al menos en fallo) en una carpeta fija fuera de git.
- **Given** la suite, **When** arranca, **Then** parte del estado conocido de la base de datos e2e dedicada (recreada y sembrada con `pnpm seed` por ejecución), es determinista y repetible, y no modifica la base de datos de desarrollo ni deja datos basura.
- **Given** el smoke test, **When** inicia sesión con una cuenta seed aprobada y verificada, **Then** llega al dashboard de la organización sin errores de consola.
- **Given** la raíz del workspace, **When** se ejecuta `pnpm test:e2e:web`, **Then** se corre la suite Playwright web y nada más; `pnpm test` sigue corriendo solo los unit tests del backend.

**Edge Cases**:

- Navegador Chromium no instalado → el fallo se reporta explícitamente (no se omite el test en silencio).
- Re-ejecución consecutiva de la suite → mismos resultados, sin acumulación de datos.

### User Story 17 — Tests E2E por historia de usuario del sprint (NUEVO) - Priority: P1

**Why this priority**: el video de cada test debe contar la historia completa de principio a fin; es lo que hace verificable el cierre de sprint.

**Independent Test**: un archivo de test por historia del sprint, con nombre legible y genérico (ej. `us-06-destination-receives-shipment.spec.ts`), pasa y cubre los casos requeridos.

**Acceptance Scenarios**:

- **Given** un sprint con user stories, **When** se derivan sus tests E2E, **Then** cada historia tiene un único archivo de test con nombre legible y genérico (sin vocabulario de sector).
- **Given** un test de historia, **When** se ejecuta, **Then** cubre: camino feliz, errores de validación, visibilidad según las reglas del ledger (FR-D2..FR-D6), aislamiento entre tenants y estados límite.
- **Given** la suite, **When** se revisa, **Then** no contiene `test.skip` ni esperas arbitrarias (`waitForTimeout` fijo); las esperas usan condiciones explícitas.

**Edge Cases**:

- Un caso que no puede ejecutarse (p. ej. escaneo de la etiqueta QR con cámara) → se declara explícitamente en el reporte; nunca se omite en silencio.

### User Story 18 — Evidencia por historia y tabla de cierre (NUEVO) - Priority: P1

**Why this priority**: el cierre del sprint debe ser visible y verificable.

**Independent Test**: al cerrar un sprint, `e2e-evidence/sprint-NN/` contiene el video, las capturas clave y el resultado por historia, y existe la tabla final.

**Acceptance Scenarios**:

- **Given** un sprint cerrado, **When** se revisa `e2e-evidence/sprint-NN/`, **Then** para cada historia hay su video `.webm`, sus capturas clave y el resultado del test.
- **Given** el mismo cierre, **When** se entrega la tabla final, **Then** tiene una fila por historia: historia → test → resultado → enlace al video.

**Edge Cases**:

- Ninguno propio: la carpeta y la tabla son artefactos del cierre, no del producto.

### User Story 19 — Revisión visual de la interfaz (NUEVO) - Priority: P2

**Why this priority**: la interfaz debe verse limpia, simple, intuitiva y válida para cualquier sector.

**Independent Test**: para una pantalla del sprint se toman capturas en 1440x900 y 390x844, se leen con la herramienta Read, se corrigen los problemas y quedan capturas antes/después con descripción.

**Acceptance Scenarios**:

- **Given** una pantalla del sprint a revisar, **When** se toman capturas en escritorio (1440x900) y móvil (390x844) con Playwright y se examinan con la herramienta Read, **Then** se evalúa: jerarquía visual, espaciado, alineación, contraste, estados vacíos, estados de carga y error, textos truncados, consistencia entre pantallas y apariencia neutra/agnóstica de sector.
- **Given** problemas detectados, **When** se corrigen, **Then** los cambios de UI son pequeños y justificados (sin funcionalidades ni componentes que la spec no pida), y quedan guardadas las capturas «antes» y «después» con una descripción de 2-3 líneas de qué mejoró.
- **Given** la revisión completa del sprint, **When** se cierra, **Then** ninguna pantalla del sprint contiene referencias a un sector específico.

**Edge Cases**:

- Ninguno propio: los cambios de UI se validan contra la spec del sprint.

### Edge Cases (transversales)

- Receiving de un case sin destinatario o ya recibido → 400.
- Agregar EPCs de productos distintos o en descendencia → 400.
- Aviso sin lote y sin EPCs → 400; aviso a lote ajeno → 404.
- Verificación de email cuyo email no tiene usuario en el actor → 400.
- Aceptar invitación de organización no aprobada → 403.
- Reenvío de verificación ya verificada → 409.
- Importación de `eventUid` duplicado → ignorar.
- Organización sin activities → todas las operaciones EPCIS rechazan con 403.
- Unidad de contenido sin parent (suelta) → gemelo válido; case devuelto vacío → gemelo válido.

## Requirements

### Reglas de dominio (transversales)

- **FR-D1**: EL SISTEMA persiste cada evento del ledger una única vez, con `eventUid` único e inmutable y `source` de origen; los eventos nunca se modifican ni se borran.
- **FR-D2**: EL SISTEMA responde `404` (nunca `403`) a una organización sin relación con un EPC (ni owner, ni custodian, ni producer, ni destinatario) para cualquier operación, historial, gemelo, producto o aviso sobre ese EPC.
- **FR-D3**: CUANDO el owner actual consulta el historial de un EPC, EL SISTEMA devuelve todo el historial (toda la cadena).
- **FR-D4**: CUANDO un custodian consulta el historial de un EPC, EL SISTEMA devuelve todos los eventos de su ventana de custodia (incluida la identidad del owner) y NUNCA la cadena upstream (custodios anteriores, producers, transportistas).
- **FR-D5**: CUANDO el destinatario de un case en tránsito consulta, EL SISTEMA le muestra ese case solo como shipment a su favor (EPC + producto); el receiving se ejecuta escaneando la etiqueta física EPC, no desde una lista.
- **FR-D6**: CUANDO un producer que ya no es owner consulta un EPC, EL SISTEMA no le muestra nada sobre ese EPC.
- **FR-D7**: EL SISTEMA trata un case reutilizable y cada unidad de contenido como gemelos separados (cada uno con su EPC e historial) ligados por agregación, completamente separables: el contenido puede moverse entre cases (unpack/transform) y un case puede dejarse atrás o devolverse vacío.
- **FR-D8**: EL SISTEMA NO serializa el envase desechable o indistinto (bolsa de plástico, pallet genérico): sin EPC, sin gemelo, sin historial; solo tiene significado físico/logístico.
- **FR-D9**: EL SISTEMA rechaza con `403` cualquier operación EPCIS (ship/receive/invoice/aggregate/transform) que la organización no tenga habilitada por sus activities (gating configurado en onboarding); una organización ajena al EPC recibe `404` (FR-D2).
- **FR-D10**: EL SISTEMA identifica cada EPC por una URN única en la plataforma (`urn:nodoo:epc:...`).

### Functional Requirements

#### US1 — Acceso

- **FR-101**: CUANDO una organización se registra, EL SISTEMA crea en una transacción atómica el actor (`pending_approval`), el usuario admin (rol `owner`, estado `email_unverified`) y la invitación de verificación del owner, y envía el email de verificación.
- **FR-102**: SI el envío del email de verificación falla, EL SISTEMA persiste el registro igual y responde `emailSent: false` con la opción de reenviar.
- **FR-103**: CUANDO un owner registrado pide reenviar la verificación, EL SISTEMA re-emite el token respetando el cooldown `INVITATION_RESEND_INTERVAL` (409 `RETRY_LATER` con `retryAfterMinutes`); SI el email ya está verificado, EL SISTEMA responde 409.
- **FR-104**: CUANDO un owner usa el enlace de verificación, EL SISTEMA valida el token (HMAC), marca la invitación como aceptada y pasa el usuario a `active` si la organización ya está aprobada, o a `awaiting_approval` si no; REPITIENDO el enlace EL SISTEMA no falla (idempotente).
- **FR-105**: CUANDO un usuario hace login, EL SISTEMA responde 401 con código `EMAIL_UNVERIFIED`, `AWAITING_APPROVAL` o `ACCOUNT_DISABLED` según su estado, y devuelve JWT + datos del usuario solo si es `active` de una organización `approved`.
- **FR-106**: EL SISTEMA responde el mismo mensaje de error para email inexistente y para password incorrecta.
- **FR-107**: CUANDO un usuario autenticado pide su perfil, EL SISTEMA devuelve el usuario, el actor con sus activities y las operaciones derivadas.

#### US2 — Organización y gating

- **FR-201**: EL SISTEMA expone públicamente (`GET /activity-types`) las 8 activities builtin (code, name, description).
- **FR-202**: CUANDO un owner lista operaciones, EL SISTEMA devuelve las 15 operaciones EPCIS (code, label, group, sortOrder) agrupadas.
- **FR-203**: CUANDO un owner selecciona operaciones, EL SISTEMA devuelve hasta 3 combinaciones de activities builtin (máx. 3 por combinación) que cubren todas las operaciones seleccionadas, ordenadas por menos activities, luego menos operaciones extra, luego code; EL SISTEMA no persiste la sugerencia.
- **FR-204**: CUANDO un owner acepta activities, EL SISTEMA valida que cubren todas las operaciones seleccionadas (400 si no) y las asigna al actor, habilitando las operaciones correspondientes.
- **FR-205**: CUANDO un owner crea una activity personalizada, EL SISTEMA valida que las operaciones existen (400 si no), crea el tipo global con code `custom-<slug>-<suffix>` y lo asigna al actor.
- **FR-206**: CUANDO un usuario autenticado lista organizaciones, EL SISTEMA devuelve solo las `approved` (id, name); CUANDO pide la referencia de un actor, EL SISTEMA devuelve id, name, activities y operaciones derivadas.
- **FR-207**: CUANDO un staff aprueba una organización pendiente, EL SISTEMA pone el actor en `approved` y activa en la misma transacción sus usuarios `awaiting_approval`; la re-aprobación es un no-op.
- **FR-208**: CUANDO un staff lista organizaciones pendientes, EL SISTEMA devuelve id, nombre y número de organización.

#### US3 — Equipo e invitaciones

- **FR-301**: CUANDO un owner invita un email, EL SISTEMA rechaza con 409 si el email ya existe en la plataforma o en la organización, respeta el cooldown de reissue (409 `RETRY_LATER`), re-emite una única invitación pendiente por email+organización, almacena solo el hash del token y envía el email; SI el envío falla, EL SISTEMA persiste la invitación con `emailSent: false`.
- **FR-302**: CUANDO se usa un enlace de invitación, EL SISTEMA devuelve el preview (organización, email, roles, expiración, si ya hay cuenta) sin autenticación.
- **FR-303**: CUANDO un invitado acepta con nombre y password, EL SISTEMA crea el usuario `active` con los roles invitados y marca la invitación como aceptada; SI el email ya tiene cuenta, EL SISTEMA responde 400; SI la organización no está aprobada, responde 403.
- **FR-304**: CUANDO una invitación expira o se usa, EL SISTEMA invalida el token: 404 con el mismo mensaje que un token inexistente.
- **FR-305**: CUANDO un miembro lista el equipo, EL SISTEMA devuelve los usuarios de la organización con roles y estado.
- **FR-306**: CUANDO un owner o admin suma roles a un miembro, EL SISTEMA los aplica de forma aditiva y NUNCA asigna el rol `owner`.
- **FR-307**: CUANDO un owner o admin elimina un miembro, EL SISTEMA prohíbe eliminar al owner de la organización o a uno mismo.

#### US4 — Catálogo

- **FR-401**: CUANDO un owner crea un producto, EL SISTEMA lo persiste; SI el SKU ya existe para esa organización, EL SISTEMA responde 409.
- **FR-402**: CUANDO un owner crea un lote, EL SISTEMA lo persiste; SI el batchCode ya existe para ese producto, EL SISTEMA responde 409.
- **FR-403**: EL SISTEMA expone solo los productos y lotes propios de la organización; los ajenos dan 404.
- **FR-404**: CUANDO una organización busca por EPC, nombre/SKU o batchCode, EL SISTEMA devuelve las coincidencias propias dentro de su scope de visibilidad.

#### US5 — Commissioning

- **FR-501**: CUANDO una organización con `object:commissioning` comisiona un EPC, EL SISTEMA crea el gemelo (`producer` = `owner` = `custodian` = comisionante, `active`, URN) y registra un CommissioningEvent.
- **FR-502**: SI la organización no tiene la operation, EL SISTEMA responde 403.

#### US6 — Custodia y visibilidad

- **FR-601**: CUANDO el custodian con `object:shipping` embarca un case `active` con destinatario, EL SISTEMA registra un ShippingEvent y el gemelo pasa a `in_transit` con el destinatario.
- **FR-602**: CUANDO el destinatario de un case `in_transit` con `object:receiving` escanea la etiqueta física EPC, EL SISTEMA registra un ReceivingEvent: `custodian` = destinatario, sin `destination`, `active`.
- **FR-603**: CUANDO el owner con `transaction:inv` emite una factura, EL SISTEMA registra un TransactionEvent y el owner del gemelo pasa a `ownershipTransferTo` si está presente, o a la emisora si no.
- **FR-604**: CUANDO un actor lista EPCs, EL SISTEMA devuelve solo los de su scope (owner: los suyos; custodian: los de su custodia; destinatario: `in_transit` a su favor; producer no-owner: ninguno).
- **FR-605**: CUANDO se consulta el gemelo, EL SISTEMA lo filtra por scope: el custodian no ve el producer ni la cadena upstream; el destinatario solo ve EPC + producto del shipment a su favor.
- **FR-606**: CUANDO se consulta el historial, EL SISTEMA devuelve: al owner, todo; al custodian, su ventana de custodia (incluida la identidad del owner); al destinatario, 404 hasta que recibe; a una organización ajena, 404.

#### US7 — Documentos

- **FR-701**: CUANDO una organización con la operation correspondiente emite `transaction:po` (no-owner), `transaction:desadv` (custodian) o `transaction:bol` (custodian), EL SISTEMA registra un TransactionEvent con `bizTransactionType` y `bizTransactionId`; SOLO la invoice altera el gemelo.

#### US8 — Inspección y agregación

- **FR-801**: CUANDO el custodian con `object:inspecting` inspecciona un EPC, EL SISTEMA registra un InspectionEvent y el estado pasa a `active` (passed) o `damaged` (failed).
- **FR-802**: CUANDO el custodian con la operation de agregación agrupa EPCs del mismo producto bajo un case padre (`aggregation:ADD` / pack), EL SISTEMA registra un AggregationEvent y liga padre e hijos manteniendo los gemelos separados; la desagregación (`aggregation:DELETE` / unpack) quita el vínculo.
- **FR-803**: SI la agregación mezcla productos distintos o crea una descendencia, EL SISTEMA responde 400.

#### US9 — Asociación y transformación

- **FR-901**: CUANDO el custodian asocia o desasocia EPCs, EL SISTEMA registra un AssociationEvent sin alterar el gemelo.
- **FR-902**: CUANDO el custodian con `transformation:transforming` transforma inputs en un producto nuevo, EL SISTEMA registra un TransformationEvent: inputs → `consumed`, outputs → gemelos nuevos (`producer` = `owner` = `custodian` = transformante, `active`).

#### US10 — Gemelo digital

- **FR-1001**: CUANDO se consulta el gemelo de un EPC, EL SISTEMA devuelve el estado actual proyectado por el twin-projector a partir del ledger (commissioning, receiving, shipping, inspection, transaction/invoice, aggregation, transformation); el gemelo no es fuente de verdad independiente del ledger.

#### US11 — Notices y acks

- **FR-1101**: CUANDO el owner de un producto publica un recall/advisory, EL SISTEMA persiste el aviso con sus objetivos (lote y/o lista de EPCs).
- **FR-1102**: CUANDO se consulta un aviso, EL SISTEMA lo muestra al owner del producto y a las organizaciones con relación vigente sobre un EPC o lote objetivo; las ajenas reciben 404.
- **FR-1103**: CUANDO una organización ackea un aviso visible, EL SISTEMA registra un único ack por aviso+organización (idempotente).
- **FR-1104**: CUANDO se listan los acks de un aviso, EL SISTEMA los devuelve solo a quien tiene acceso al aviso.

#### US12 — Frontend

- **FR-1201**: EL SISTEMA frontend es un cliente delgado: consume la REST API `/api/v1` y no contiene lógica de negocio (visibilidad, gating y estado los decide el backend).
- **FR-1202**: EL SISTEMA frontend expone los journeys: login, registro, verificación, invitación, onboarding, dashboard, productos, equipo, organización, aprobación de staff, avisos y trace.
- **FR-1203**: CUANDO se abre la página de trace en un EPC, EL SISTEMA muestra el gemelo, el historial dentro del scope del actor y las acciones ejecutables según sus operations y el estado del case.

#### US13 — Seed

- **FR-1301**: CUANDO se ejecuta el seed, EL SISTEMA crea, como datos de demostración de un ejemplo de cadena, una cadena demo idempotente de 3 organizaciones (un producer, un distribuidor y una organización de destino) con IDs deterministas, desde commissioning hasta notice; REPITIENDO el seed EL SISTEMA no duplica datos.

#### US14 — Email provider

- **FR-1401**: SI `EMAIL_PROVIDER` está ausente o es `file`, EL SISTEMA usa `FileEmailSender` (outbox JSON en `MAIL_OUTBOX_PATH`, default `backend/.mail-outbox.json`); CUANDO es `smtp`, usa `SmtpEmailSender` (nodemailer).
- **FR-1402**: CUANDO `SmtpEmailSender` envía, EL SISTEMA mapea `from` (default `SMTP_FROM`, fallback `noreply@nodoo-trace.local`), `to`, `subject`, `text` y `html` (default puerto 587, `secure` false) y propaga el error de `sendMail` sin capturarlos.
- **FR-1403**: CUANDO `EMAIL_PROVIDER=smtp`, EL SISTEMA valida (Joi) que `SMTP_HOST`, `SMTP_USER` y `SMTP_PASS` estén presentes y no vacías (error nombrando las variables); CUANDO es `file` o ausente, NO las exige.
- **FR-1404**: SI `EMAIL_PROVIDER` tiene un valor inválido, EL SISTEMA rechaza el arranque nombrando la variable.
- **FR-1405**: EL SISTEMA documenta la sección `# EMAIL` completa en `.env.example` y `pnpm setup` la propaga al `.env`.

### Key Entities

- **Actor (organización)**: id, name, organizationNumber, status (`pending_approval`/`approved`/`rejected`/`suspended`), activities.
- **User**: id, email (único), passwordHash, fullName, actorId, platformRoles (`user`/`staff`), roles (`owner`/`admin`/`member`/`viewer`), status (`email_unverified`/`awaiting_approval`/`active`/`suspended`/`banned`).
- **Invitation**: id, actorId, email, roles, invitedById, tokenHash, status (`pending`/`accepted`), expiresAt.
- **ActivityType**: code (único), name, description, isCustom, isActive, sortOrder, operations.
- **Operation**: code, label, group, sortOrder.
- **Product**: id, owner actor, sku, name; único `(owner, sku)`.
- **Batch**: id, productId, batchCode; único `(product, batchCode)`.
- **Epc (gemelo digital)**: id, URN (único), productId, batchId, parentId, producerActorId, ownerActorId, custodianActorId, destinationActorId, status (`active`/`in_transit`/`damaged`/`consumed`), commissionedAt.
- **LedgerEvent**: id, type, eventTime, recordedAt, actorId, batchId, bizStep, bizTransactionType/Id, disposition, source, eventUid (único), payload.
- **EventEpc**: vínculo evento↔EPC con rol (`observed`, `parent`, `child`, `input`, `output`, `associated`); PK `(eventId, epcId, role)`.
- **ProductNotice**: id, productId, batchId, type (`recall`/`advisory`), title, description, createdByActorId, epcs.
- **ProductNoticeAck**: aviso+actor (único).
- **Mensaje de email**: to, subject, text, html.

## Requisitos nuevos / a implementar

Requisitos sin construir, agrupados por bloque. Los desvíos del código existente NO van aquí: salen de la revisión de cumplimiento.

### Capa E2E con Playwright (US16–US19)

- **FR-1501**: EL SISTEMA instala y configura Playwright en un paquete `e2e/` aparte del workspace pnpm (`@playwright/test`); los specs quedan fuera de cualquier `src/` para que los builders de unit tests no los recojan.
- **FR-1502**: `playwright.config.ts` configura `video: 'on'`, `screenshot: 'on'`, `trace: 'retain-on-failure'` y `baseURL: http://localhost:4200`, y excluye de la corrida por defecto la utility de capturas de pantallas (FR-1509) mediante `testIgnore`.
- **FR-1503**: Los resultados de Playwright (videos, screenshots, traces, informe) se guardan en carpetas fijas fuera de git (`e2e/test-results/`, `e2e/playwright-report/`) y la evidencia de cierre en `e2e-evidence/`; todas añadidas a `.gitignore`.
- **FR-1504**: Existe el script raíz `pnpm test:e2e:web` que ejecuta la suite web; NO se mezcla con `pnpm test` (unit tests del backend). La utility de capturas (FR-1509) corre con su propio script raíz `pnpm test:visual`, no con `test:e2e:web`.
- **FR-1505**: La suite usa una base de datos e2e dedicada en la misma instancia local de Postgres (nombre de BD distinto): se recrea y siembra por ejecución (`pnpm seed`), con la API arrancada con override del nombre de BD por env; parte de un estado conocido, es determinista y repetible, y no modifica la base de desarrollo ni deja basura.
- **FR-1506**: Un archivo de test por historia de usuario del sprint, con nombre legible y genérico (sin vocabulario de sector). Los casos se derivan de las historias y criterios de aceptación de la spec y de las reglas de visibilidad del ledger (FR-D2..FR-D6), e incluyen camino feliz, errores de validación, permisos, aislamiento entre tenants y estados límite.
- **FR-1507**: La suite NO usa `test.skip` ni esperas arbitrarias (`waitForTimeout` con valores fijos); las esperas se hacen sobre condiciones explícitas (texto, selector, red).
- **FR-1508**: Por historia se entrega evidencia en `e2e-evidence/sprint-NN/` (raíz del repo, fuera de git): video `.webm`, capturas clave y resultado del test; además, una tabla final: historia → test → resultado → enlace al video.
- **FR-1509**: Revisión visual de cada pantalla del sprint: capturas en escritorio (1440x900) y móvil (390x844) leídas con la herramienta Read; se evalúan jerarquía visual, espaciado, alineación, contraste, estados vacíos/carga/error, textos truncados, consistencia entre pantallas y apariencia neutra. Los cambios de UI son pequeños y justificados (nada de lo que la spec no pida); se guardan capturas «antes»/«después» con descripción de 2-3 líneas de qué mejoró. Las capturas las produce una utility de Playwright del paquete `e2e/` que NO forma parte de la suite por defecto (excluida por config, FR-1502): corre con `pnpm test:visual` y `VISUAL_CAPTURES=antes|despues` (que también fija el subdirectorio de salida), y cumple igualmente FR-1507 (sin `test.skip` ni esperas fijas).
- **FR-1510**: Neutralidad de sector: nombres de tests, historias, capturas y videos genéricos; la UI no contiene textos, iconos, ilustraciones, estados vacíos, ejemplos o colores propios de un sector, salvo texto que provenga de los datos de una organización concreta.

### Ingesta de documentos EPCIS 2.0 de terceros (US15)

- **FR-2001**: EL SISTEMA importa documentos EPCIS 2.0 de terceros (conjunto de eventos con enlaces EPC) y crea o extiende el historial de los EPCs referenciados. [NEEDS CLARIFICATION: canal de importación — archivo manual, endpoint REST o suscripción EPCIS poll/notify]
- **FR-2002**: CUANDO un evento importado tiene `eventUid` ya existente, EL SISTEMA lo ignora (importación idempotente).
- **FR-2003**: CUANDO un evento se importa, EL SISTEMA lo persiste con `source` distinto de `platform`.
- **FR-2004**: CUANDO se importan eventos, EL SISTEMA los proyecta sobre el gemelo con las mismas reglas que los eventos locales (FR-1001).

### Notas de cumplimiento (desvíos detectados al escribir la spec)

Para la revisión de código vs. spec (sprint de revisión). No son requisitos:

1. Visibilidad: `canRead`/`listEpc`/`search`/`getHistory` (`event-ledger.service.ts` l.960–967, l.525, l.562, l.620) dejan ver más de lo que mandan FR-D4/FR-D5/FR-D6 (el custodian actual ve el historial completo; el producer no-owner puede verse en la lista).
2. Receiving: el frontend recibe con un botón sobre la lista de destinatarios (`trace.ts` l.1179, l.263, l.1032; `api.service.ts` l.105; `models.ts` l.198), no escaneando la etiqueta física (FR-D5, FR-602).
3. Onboarding: el contrato Swagger de `POST /actor/operations/accept` y custom activity documenta 409 «solo una vez», pero el service no lo implementa (FR-204/FR-205).
4. Admin: no existe endpoint de rechazo de organizaciones; `ActorStatus.rejected` existe en el modelo pero no se usa (US2).
5. Email: `FileEmailSender` lee `process.env.MAIL_OUTBOX_PATH` directamente en vez de por `ConfigService` (FR-1401).
6. El seed comisiona solo cases, sin EPCs de contenido: la separabilidad case/contenido (FR-D7) no queda ejercida en la demo.

## Non-Functional Requirements

- **NFR-1**: Una organización sin relación recibe 404, nunca 403 (FR-D2).
- **NFR-2**: El ledger es append-only: los eventos no se modifican ni se borran.
- **NFR-3**: Toda configuración sensible vive en `backend/.env` (git-ignored) validado por Joi al arranque; puertos 3001 (API) y 5434 (Postgres) son intencionales.
- **NFR-4**: El backend es ESM (`"type": "module"`, `nodenext`); los imports relativos terminan en `.js`.
- **NFR-5**: El frontend es un cliente delgado: sin lógica de negocio.
- **NFR-6**: Interoperabilidad EPCIS 2.0: vocabulario estándar (commissioning, shipment, receiving, custody, aggregation, transformation, disposition, recall) y estructura que permita importar documentos de terceros sin duplicar eventos (`eventUid` como clave de dedupe).
- **NFR-7**: Cada requisito funcional lleva al menos un test (unit o e2e).
- **NFR-8**: Código e identificadores en inglés; documentación (specs, board, docs) en español.
- **NFR-9**: La suite e2e arranca la app real contra la BD de `.env` y requiere el plugin SWC (esbuild no emite `design:paramtypes` y Nest DI fallaría).
- **NFR-10**: La suite E2E web corre sobre el entorno de desarrollo local (mismos puertos: web :4200, API :3001, Postgres según `.env`); no requiere infraestructura externa.
- **NFR-11**: Solo navegador Chromium. Si falta un navegador o un caso no puede ejecutarse, se declara explícitamente en el reporte (nunca se omite en silencio).
- **NFR-12**: La infraestructura de tests no modifica la aplicación: sin funcionalidades, componentes o configuración de app que la spec no pida.

## Success Criteria

- **SC-001**: El journey completo (commissioning → ship → invoice → receive → inspect → aggregate → notice → ack) es ejecutable desde la UI con las 3 organizaciones del seed.
- **SC-002**: 100% de los FR as-built (D1–D10, US1–US14) tiene al menos un test (unit o e2e).
- **SC-003**: `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm --filter backend test:e2e` y `pnpm test:e2e:web` en verde.
- **SC-004**: La revisión de cumplimiento cubre E1–E25 y cada desvío queda registrado en `board.md`/sprint con su FR y su sprint de cierre.
- **SC-005**: La importación de un documento EPCIS 2.0 de terceros extiende el historial sin duplicar eventos (requisito nuevo, sprint de EPCIS).
- **SC-006**: `pnpm test:e2e:web` ejecuta la suite web de punta a punta; cada test deja video y capturas; dos ejecuciones consecutivas sobre datos seedados producen los mismos resultados y dejan la base de desarrollo intacta; `pnpm test` sigue corriendo solo unit tests del backend.
- **SC-007**: Al cerrar un sprint, `e2e-evidence/sprint-NN/` existe con la evidencia por historia (video, capturas clave, resultado) y la tabla final (historia → test → resultado → enlace al video).
- **SC-008**: La revisión visual deja «antes»/«después» por pantalla con descripción de 2-3 líneas.
- **SC-009**: Ningún sprint se declara cerrado sin cumplir el criterio de cierre completo definido en la constitución.

## Assumptions

- Un solo Postgres y un solo servidor SMTP para toda la app.
- La aprobación de organizaciones la hace un staff manualmente (sin auto-aprobación).
- La plataforma es el system of record: eventos locales + importados.
- Las organizaciones del seed son datos de demostración de un ejemplo de cadena: un producer, un distribuidor y una organización de destino (la plataforma es agnóstica de sector).
- La URN del EPC la genera la plataforma con formato fijo.
- El escaneo de la etiqueta física (QR) se resuelve en el navegador (cámara o entrada manual — ver Dudas abiertas).

## Out of scope

- Reintentos, cola y tracking de entrega de emails (la validación de arranque y el log de fallo bastan).
- Soporte multi-tenant de SMTP (un solo servidor).
- SSO/OAuth, password reset, 2FA.
- Suscripción EPCIS poll/notify (la importación inicial cubre el requisito; la suscripción es evolución futura).
- Push de notices en tiempo real (solo pull).
- Rechazo de organizaciones por staff (el modelo lo permite; no hay endpoint hoy).
- Multi-región / multi-tenant / clustering.
- Visual regression por comparación de píxeles/baselines: la revisión la hace el modelo sobre las capturas.
- Integración de la suite E2E en CI/CD (pipelines): no se pide.

## Sprints y vertical slices

Cada user story es una vertical slice. El plan (`plan.md` + `tasks.md`, paso siguiente) descompone cada slice en tareas; una tarea a la vez. Mapa propuesto de sprints:

- **Sprint 01 (hecho)**: base SDD + email provider (T1–T11).
- **Sprint 02**: plan de esta spec (S2-1) + infraestructura Playwright y smoke test (S2-2) + revisión visual de las pantallas actuales (S2-3) + revisión de cumplimiento de E1–E25 (S2-4; gaps → board/sprints; sin re-implementación) + cierre con tabla de evidencia (S2-5). No tiene user stories propias: su evidencia web es el smoke y la revisión visual.
- **Sprint 03 (propuesto)**: cierre de gaps de custody/visibilidad (FR-D3..D6, FR-602, notas 1–2) — pendiente de la revisión. Primer sprint con user stories: aplica el criterio de cierre completo, con tests E2E por historia (US17) y evidencia en `e2e-evidence/sprint-03/`.
- **Sprint 04 (propuesto)**: requisito nuevo de ingesta EPCIS 2.0 (FR-2001..2004) — pendiente de clarificación del canal.

**Criterio de cierre de sprint**: único para todo el proyecto y definido en la constitución (Quality Gates); las specs y los sprints solo lo apuntan, no lo redefinen.

La estructura final se confirma en el paso de plan.

## Completion Criteria

- Todos los FR as-built tienen al menos un test (unit o e2e).
- La revisión de cumplimiento se ejecuta y sus desvíos quedan registrados en `board.md` y en el sprint correspondiente.
- `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm --filter backend test:e2e` y `pnpm test:e2e:web` en verde.
- La sección «Requisitos nuevos / a implementar» está separada y marcada.
- El tablero refleja E1–E25 especificados.
- Cada sprint cerrado deja su evidencia en `e2e-evidence/sprint-NN/` según el criterio de cierre de la constitución.

## Open Questions

- ¿Canal de importación EPCIS 2.0 de terceros: archivo manual, endpoint REST o suscripción EPCIS poll/notify? (FR-2001)
- ¿Cómo se lee la etiqueta física QR en el receiving: cámara del navegador o entrada manual del EPC? (FR-602)

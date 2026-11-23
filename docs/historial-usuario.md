# Historial del usuario

Qué puede hacer un usuario hoy, paso a paso, tal como lo hace la API actual.
Todo se accede bajo `http://localhost:3001/api/v1` (Swagger en `/docs`).

## 1. Un owner registra su organización

1. Llama a `POST /auth/register` con los datos de la organización
   (`legalName`, `organizationNumber`) y de su cuenta (`adminEmail`,
   `adminPassword`, `adminFullName`). **No se piden actividades**: se definen
   en el onboarding, según las operaciones que haga la empresa.
2. La organización queda creada en estado `PENDING_APPROVAL` y su cuenta
   como `EMAIL_UNVERIFIED`; se genera un email de verificación a su nombre
   (el emisor por defecto lo escribe a un archivo local; se puede conmutar a
   SMTP con `EMAIL_PROVIDER=smtp`). Si se pierde el email, se reenvía con
   `POST /auth/verification/resend` (público, aplica el cooldown y solo funciona
   mientras la cuenta siga sin verificar).
3. Abre el link del email y llama a `POST /invitations/verify` con el token:
   - si la organización ya fue aprobada → su cuenta pasa a `ACTIVE`;
   - si aún está pendiente → pasa a `AWAITING_APPROVAL` y no puede loguearse.
4. El staff de la plataforma aprueba la organización
   (`PATCH /admin/actors/:id/approval`): el actor pasa a `APPROVED` y todos
   sus usuarios en `AWAITING_APPROVAL` se activan.
5. Ya puede loguearse con `POST /auth/login` (devuelve un JWT). En el primer
   acceso, el owner completa el onboarding de operaciones:
   - `GET /actor/operations`: catálogo de operaciones agrupadas
     (producción, movimiento, almacenaje, comercio, transformación,
     asociaciones).
   - `POST /actor/operations/suggestions`: según las operaciones marcadas,
     devuelve hasta 3 combinaciones de actividades que las cubren.
   - `POST /actor/operations/accept`: asigna la combinación elegida; valida
     que cubra todas las operaciones marcadas.
   - `POST /actor/operations/custom`: alternativa para crear una actividad
     propia con exactamente las operaciones seleccionadas.
6. Con la actividad asignada, el usuario puede ejecutar las operaciones que
   habilitó (comisionar, enviar, recibir, facturar, etc.) y el frontend deja
   de redirigirlo al onboarding.

## 2. El staff de la plataforma

- Se crea automáticamente al arrancar (seed con `STAFF_EMAIL`,
  `STAFF_PASSWORD`, `STAFF_FULL_NAME`).
- Aprueba o revisa organizaciones pendientes con
  `PATCH /admin/actors/:id/approval`.
- No puede entrar a los datos de los actores: no crea productos, no registra
  eventos ni gestiona avisos.

## 3. Un miembro invitado por su organización

1. El owner (o admin) de la organización lo invita con `POST /invitations`
   indicando `email` y `roles` (p. ej. `member`). Si ya hay una invitación
   pendiente para ese email se reutiliza respetando un cooldown de reenvío.
2. El invitado recibe un email con un token; el frontend puede mostrar los
   detalles antes de aceptar con `GET /invitations/:token/preview`
   (organización, roles, expiración, si ya existe cuenta con ese email).
3. Si no tiene cuenta: `POST /invitations/accept` con el token, su nombre y
   contraseña → se crea su cuenta como `ACTIVE` directamente (solo si la
   organización ya está aprobada).
4. Si ya tiene una cuenta global con ese email, el flujo le pide usar el link
   de verificación (`POST /invitations/verify`) en lugar de aceptar.
5. Loguea y opera dentro de su organización con los roles asignados.

## 4. Lo que un usuario activo puede hacer día a día

Catálogo (cualquier rol autenticado de la organización):

- `POST /products` y `POST /products/:productId/batches` para crear productos
  y lotes; listarlos con `GET /products` y
  `GET /products/:productId/batches`; ver detalle con `GET /products/:productId`.

Eventos del ledger (cada operación exige que la organización tenga la
actividad correspondiente asignada en el onboarding):

| Acción | Endpoint | Operación requerida |
| --- | --- | --- |
| Comisionar un EPC (acuña `urn:nodoo:epc:...` y su gemelo) | `POST /epcs` | `object:commissioning` |
| Recibir un EPC (pasa a ser custodio) | `POST /epcs/:epc/receive` | `object:receiving` |
| Enviar un EPC (queda "en tránsito") | `POST /epcs/:epc/ship` | `object:shipping` |
| Facturar un EPC (transfiere la propiedad; opcional `ownershipTransferTo`) | `POST /epcs/:epc/invoice` | `transaction:inv` |
| Registrar pedido de compra | `POST /epcs/:epc/purchase-order` | `transaction:po` |
| Registrar aviso de despacho | `POST /epcs/:epc/despatch-advice` | `transaction:desadv` |
| Registrar carta de porte | `POST /epcs/:epc/bill-of-lading` | `transaction:bol` |
| Inspeccionar un EPC (un fallo lo marca dañado) | `POST /epcs/:epc/inspect` | `object:inspecting` |
| Agregar EPCs a un contenedor padre | `POST /epcs/:epc/aggregate` | `aggregation:ADD` |
| Quitar EPCs de un contenedor | `POST /epcs/:epc/disaggregate` | `aggregation:DELETE` |
| Empaquetar EPCs en una unidad padre | `POST /epcs/:epc/pack` | `object:packing` |
| Desempaquetar una unidad padre | `POST /epcs/:epc/unpack` | `object:unpacking` |
| Asociar EPCs relacionados (certificados, garantías…) | `POST /epcs/:epc/associate` | `association:ADD` |
| Desasociar EPCs relacionados | `POST /epcs/:epc/disassociate` | `association:DELETE` |
| Transformar insumos en producto nuevo (consume inputs, acuña outputs) | `POST /epcs/transform` | `transformation:transforming` |

Consulta:

- `GET /epcs` lista los EPCs visibles para la organización (productor,
  propietario, custodio actual o destino), con filtros opcionales `productId`,
  `batchId` y búsqueda libre `q` (EPC, SKU, nombre de producto o código de lote).
- `GET /epcs/search` busca por término libre en EPCs, SKUs, productos y lotes,
  y devuelve además los productos/lotes que aún no tienen un caso legible.
- `GET /epcs/:epc` devuelve el gemelo digital actual (producto, lote,
  productor, propietario, custodio, destino).
- `GET /epcs/:epc/history` devuelve los eventos en orden cronológico; quien
  cumple `canRead` (productor, propietario, custodio actual o destino) ve el
  historial completo y el resto solo su ventana de custodia.

Avisos (recall / advisory):

- El dueño del producto crea avisos con `POST /products/:productId/notices`
  apuntando a un `batchId`, a `epcIds` concretos o a ambos
  (`type: recall | advisory`).
- `GET /products/:productId/notices` lista los avisos del producto.
- El owner (y quien tenga relación con los EPCs del lote/objetivo) puede ver el
  detalle con `GET /notices/:id`.
- Los afectados (quien cumple `canAccess`: dueño del producto, o owner/custodio/
  productor de un EPC del lote u objetivo) confirman con `POST /notices/:id/ack`
  (idempotente: repetir no crea duplicados).
- Quien puede ver el aviso ve también la lista de acuses con
  `GET /notices/:id/acks`.

Gestión del equipo (solo `OWNER` o `ADMIN` de la organización):

- `GET /users` lista los usuarios de la organización con sus roles y estado.
- `PATCH /users/:userId` suma roles a un miembro (solo aditivo; no se puede
  asignar `owner`).
- `DELETE /users/:userId` da de baja a un miembro (no al owner ni al propio
  llamador).

## 5. Reglas de acceso

| Dato | Quién lo ve |
| --- | --- |
| Gemelo de un EPC | Productor, propietario, custodio actual o destino; el resto recibe 404 |
| Historial completo de un EPC | Productor, propietario, custodio actual o destino (quien cumple `canRead`) |
| Ventana de custodia (solo mientras custodió el EPC) | Custodios previos que ya no cumplen `canRead` |
| Sin ninguna relación | 404 (no expone que el EPC existe) |
| Aviso de un producto | Owner del producto, o owner/custodio/productor de un EPC del lote u objetivo |
| Lista de acuses de un aviso | Igual que el aviso (owner del producto o actor con EPC afectado) |

## 6. Lo que el usuario todavía NO puede hacer

Bloqueantes para el MVP:

- Los correos no se envían de verdad por defecto: el emisor escribe un archivo
  local (se implementa el proveedor SMTP en `specs/001-email-provider/`).

Mejoras pendientes (no bloqueantes):

- Migraciones de base de datos (hoy `synchronize` solo fuera de producción).
- CORS y paginación de listas.
- Limpieza del controlador vacío `storage` (solo tiene la declaración
  `@Controller`, sin endpoints).

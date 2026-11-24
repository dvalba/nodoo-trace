# NodooTrace backend

API de trazabilidad de producto basada en EPCIS 2.0 y multi-tenant.

## Qué incluye

- **Autenticación y organizaciones**: registro de actores, invitaciones, verificación de email, login JWT y roles (owner/member/staff).
- **Catálogo**: productos y lotes por organización.
- **Libro de eventos**: eventos de objeto, transacción, agregación y transformación (EPCIS).
- **Gemelos digitales**: proyección del estado actual de cada EPC (producto, lote, padre, productor, propietario, custodio y estado).
- **Historial**: eventos de un EPC en orden cronológico con visibilidad por ventana de custodia.
- **Avisos**: recalls y advisories por lote o EPC, con acuses idempotentes.

## Stack

NestJS 12 · TypeORM · PostgreSQL 16 · JWT · Vitest · Supertest.

## Requisitos

- Node.js 22+ y pnpm
- Docker (para PostgreSQL)

## Puesta en marcha

```bash
cd backend
cp .env.example .env      # ajusta secretos y credenciales
docker compose up -d      # PostgreSQL en localhost:5434
pnpm install
pnpm start:dev
```

La app crea/actualiza el esquema automáticamente cuando `NODE_ENV` no es `production` (`synchronize`). No hay migraciones todavía.

- API: `http://localhost:3001/api/v1`
- Swagger: `http://localhost:3001/docs`

Al arrancar se siembran los tipos de actividad, las operaciones y el usuario staff definido en `STAFF_*`.

## Semilla de datos

Ejecuta `pnpm seed` (raíz del repo) para crear de forma idempotente una cadena de ejemplo con tres organizaciones ya aprobadas, sus productos/lotes, **casos rastreables** (cada caso es un EPC) y el historial del libro de eventos con fechas retroactivas, además de un retiro con acuses. Son datos de demostración de un ejemplo de cadena: la plataforma es agnóstica de sector. Sirve para no tener la base vacía mientras pruebas. El comando compila el backend y ejecuta `dist/scripts/seed.js`, y no hace nada si la cadena ya existe.

> En esta semilla los **pallets no son rastreables**: son unidades logísticas que agrupan casos y no se serializan, así que no tienen EPC ni historial. La unidad trazable es la **caja (case)**.

Los identificadores de productos, lotes, EPC y aviso son **deterministas**, por lo que los deep-links de la UI y los ejemplos de esta guía funcionan en cualquier siembra.

> Para volver a sembrar desde cero: `pnpm db:reset && pnpm db:up && pnpm seed`.

### Cuentas de prueba

Todas con contraseña **`Seed1234`**:

| Organización | Rol (actividad) | Email |
| --- | --- | --- |
| Laboratorios FarmaSur | `manufacturer` | `laboratorio@seed.nodoo.local` |
| Distribuidora MediAndes | `wholesaler` | `distribuidora@seed.nodoo.local` |
| Hospital San Rafael | `retailer` | `hospital@seed.nodoo.local` |

### Historia sembrada

Los valores siguientes (organizaciones, lotes, EPCs y aviso) son datos de demostración de un ejemplo de cadena; la plataforma es agnóstica de sector.

El laboratorio comisiona 3 cajas de vacuna (`LOTE-VAC-2026-1117-A`) y 2 cajas de insulina (`LOTE-INS-2026-1117-B`), las envía y factura a la distribuidora, que las recibe. Luego la distribuidora envía/factura una caja de vacuna al hospital (recibida) y una caja de insulina que queda `in_transit` (aún sin recibir). Queda un **retiro** del lote de vacuna con 2 acuses (distribuidora y hospital). Los pallets asociados no se serializan.

EPCs de ejemplo (cajas):

- Vacuna en el hospital: `urn:nodoo:epc:1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d`
- Vacuna en la distribuidora: `urn:nodoo:epc:2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e`
- Insulina en tránsito: `urn:nodoo:epc:4d5e6f7a-8b9c-4d0e-1f2a-3b4c5d6e7f8a`

Aviso de ejemplo: `7d6f2a5b-9e8c-4f7a-8b65-ac9d8e7f6a54`.

### Prueba rápida (curl)

```bash
# 1) Login (devuelve accessToken + user)
TOKEN=$(curl -s -X POST http://localhost:3001/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"hospital@seed.nodoo.local","password":"Seed1234"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["accessToken"])')

# 2) Casos visibles para mi organización
curl -s http://localhost:3001/api/v1/epcs -H "Authorization: Bearer $TOKEN"

# 3) Gemelo digital e historial de una caja
EPD='urn:nodoo:epc:1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d'
curl -s http://localhost:3001/api/v1/epcs/$EPD -H "Authorization: Bearer $TOKEN"
curl -s http://localhost:3001/api/v1/epcs/$EPD/history -H "Authorization: Bearer $TOKEN"

# 4) Aviso
curl -s http://localhost:3001/api/v1/notices/7d6f2a5b-9e8c-4f7a-8b65-ac9d8e7f6a54 \
  -H "Authorization: Bearer $TOKEN"
```

### Registro y onboarding

`POST /auth/register` **no** pide actividades. El owner queda `EMAIL_UNVERIFIED` hasta confirmar el enlace de verificación, y la organización pasa a aprobación por staff una vez verificada.

Al entrar por primera vez, el owner define qué hace su empresa con `GET /actor/operations` y luego usa `POST /actor/operations/suggestions` para recibir combinaciones de actividad que cubren sus operaciones. Puede aceptar una con `POST /actor/operations/accept` o crear una clasificación propia con `POST /actor/operations/custom`. Esa actividad habilita las operaciones que podrá ejecutar.

## Variables de entorno

| Variable | Descripción |
| --- | --- |
| `NODE_ENV` | `development`, `test` o `production` |
| `PORT` | Puerto HTTP (por defecto `3001`) |
| `PLATFORM_NAME` | Nombre mostrado en plantillas de email |
| `HOST_FRONT` | URL del frontend para enlaces de invitación/verificación |
| `DB_HOST`, `DB_PORT`, `DB_NAME` | Conexión PostgreSQL |
| `DB_USERNAME`, `DB_PASSWORD` | Credenciales PostgreSQL |
| `JWT_SECRET` | Secreto JWT (mínimo 32 caracteres) |
| `JWT_EXPIRES_IN` | Vida del token (ej. `2h`) |
| `TOKEN_SECRET` | Secreto HMAC de invitaciones (mínimo 32 caracteres) |
| `INVITATION_RESEND_INTERVAL` | Espera mínima entre reenvíos (ej. `5m`) |
| `INVITATION_EXPIRES_IN` | Vida de la invitación (ej. `7d`) |
| `STAFF_EMAIL`, `STAFF_PASSWORD`, `STAFF_FULL_NAME` | Usuario staff inicial |

`docker compose` y la aplicación leen el mismo archivo `backend/.env`.

## Endpoints principales

- `POST /auth/register`, `POST /auth/login`, `GET /auth/me`
- `GET /activity-types`, `GET /actors/:actorId`
- `GET /actor/operations`, `POST /actor/operations/{suggestions,accept,custom}`
- `POST/GET /products`, `GET /products/:productId`, `POST/GET /products/:productId/batches`
- `POST /epcs`, `GET /epcs`, `POST /epcs/:epc/{receive,ship,invoice,aggregate,disaggregate}`, `POST /epcs/transform`
- `GET /epcs/:epc`, `GET /epcs/:epc/history`
- `POST/GET /products/:productId/notices`
- `GET /notices/:noticeId`, `POST /notices/:noticeId/ack`, `GET /notices/:noticeId/acks`

El detalle de payloads y respuestas está en Swagger. Las operaciones EPCIS requieren que la organización tenga la actividad correspondiente.

## Acceso a los datos

El libro es cerrado: el productor y el propietario actual ven todo el historial; un custodio solo ve su ventana de custodia. Las organizaciones sin relación reciben `404`.

## Tests

```bash
pnpm test        # unitarios (Vitest)
pnpm test:e2e    # HTTP end-to-end (requiere PostgreSQL arriba)
pnpm lint        # oxlint
pnpm build       # nest build
```

Los e2e usan la base configurada en `.env`, crean sus propios actores/usuarios y limpian los datos al terminar.

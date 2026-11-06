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

## Semilla de desarrollo

Con `DEMO_SEED=true` en `backend/.env`, al arrancar se crea (una sola vez, de forma idempotente) una cadena de café realista con cuatro organizaciones ya aprobadas, sus productos/lotes, el historial del libro de eventos con fechas retroactivas (varias semanas atrás) y un advisory con acuses. Sirve para probar todo el flujo sin registrar nada.

Los identificadores (productos, lotes, EPC y aviso) son **deterministas**, por lo que los deep-links de la UI y los ejemplos de esta guía funcionan en cualquier siembra.

> El seed hace *skip* si ya existe (detecta los actores/emails de prueba). Para re-siembrar desde cero, borra los datos de la semilla (o la base) y reinicia.

### Cuentas de prueba

Todas con contraseña **`Demo1234`**:

| Organización | Rol (actividad) | Email |
| --- | --- | --- |
| Finca El Roble | `supplier` (productor) | `finca@demo.nodoo.local` |
| Tostaduría Aroma | `manufacturer` | `tostaduria@demo.nodoo.local` |
| Distribuciones Andina | `wholesaler` | `distribuciones@demo.nodoo.local` |
| Cafeterías La Vela | `retailer` | `caferias@demo.nodoo.local` |

### Historia sembrada

El proveedor comisiona 3 sacos de café verde (`GRN-2026-1117`), envía y factura cada uno a la tostadería, que los transforma en 2 paquetes tostados (`RST-2026-1117-A`), los envía/factura al mayorista, y el mayorista reenvía uno al minorista. Queda un advisory del lote tostado con 2 acuses (mayorista y minorista). Los 3 sacos verdes están `consumed`; los 2 paquetes tostados, `active`.

### Prueba rápida (curl)

```bash
# 1) Login (devuelve accessToken + user)
TOKEN=$(curl -s -X POST http://localhost:3001/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"caferias@demo.nodoo.local","password":"Demo1234"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["accessToken"])')

# 2) Gemelo digital de un EPC (el minorista posee uno tostado)
EPD='urn:nodoo:epc:d71dd322-2b92-4a06-a4eb-8a1b43efecc0'
curl -s http://localhost:3001/api/v1/epcs/$EPD -H "Authorization: Bearer $TOKEN"

# 3) Historial / trazabilidad (orden cronológico, ventana de custodia)
curl -s http://localhost:3001/api/v1/epcs/$EPD/history -H "Authorization: Bearer $TOKEN"

# 4) Avisos que puedo ver (por producto)
curl -s http://localhost:3001/api/v1/products/6b76c49e-de79-45ea-9e84-78bb737d4453/notices \
  -H "Authorization: Bearer $TOKEN"
```

Otros EPCs de ejemplo: tostado en poder del mayorista `urn:nodoo:epc:7833feff-792d-4be1-bfa7-e376505c9a9d`; sacos verdes (consumidos, custodiados por la tostadería) `urn:nodoo:epc:236af542-6576-4e2f-987f-5239e1f3c3fe`. Aviso de ejemplo: `9fe65a02-0b8c-4a02-8afc-726d0ed00c8a`.

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
| `DEMO_SEED` | `true` siembra la cadena de desarrollo (ver "Semilla de desarrollo") |

`docker compose` y la aplicación leen el mismo archivo `backend/.env`.

## Endpoints principales

- `POST /auth/register`, `POST /auth/login`
- `POST/GET /products`, `GET /products/:productId`, `POST/GET /products/:productId/batches`
- `POST /epcs`, `POST /epcs/:epc/{receive,ship,invoice,aggregate,disaggregate}`, `POST /epcs/transform`
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

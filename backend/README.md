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
docker compose up -d      # PostgreSQL en localhost:5432
pnpm install
pnpm start:dev
```

La app crea/actualiza el esquema automáticamente cuando `NODE_ENV` no es `production` (`synchronize`). No hay migraciones todavía.

- API: `http://localhost:3000/api/v1`
- Swagger: `http://localhost:3000/docs`

Al arrancar se siembran los tipos de actividad, las operaciones y el usuario staff definido en `STAFF_*`.

## Variables de entorno

| Variable | Descripción |
| --- | --- |
| `NODE_ENV` | `development`, `test` o `production` |
| `PORT` | Puerto HTTP (por defecto `3000`) |
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

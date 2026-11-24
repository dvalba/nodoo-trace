# NodooTrace

Plataforma de trazabilidad de cadenas de suministro basada en EPCIS 2.0.

Permite registrar el ciclo de vida de productos y lotes (comisión, envío, recepción, facturación, agregación y transformación), consultar el estado actual de cada EPC y publicar avisos de recall/advisory con acuses.

## Estructura

- `backend/`: API REST en NestJS + PostgreSQL. Ver [backend/README.md](backend/README.md) para configuración, variables de entorno y endpoints.
- `frontend/`: cliente Angular.

## Arranque rápido

El repo es un **workspace de pnpm**, así que todo se maneja desde la raíz:

```bash
pnpm setup      # crea backend/.env a partir de .env.example (solo si no existe)
pnpm install    # instala dependencias de backend y frontend
pnpm start      # levanta PostgreSQL + API (:3001) + frontend (:4200)
```

- API: `http://localhost:3001/api/v1`
- Swagger: `http://localhost:3001/docs`
- Frontend: `http://localhost:4200`

La API usa el puerto `3001` y PostgreSQL el `5434` por defecto, para evitar choques con otros servicios; se cambian en `backend/.env`. La cadena demo **no** se siembra automáticamente: ejecuta `pnpm seed` para crearla (es idempotente; necesitas Postgres arriba y `backend/.env`).

## Demo

La semilla crea una cadena de ejemplo con tres organizaciones aprobadas, casos rastreables y un retiro con acuses (los pallets no se serializan). Son datos de demostración de un ejemplo de cadena: la plataforma es agnóstica de sector. Todas las cuentas usan la contraseña `Seed1234`:

| Organización | Rol | Email |
| --- | --- | --- |
| Laboratorios FarmaSur | Fabricante | `laboratorio@seed.nodoo.local` |
| Distribuidora MediAndes | Mayorista | `distribuidora@seed.nodoo.local` |
| Hospital San Rafael | Minorista | `hospital@seed.nodoo.local` |

Estas cuentas ya tienen su actividad configurada. Si registras una organización nueva, el primer paso tras iniciar sesión es el **onboarding**: marcas las operaciones de tu empresa y el sistema te sugiere una actividad (o creas la tuya).

Detalle de la historia, EPCs de ejemplo y prueba con `curl` en [backend/README.md](backend/README.md#semilla-de-desarrollo). Si ya tenías una base con una demo anterior, ejecuta `pnpm db:reset`, vuelve a arrancar y, si quieres la demo, `pnpm seed`.

Otros scripts de la raíz: `pnpm dev:backend`, `pnpm dev:frontend`, `pnpm db:up`,
`pnpm db:down`, `pnpm db:reset`, `pnpm build`, `pnpm lint`, `pnpm test`,
`pnpm test:e2e:web`.

La suite E2E web (`pnpm test:e2e:web`) corre Playwright contra una base de datos
dedicada `supply_chain_e2e` que se crea y siembra sola antes de cada ejecución y
levanta su propio backend + frontend; requiere que el stack de dev esté detenido
(puertos 3001 y 4200 libres). La evidencia (video, capturas) se copia a
`e2e-evidence/sprint-NN/` (fuera de git).

> Si tu mirror de npm no responde, instala con
> `pnpm install --registry=https://registry.npmjs.org/`.

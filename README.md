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

La API usa el puerto `3001` y PostgreSQL el `5434` por defecto, para evitar choques con otros servicios; se cambian en `backend/.env`. La cadena demo se siembra por defecto (`DEMO_SEED=true`); pon `DEMO_SEED=false` en `backend/.env` si no la quieres.

Otros scripts de la raíz: `pnpm dev:backend`, `pnpm dev:frontend`, `pnpm db:up`,
`pnpm db:down`, `pnpm db:reset`, `pnpm build`, `pnpm lint`, `pnpm test`.

> Si tu mirror de npm no responde, instala con
> `pnpm install --registry=https://registry.npmjs.org/`.

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
pnpm start      # levanta PostgreSQL + API (:3000) + frontend (:4200)
```

- API: `http://localhost:3000/api/v1`
- Swagger: `http://localhost:3000/docs`
- Frontend: `http://localhost:4200`

Para activar la cadena demo, edita `backend/.env` y pon `DEMO_SEED=true` antes de arrancar.

Otros scripts de la raíz: `pnpm dev:backend`, `pnpm dev:frontend`, `pnpm db:up`,
`pnpm db:down`, `pnpm db:reset`, `pnpm build`, `pnpm lint`, `pnpm test`.

> Si tu mirror de npm no responde, instala con
> `pnpm install --registry=https://registry.npmjs.org/`.

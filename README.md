# NodooTrace

Plataforma de trazabilidad de cadenas de suministro basada en EPCIS 2.0.

Permite registrar el ciclo de vida de productos y lotes (comisión, envío, recepción, facturación, agregación y transformación), consultar el estado actual de cada EPC y publicar avisos de recall/advisory con acuses.

## Estructura

- `backend/`: API REST en NestJS + PostgreSQL. Ver [backend/README.md](backend/README.md) para configuración, variables de entorno y endpoints.
- `frontend/`: cliente Angular.

## Arranque rápido

```bash
cd backend
cp .env.example .env
docker compose up -d
pnpm install
pnpm start:dev
```

La API queda en `http://localhost:3000/api/v1` y Swagger en `http://localhost:3000/docs`.

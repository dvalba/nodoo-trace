# e2e — suite web (Playwright, spec 001 US16–US19)

La suite corre contra **backend real + Postgres real**: el global setup
(`scripts/reset-e2e-db.ts`) sube Postgres (`pnpm db:up`), espera `pg_isready`,
hace drop/create de la BD dedicada `supply_chain_e2e` y la siembra
(`pnpm seed`); después Playwright arranca el backend (`:3001`) y la web
(`:4200`) esperando readiness en **ambos** (probe público
`/api/v1/activity-types` + `http://localhost:4200`). Es determinista y
repetible (FR-1505): no toca la BD de desarrollo ni deja basura.

`e2e-evidence/` está **fuera de git** (FR-1503): la evidencia no se sube a
GitHub; se **construye en cada máquina** con los comandos de abajo.

## Requisitos (máquina nueva)

- Docker (Postgres por `backend/docker-compose.yml`, puerto `5434`)
- Node + pnpm
- Puertos `3001` y `4200` libres (dev stack parado; la suite levanta los suyos)

## Setup (una vez por clon)

```bash
pnpm setup                                       # backend/.env desde .env.example
pnpm install
pnpm --filter e2e exec playwright install chromium
```

## Construir la evidencia desde cero

```bash
pnpm test:e2e:web                                # suite por defecto (FR-1507)
VISUAL_CAPTURES=despues pnpm test:visual         # utility de capturas (FR-1509)
```

| Comando | Qué corre | Evidencia producida |
|---------|-----------|---------------------|
| `pnpm test:e2e:web` | tests por historia (uno por spec, `tests/us-NN-*.spec.ts`) | `e2e-evidence/sprint-NN/<test>/` → `video.webm` + `test-finished-*.png` (+ trace si falla) |
| `VISUAL_CAPTURES=antes\|despues pnpm test:visual` | `visual-captures.spec.ts` (excluida de la suite por `testIgnore`, FR-1502; config dedicada `playwright.visual.config.ts`, FR-1504) | `e2e-evidence/sprint-02/visual/<modo>/*.png` (6 pantallas × 1440/390) + un `video.webm` por captura |

`VISUAL_CAPTURES` debe ser `antes` o `despues`; si no está seteado el spec
falla explícitamente (no se saltea). Cada corrida resetea la BD y levanta
backend+web, así que son independientes entre sí.

## Qué sí se regenera y qué no (Sprint 02)

| Artefacto | ¿Regenerable desde el HEAD actual? |
|-----------|-------------------------------------|
| Video + captura del smoke US16 | ✅ `pnpm test:e2e:web` |
| 12 PNG `visual/despues/` + 6 videos de captura | ✅ `VISUAL_CAPTURES=despues pnpm test:visual` |
| 12 PNG `visual/antes/` | ❌ **baseline congelada**: estado previo a las 6 correcciones de neutralidad (S2-3b, commit `a38848d`). Con el HEAD actual, `VISUAL_CAPTURES=antes` produce imágenes idénticas a `despues`. Para reproducirla hay que correr la utility con el frontend en el estado anterior a `a38848d`. |
| `summary.md` (tabla final historia → test → resultado → video, FR-1508) y `visual/NOTAS.md` | ❌ documentos escritos a mano en el cierre (S2-5/S2-3); se copian de la máquina de cierre o se reescriben. |

Para mover la evidencia completa (incluida la `antes` congelada y los
documentos) a otra máquina: `tar czf e2e-evidence-sprint-02.tgz e2e-evidence/`

## Nota para el próximo sprint

Los destinos de evidencia están fijados a `sprint-02` (script
`copy-evidence.ts` default + ruta en `visual-captures.spec.ts`), acotado al
scope de S2-3/S2-6. Al iniciar Sprint 03, S3-3 ajusta el destino a
`sprint-03` junto con la tabla final.

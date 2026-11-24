# Handoff — Sprint 02 / spec 001 (continuidad entre máquinas)

> Nota de trabajo para retomar donde quedó la sesión del 2026-11-24. Se puede
> borrar al completar S2-3. Estado de git: 2 commits ya empujados a `github/develop`
> (rework de spec 001 → platform + SDD docs; e2e Playwright US16-US19).

## TL;DR
- Tarea activa: **S2-3** (revisión visual antes/después de 6 pantallas + correcciones
  de neutralidad FR-1510 + `NOTAS.md`).
- **S2-2**: hecho (infra e2e + smoke US16 verde).
- **S2-3a**: hecho (spec de capturas + 12 PNG «antes» generados en `e2e-evidence/sprint-02/visual/antes/`).
- **S2-3b / S2-3c**: pendientes (ver abajo).
- Regla del owner: una tarea a la vez; no tocar más allá de lo acordado (NFR-12, sin scope creep).

## Qué queda por hacer en S2-3
1. **S2-3b — aplicar las 6 correcciones de neutralidad** (copy hardcodeado de sector).
   Decisión tomada: corregir las 6 ocurrencias; el vocabulario de farmacia que aparece
   como **datos del seed** (nombres de producto/organización) es aceptable en las capturas.

   | Archivo | Línea | Texto actual | Sustitución sugerida (neutra) |
   | --- | --- | --- | --- |
   | `frontend/src/app/pages/products/products.ts` | 44 | `placeholder="Vacuna antigripal 0.5 mL"` | `placeholder="Nombre del producto"` |
   | `frontend/src/app/pages/products/products.ts` | 55 | `placeholder="VAC-ANTIGRIPAL-05ML"` | `placeholder="PROD-0001"` |
   | `frontend/src/app/components/operations/operations-flow.ts` | 156 | `placeholder="Ej.: Distribuidor farmacéutico"` | `placeholder="Ej.: Mayorista regional"` |
   | `frontend/src/app/core/labels.ts` | 55 | `retailer: 'Minorista / farmacia u hospital'` | `retailer: 'Minorista / punto de venta'` |
   | `frontend/src/app/core/labels.ts` | 66 | `retailer: 'Vende al consumidor final, farmacia u hospital.'` | `retailer: 'Vende al consumidor final.'` |
   | `frontend/src/app/pages/register/register.ts` | 42 | `placeholder="Laboratorios FarmaSur"` | `placeholder="Nombre de la organización"` |

   (Las líneas pueden variar ± si alguien editó esos archivos; re-grepar con
   `grep -rnE "farmacia|farmacéutico|FarmaSur|antigripal|ANTIGRIPAL|insulina|vacuna|hospital" frontend/src/app`.)

2. **S2-3c — regenerar «después» y documentar**:
   - `VISUAL_CAPTURES=despues pnpm --filter e2e exec playwright test tests/visual-captures.spec.ts`
   - Escribir `e2e-evidence/sprint-02/visual/NOTAS.md` (qué se revisó, qué se cambió, antes→después).
3. **Gates** (al terminar S2-3): `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm test:e2e:web`.
4. **Bookkeeping**: tickear S2-3 en `specs/001-platform/tasks.md` (checkboxes 61/63/65) y mover la
   tarjeta en `board.md` a Hecho.

## Evidencia (NO está en git)
- `e2e-evidence/` está en `.gitignore`: los 12 PNG «antes» y los `NOTAS.md` no viajan.
- En la PC nueva hay que **regenerar** las capturas: `VISUAL_CAPTURES=antes pnpm --filter e2e exec playwright test tests/visual-captures.spec.ts`.
- `/tmp` es efímero: en la sesión anterior las notas de revisión (generadas en `/tmp/opencode/antes_review/`)
  se limpiaron solas. No depender de `/tmp`; lo que importe, commitéalo.

## Quirks de entorno (críticos para la PC nueva)
- **Visión del modelo**: `qwen3.8-27b` (llama.cpp, GGUF) **sí es multimodal**, pero la herramienta
  `Read` de opencode está gateada por capacidad (la config no declara imagen) y devuelve
  `this model does not support image input`. Para «ver» una captura, enviar la imagen al endpoint
  OpenAI-compatible (probado y funciona): `http://172.18.201.201:11434/v1` con `model: qwen3.8-27b`
  (campo `messages[].content` con `image_url` en base64/data-URI). Arreglar la config
  (`~/.config/opencode/opencode.json`) exigiría reiniciar opencode (no hay hot-reload).
- **Puertos** (intencionales): API `3001`, Postgres `5434`, web `4200`.
- **e2e**: el paquete `e2e/` posee la BD dedicada `supply_chain_e2e` (global setup hace
  `db:up` + drop/create + seed) y levanta su propio backend+web (`reuseExistingServer:false`).
  Correr `pnpm test:e2e:web` con el stack de dev detenido (puertos libres).
- **Seed**: actor de las capturas = `distribuidora@seed.nodoo.local` (wholesaler, pass `Seed1234`);
  también `laboratorio@` (manufacturer) y `hospital@` (retailer); todos `UserRole.OWNER`.
- **Push a GitHub**: en esta red `ssh.github.com:443` está bloqueado por DPI (connection reset).
  Pushar por puerto 22:
  `GIT_SSH_COMMAND="ssh -o Hostname=github.com -o Port=22" git push github develop`
  (remoto `github` = `git@github.com:dvalba/nodoo-trace.git`).

## No tocar
- No corregir más allá de las 6 líneas (NFR-12).
- Backend: no quitar el plugin SWC de `vitest.config.e2e.ts` (Nest DI necesita `design:paramtypes`).
- Las specs web viven en `e2e/tests/` (fuera de cualquier `src/`).

## Comandos útiles (raíz del repo)
```
pnpm install
pnpm test:e2e:web                 # suite web E2E (smoke + lo no-gateado)
VISUAL_CAPTURES=antes|despues pnpm --filter e2e exec playwright test tests/visual-captures.spec.ts
pnpm lint && pnpm test && pnpm build
```

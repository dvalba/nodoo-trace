# Sprint 01 — SDD restructure + spec 001 (email provider)

Objetivo: dejar montado el sistema SDD (tablero, constitución, specs, skills,
comandos/agentes) y cerrar de punta a punta la primera spec: proveedor de
correo conmutable `file`/`smtp` (spec 001, RF-1..RF-5).

Tareas: T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11

Cierre:
- T1–T11 en "Hecho" en `board.md`.
- `pnpm lint`, `pnpm test`, `pnpm build` y `pnpm --filter backend test:e2e` en verde.
- RF-1..RF-5 del email provider (ahora FR-1401..FR-1405 de `specs/001-platform/spec.md`, US14) validados uno a uno (demo manual: outbox `file`, entrega SMTP, arranques rechazados).
- E1–E25 quedan especificados en `specs/001-platform/spec.md` (spec de plataforma, 15 vertical slices); siguiente paso: plan + revisión de cumplimiento (sprint 02, tarjetas S2-1/S2-2).
- **Cerrado**: 2026-11-23 (commit `d0a4ed4`: email provider T1–T6 + scaffolding SDD; rework de spec/docs en `3f84e21`).

Retro: no se rellena en su momento (quedó el placeholder) y el `board.md` original
de la máquina anterior no está en este clon (reconstruido el 2026-11-24, ver la nota
al pie del tablero). Regla institucionalizada a partir de Sprint 02: verificar TODOS
los Quality Gates de la constitución — incluida la suite propia del sprint (gate 2)
— antes de declarar cerrado; ver Retro de `sprints/sprint-02.md`.

# Constitución de nodoo-trace

Principios innegociables, cortos y verificables, que valen para todo el proyecto. Se revisan solo por decisión explícita del dueño del proyecto.

1. **La spec manda.** No se escribe código sin spec aprobada en `specs/NNN-*/spec.md`, y ningún cambio de comportamiento se hace sin editar antes la spec.
2. **Una tarea a la vez, en vertical slice.** Cada tarea de `tasks.md` entrega algo ejecutable de punta a punta; no se empieza la siguiente sin terminar la anterior.
3. **Stack cerrado.** pnpm workspace con `backend/` (NestJS + TypeORM + PostgreSQL) y `frontend/` (Angular). No se añade una dependencia nueva sin que la spec la justifique.
4. **Backend ESM.** `"type": "module"`; los imports relativos terminan en `.js`.
5. **Todo requisito tiene test.** Cada requisito funcional lleva al menos un test; al terminar una tarea, `pnpm lint` y `pnpm test` están en verde (y `pnpm build` / `pnpm --filter backend test:e2e` si el cambio los toca).
6. **Visibilidad cerrada del ledger.** Una organización sin relación con un EPC recibe `404`, nunca `403`; el productor y el propietario actual ven el historial completo, el custodio solo su ventana de custodia.
7. **Sin secretos en el repo.** Toda configuración sensible vive en `backend/.env` (git-ignored) y se valida al arranque (Joi); `.env.example` documenta cada variable.
8. **Idiomas.** Código e identificadores en inglés; documentación del proyecto (specs, board, `docs/`) en español.

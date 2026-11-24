# nodoo-trace Constitution

Principios innegociables, cortos y verificables, que valen para todo el proyecto. Se revisan solo por decisión explícita del dueño del proyecto.

## Core Principles

### I. La spec manda (Spec is law)
No se escribe código sin spec aprobada en `specs/NNN-*/spec.md`, y ningún cambio de comportamiento se hace sin editar antes la spec. La excepción es el legado (spec-first): el código que ya existe se especifica primero como baseline y después se audita en una revisión de cumplimiento — pero la spec sigue siendo la única fuente de verdad del comportamiento.

### II. Una tarea a la vez, en vertical slice
Cada tarea de `tasks.md` entrega algo ejecutable de punta a punta; no se empieza la siguiente sin terminar la anterior.

### III. Stack cerrado
pnpm workspace con `backend/` (NestJS + TypeORM + PostgreSQL) y `frontend/` (Angular). No se añade una dependencia nueva sin que la spec la justifique.

### IV. Backend ESM
`"type": "module"`; los imports relativos terminan en `.js`.

### V. Todo requisito tiene test (NON-NEGOTIABLE)
Cada requisito funcional lleva al menos un test (unit o e2e); al terminar una tarea, `pnpm lint` y `pnpm test` están en verde (y `pnpm build` / `pnpm --filter backend test:e2e` si el cambio los toca).

### VI. Visibilidad cerrada del ledger
La visibilidad del ledger es scope-based y cerrada: el owner ve el historial completo del producto (toda su cadena); el custodian ve todos los eventos de su ventana de custodia (incluida la identidad del owner) pero nunca la cadena upstream; el destinatario ve un case en tránsito solo como shipment a su favor (EPC + producto) y completa el receiving escaneando la etiqueta física EPC; un producer que ya no es owner no ve nada; una organización sin relación recibe `404`, nunca `403`. Ningún actor puede ver las partes de una cadena de suministro que no posee.

### VII. Sin secretos en el repo
Toda configuración sensible vive en `backend/.env` (git-ignored) y se valida al arranque (Joi); `.env.example` documenta cada variable.

### VIII. Idiomas
Código e identificadores en inglés; documentación del proyecto (specs, board, `docs/`) en español.

### IX. Frontend delgado
El frontend es un cliente delgado: consume la REST API `/api/v1` y no contiene lógica de negocio; la visibilidad, el gating y el estado los decide el backend.

### X. Interoperabilidad EPCIS 2.0
El dominio usa el vocabulario estándar de cadena de suministro / EPCIS 2.0 (commissioning, shipment, receiving, custody, aggregation, deaggregation, transformation, disposition, recall); la estructura del ledger y de los gemelos debe permitir importar documentos EPCIS 2.0 de terceros sin duplicar eventos (`eventUid` es la clave de dedupe).

### XI. Plataforma genérica, agnóstica de sector
La plataforma es una SaaS multi-tenant de trazabilidad genérica: no es de ningún sector en particular. Los datos seed son solo una demostración y no definen el producto ni su público. Interfaz, tests, capturas y videos usan vocabulario neutro (organización, actor, producto, lote, unidad, envío, recepción, custodia, evento); el vocabulario de un sector solo proviene de los datos de una organización concreta. El aislamiento entre tenants es una propiedad verificable por los tests.

## Development Workflow

- Flujo SDD: `specify` → `clarify` → `plan` → `tasks` → `implement` → (legado) revisión de cumplimiento.
- Se trabaja en vertical slices; al terminar una tarea: `pnpm lint` y `pnpm test` en verde, checkbox marcado en `tasks.md` y tarjeta movida en `board.md`.
- Commit solo cuando el usuario lo pide; un commit por tarea terminada, con el ID de la tarea en el mensaje.

## Quality Gates

- `pnpm lint` y `pnpm test` en verde en cada tarea; `pnpm build` y `pnpm --filter backend test:e2e` cuando el cambio los toca.
- Cierre de sprint (definición única de todo el proyecto): solo se declara cerrado cuando se cumplen TODAS: (1) `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm --filter backend test:e2e` y la suite Playwright del sprint (`pnpm test:e2e:web`) en verde; (2) sin `test.skip` ni esperas arbitrarias en la suite; (3) cada historia del sprint tiene su video y sus capturas revisadas en `e2e-evidence/sprint-NN/`; (4) la interfaz y los textos del sprint no contienen referencias a un sector específico; (5) `tasks.md` marcado y `board.md` actualizado. Si algo falla, el sprint no se declara cerrado: se reporta qué falló, por qué y qué se propone.
- Revisión de cumplimiento del legado: cada desvío queda registrado en `board.md`/sprint con su FR y el sprint que lo cierra.

## Governance

Esta constitución prevalece sobre cualquier otra práctica del proyecto. Las enmiendas requieren una decisión explícita del dueño del proyecto, una modificación fechada de este archivo y la actualización de las specs afectadas. Las directivas del dueño durante una sesión (p. ej. visibilidad, modelo case/contenido) son la entrada para la spec y, cuando sea necesario, para esta constitución.

**Version**: 2.1.1 | **Ratified**: 2026-11-23 | **Last Amended**: 2026-11-23

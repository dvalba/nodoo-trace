# AGENTS.md

Supply-chain traceability platform based on EPCIS 2.0. pnpm workspace with two packages: `backend/` (NestJS 12 + TypeORM + PostgreSQL 16) and `frontend/` (Angular 21, package name `nodoo-trace-web`). Run everything from the repo root.

## Commands

```bash
pnpm setup        # cp backend/.env.example -> backend/.env (skips if exists). Do this first.
pnpm install
pnpm start        # Postgres (:5434) + API (:3001) + web (:4200)
pnpm seed         # idempotent demo chain; builds backend then runs dist/scripts/seed.js. Needs .env + Postgres up.
pnpm db:up | db:down | db:reset   # docker compose; db:reset wipes the volume
pnpm lint         # oxlint, backend only (no frontend lint)
pnpm test         # backend unit tests only (vitest, pure mocks, no DB)
pnpm test:e2e:web # web E2E suite (Playwright in e2e/ package, spec 001 US16–US19); self-bootstraps DB supply_chain_e2e (drop/create/seed) and its own backend+web; keep the dev stack stopped (ports 3001/4200 free); evidence copied to e2e-evidence/sprint-NN/ (git-ignored)
pnpm build        # nest build + ng build (this is also the typecheck; there is no tsc script)
```

Focused runs:

```bash
pnpm --filter backend test src/event-ledger/event-ledger.service.spec.ts   # one spec file
pnpm --filter backend test -t "name"                                       # one test
pnpm --filter backend test:e2e                                             # e2e (see below)
pnpm --filter nodoo-trace-web test                                         # frontend tests (not in root `pnpm test`)
```

## Gotchas

- `backend/.env` is required for anything that boots the app (dev server, seed, e2e). Both docker compose and the app read it. Joi validation in `backend/src/config/env.validation.ts` rejects startup on missing/short vars (`JWT_SECRET`/`TOKEN_SECRET` need 32+ chars; `EMAIL_PROVIDER=smtp` additionally requires `SMTP_HOST/USER/PASS`).
- e2e (`test/traceability.e2e-spec.ts`) boots the real `AppModule` against the database in `.env` — needs Postgres up. It creates its own actors/users and cleans up after. Its config (`vitest.config.e2e.ts`) uses the `unplugin-swc` plugin on purpose: esbuild (vitest's default) does not emit `design:paramtypes`, and without it Nest's class-based DI cannot resolve dependencies. Do not remove the SWC plugin.
- The web E2E suite (`e2e/`, `pnpm test:e2e:web`) owns a dedicated database `supply_chain_e2e`: its global setup does `db:up` + drop/create/seed and boots its own backend + web (`reuseExistingServer: false`). Run it with the dev stack stopped (ports 3001/4200 free). Specs live in `e2e/tests/` — outside any `src/`.
- No migrations: schema is `synchronize` when `NODE_ENV !== 'production'`. To reset schema+data: `pnpm db:reset && pnpm db:up`.
- Non-standard ports are intentional: API `3001`, Postgres `5434`.
- Outgoing emails (invitations, verification) are pluggable: `EMAIL_PROVIDER=file` (default) writes to `backend/.mail-outbox.json` via `FileEmailSender`; `EMAIL_PROVIDER=smtp` uses nodemailer (`SmtpEmailSender`). The provider is wired in `InvitationsModule` through `createEmailSender()`.
- Frontend dev server proxies `/api/v1` to `localhost:3001` (`frontend/proxy.conf.json`).

## Code conventions

- Backend is ESM (`"type": "module"`, `module: nodenext`): relative imports must end in `.js` (e.g. `import { Foo } from './foo.service.js'`).
- Lint is oxlint with type-aware rules; `no-floating-promises` is an error, `no-explicit-any` is off.
- Vitest globals are enabled in backend specs.

## Domain notes

- The platform is a **generic, sector-agnostic** multi-tenant traceability SaaS — it is not a pharma/healthcare (or any other industry) product. The seed orgs (`laboratorio@`, `distribuidora@`, `hospital@`) are demo data for one example chain only; they do not define the product or its audience, and the sector must not be inferred from them. UI copy, icons, illustrations, empty states, examples and colors use neutral language (organization, actor, product, lot, unit, shipment, receiving, custody, event); sector vocabulary is only acceptable when it comes from a concrete organization's data. Test names, user stories, screenshots and videos are generic too (e.g. "Actor A ships a lot to Actor B", never "The lab ships drugs"). Tenant isolation is a testable property: E2E tests must verify it.
- Core module is `backend/src/event-ledger/` (EPCIS events, EPCs, event-EPC links); `twin-projector.ts` maintains the digital twin (current state per EPC). `epics-core/` holds the EPCIS enums/event types.
- Ledger visibility is scope-based and closed: the owner sees the product's full history (its entire chain); a custodian sees all events of its own custody window (including the owner's identity) but never the upstream chain (previous custodians, producers, transporters); the destination sees an in-transit case only as a shipment addressed to it (EPC + product) and completes the receiving by scanning the physical EPC label; a producer that is no longer the owner sees nothing; unrelated orgs get `404` (not 403). No actor may see parties of a supply chain it does not own.
- Traceable units: a traceable case (box) and the units of content it holds are separate digital twins (each its own EPC with its own history), linked by aggregation and fully separable — content can move between cases (unpack/transform) and a case can be left behind or returned empty. Disposable or indistinct packaging (plastic bags, generic pallets) is not serialized (no EPC, no history): it only has physical/logistical meaning.
- EPCIS operations (ship/receive/invoice/aggregate/transform) are gated on the org's activity, set during onboarding.
- Seed accounts (from `backend/src/seed/seed.service.ts`): `laboratorio@seed.nodoo.local`, `distribuidora@seed.nodoo.local`, `hospital@seed.nodoo.local`, all password `Seed1234`. IDs are deterministic. Note: the root README mentions `DEMO_SEED` and `@demo.nodoo.local`/`Demo1234` — that is stale, the code is the source of truth.

## Workflow (SDD)

- Read `.specify/memory/constitution.md` and the active spec in `specs/NNN-*/` before touching code.
- Never write code without an approved spec; if something is missing from the spec, fix the spec first — do not patch code by hand.
- Implement ONE task from `specs/NNN-*/tasks.md` at a time and stop when it is done.
- Work in vertical slices: each task delivers something runnable end to end.
- Do not add features, abstractions, or configuration the spec does not ask for.
- When a task is done: `pnpm lint` and `pnpm test` green (plus `pnpm build` / `pnpm --filter backend test:e2e` when the change touches them), tick the checkbox in `tasks.md`, and move the card in `board.md`.
- Sprint closure is defined once in the constitution (Quality Gates); `sprints/sprint-NN.md` adds only the sprint's specific evidence items and points to it — do not restate the criterion.
- Commit only when the user asks; then one commit per finished task, with the task ID in the message.

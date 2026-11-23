# Tareas 001 — Proveedor de correo conmutables (file / SMTP)

Orden de dependencia; una tarea a la vez. Marcar la casilla al terminar.

- [x] T1 Añadir dependencias `nodemailer` y `@types/nodemailer` al backend
  — RF: ninguno
  Hecho cuando: `pnpm install` queda limpio y `pnpm --filter backend build`
  compila con las nuevas deps.
- [x] T2 Extender `env.validation.ts` con la sección email (`EMAIL_PROVIDER`,
  `SMTP_HOST/PORT/SECURE/USER/PASS/FROM` condicionales, `MAIL_OUTBOX_PATH`)
  + tests del schema
  — RF-1, RF-3, RF-4
  Hecho cuando: los tests de validación pasan (smtp sin HOST/USER/PASS o con
  PASS vacía → error nombrando variables; proveedor inválido → error; file sin
  SMTP_* → válido) y `pnpm --filter backend test` está en verde.
- [x] T3 Reescribir `SmtpEmailSender` con nodemailer (transporte en el
  constructor, `send()` sin captura de errores) + tests con `vi.mock('nodemailer')`
  — RF-2, RF-5
  Hecho cuando: los tests verifican el mapeo `from/to/subject/text/html`, los
  defaults (587/false/from) y la propagación del error de `sendMail`.
- [x] T4 Crear `createEmailSender` en `email-sender.factory.ts`, cablear el
  provider en `InvitationsModule` con `useFactory` + `inject: [ConfigService]`
  + tests del factory
  — RF-1, RF-2
  Hecho cuando: los tests del factory pasan (ausente/file → FileEmailSender,
  smtp → SmtpEmailSender) y `pnpm --filter backend test` está en verde.
- [x] T5 Actualizar `.env.example` con la sección `# EMAIL` documentada
  — RF-1, RF-3
  Hecho cuando: `pnpm setup` genera un `.env` con las nuevas variables, la app
  arranca con el default `file` y escribe el outbox JSON.
- [x] T6 Verificación completa y demo manual
  — RF-1, RF-2, RF-3, RF-4, RF-5
  Hecho cuando: `pnpm lint`, `pnpm test`, `pnpm build` y
  `pnpm --filter backend test:e2e` en verde; demo manual cumplida (outbox con
  `file`; email entregado con un SMTP local de pruebas; arranque rechazado con
  SMTP incompleto y con proveedor inválido, con los mensajes correctos).

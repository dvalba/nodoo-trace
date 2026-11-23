# Plan 001 — Proveedor de correo conmutables (file / SMTP)

Cubre todos los RF de `spec.md`. La selección del proveedor vive en un factory
inyectado por `ConfigService`; la validación de la configuración se hace en el
schema Joi existente (fail fast al arrancar).

## Estructura de módulos

| Archivo | Cambio | RF |
| --- | --- | --- |
| `backend/src/common/interfaces/email-sender.ts` | Sin cambios (interface + token `Symbol`) | — |
| `backend/src/common/providers/file-email-sender.ts` | Sin cambios | RF-1 |
| `backend/src/common/providers/smtp-email-sender.ts` | **Reescritura** (hoy 100 % comentado, con imports incorrectos) | RF-2, RF-5 |
| `backend/src/common/providers/email-sender.factory.ts` | **Nuevo**: `createEmailSender(config)` | RF-1, RF-2 |
| `backend/src/invitations/invitations.module.ts` | Provider `EmailSender` → `useFactory` + `inject: [ConfigService]` | RF-1, RF-2 |
| `backend/src/config/env.validation.ts` | Sección email: `EMAIL_PROVIDER` + `SMTP_*` condicionales + `MAIL_OUTBOX_PATH` | RF-1, RF-3, RF-4 |
| `backend/.env.example` | Sección `# EMAIL` documentada | RF-1, RF-3 |
| `backend/package.json` | Deps: `nodemailer` (+ dev `@types/nodemailer`) | RF-2 |
| Tests: `email-sender.factory.spec.ts`, `smtp-email-sender.spec.ts`, ampliación de `env.validation.spec.ts` si existe | **Nuevos** | todos |

## Diseño

### `SmtpEmailSender` (RF-2, RF-5)

```ts
@Injectable()
export class SmtpEmailSender implements EmailSender {
  constructor(config: ConfigService) {
    this.transport = createTransport({
      host: config.get('SMTP_HOST'),
      port: config.get('SMTP_PORT'),        // 587 por defecto (Joi)
      secure: config.get('SMTP_SECURE'),    // false por defecto (Joi)
      auth: { user: config.get('SMTP_USER'), pass: config.get('SMTP_PASS') },
    });
    this.from = config.get('SMTP_FROM');
  }

  async send(message: EmailMessage): Promise<void> {
    await this.transport.sendMail({
      from: this.from, to: message.to, subject: message.subject,
      text: message.text, html: message.html,
    });
    this.logger.log(`Email sent to ${message.to}`);
  }
}
```

- El transporte se crea **una vez en el constructor** (pool de conexiones lo
  gestiona nodemailer). `send()` **no captura** errores: los propaga (RF-5) y
  deja el logging de fallo en el caller (`invitations.service.ts`, ya existente).
- `from` se lee una vez del config, no por envío.

### Factory (RF-1, RF-2)

```ts
export function createEmailSender(config: ConfigService): EmailSender {
  const provider = (config.get('EMAIL_PROVIDER') ?? 'file') as string;
  return provider === 'smtp' ? new SmtpEmailSender(config) : new FileEmailSender();
}
```

- `InvitationsModule` (único consumidor del token hoy) cambia el provider a:
  `{ provide: EmailSender, inject: [ConfigService], useFactory: (c) => createEmailSender(c) }`.
- El valor inválido no llega al factory: Joi ya impidió el arranque (RF-4).

### Validación de entorno (RF-1, RF-3, RF-4)

En `env.validation.ts`, nueva sección:

```ts
EMAIL_PROVIDER: Joi.string().valid('file', 'smtp').default('file'),
SMTP_HOST: Joi.string().min(1).when('EMAIL_PROVIDER', {
  is: 'smtp', then: Joi.required(), otherwise: Joi.optional(),
}),
SMTP_PORT: Joi.number().default(587),
SMTP_SECURE: Joi.boolean().default(false),
SMTP_USER: Joi.string().min(1).when('EMAIL_PROVIDER', { /* idem */ }),
SMTP_PASS: Joi.string().min(1).when('EMAIL_PROVIDER', { /* idem */ }),
SMTP_FROM: Joi.string().default('NodooTrace <no-reply@nodoo.local>'),
MAIL_OUTBOX_PATH: Joi.string().default('./.mail-outbox.json'),
```

- `.min(1)` en user/pass cubre el caso "cadena vacía = faltante" (caso límite).
- `ConfigModule.forRoot({ validationSchema })` ya es global en `app.module.ts`:
  no hay cambios ahí.

## Decisiones técnicas y alternativas descartadas

1. **nodemailer** para SMTP.
   Alternativas descartadas: cliente SMTP crudo (`smtp-connection`) — demasiado
   bajo nivel (TLS, auth, MIME); SDK de AWS SES — lock-in a un proveedor cloud.
2. **Validación condicional en Joi** (fail fast al arrancar).
   Descartada: lanzar error en el factory al construir el transporte — el fallo
   sería tardío y el mensaje menos claro que el del schema.
3. **Provider definido en `InvitationsModule`** (único consumidor).
   Descartada: extraer un `MailerModule` global — YAGNI; si aparece un segundo
   consumidor se extrae entonces (un cambio de 2 líneas).
4. **Transporte en el constructor**, no por envío.
   Descartada: crearlo por `send()` — sin pool, latencia de handshake por email.
5. **`SMTP_FROM` configurable con default**, no derivado de `SMTP_HOST`.
   Descartada: derivar `no-reply@<host>` — el host SMTP rara vez es el dominio
   de remitente válido (SPF/DKIM).

## Estrategia de tests

Todos unitarios, vitest, sin DB ni red.

1. `email-sender.factory.spec.ts` — RF-1, RF-2:
   - `EMAIL_PROVIDER` ausente → `FileEmailSender`.
   - `EMAIL_PROVIDER=file` → `FileEmailSender`.
   - `EMAIL_PROVIDER=smtp` → `SmtpEmailSender`.
2. `smtp-email-sender.spec.ts` — RF-2, RF-5 (con `vi.mock('nodemailer')`):
   - Mapea `from/to/subject/text/html` a `sendMail`.
   - Usa defaults `587` / `false` / from por defecto cuando no hay vars.
   - Si `sendMail` rechaza, `send()` rechaza con el mismo error (no lo traga).
3. `env.validation` (spec existente o nueva) — RF-3, RF-4:
   - `EMAIL_PROVIDER=smtp` sin `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS` → error
     nombrando cada variable.
   - `EMAIL_PROVIDER=smtp` completo → válido.
   - `EMAIL_PROVIDER=file` sin SMTP_* → válido.
   - `EMAIL_PROVIDER=carrier-pigeon` → error con los valores válidos.
   - `SMTP_PASS=` (vacía) con `smtp` → error.

// oxlint-disable unicorn/no-thenable
import Joi from 'joi';

export const envValidationSchema = Joi.object({
  // ─── Application ─────────────────────────────────────────────────────────
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().default(3001),
  PLATFORM_NAME: Joi.string().min(1).required(),
  HOST_FRONT: Joi.string().uri({ scheme: ['http', 'https'] }).required(),

  // ─── Database ────────────────────────────────────────────────────────────
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(5434),
  DB_NAME: Joi.string().required(),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),

  // ─── JWT ─────────────────────────────────────────────────────────────────
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('2h'),

  // ─── Invitations ─────────────────────────────────────────────────────────
  TOKEN_SECRET: Joi.string().min(32).required(),
  INVITATION_RESEND_INTERVAL: Joi.string().required(),
  INVITATION_EXPIRES_IN: Joi.string().required(),

  // ─── Email ───────────────────────────────────────────────────────────────
  EMAIL_PROVIDER: Joi.string().valid('file', 'smtp').default('file'),
  SMTP_HOST: Joi.string()
    .min(1)
    .when('EMAIL_PROVIDER', {
      is: 'smtp',
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
  SMTP_PORT: Joi.number().default(587),
  SMTP_SECURE: Joi.boolean().default(false),
  SMTP_USER: Joi.string()
    .min(1)
    .when('EMAIL_PROVIDER', {
      is: 'smtp',
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
  SMTP_PASS: Joi.string()
    .min(1)
    .when('EMAIL_PROVIDER', {
      is: 'smtp',
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
  SMTP_FROM: Joi.string().default('NodooTrace <no-reply@nodoo.local>'),
  MAIL_OUTBOX_PATH: Joi.string().default('./.mail-outbox.json'),
});
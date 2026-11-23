import { describe, expect, it } from 'vitest';
import { envValidationSchema } from './env.validation.js';

const baseEnv = {
  NODE_ENV: 'development',
  PORT: '3001',
  PLATFORM_NAME: 'NodooTrace',
  HOST_FRONT: 'http://localhost:4200',
  DB_HOST: 'localhost',
  DB_PORT: '5434',
  DB_NAME: 'supply_chain_db',
  DB_USERNAME: 'postgres',
  DB_PASSWORD: 'postgres',
  JWT_SECRET: 'a'.repeat(32),
  JWT_EXPIRES_IN: '2h',
  TOKEN_SECRET: 'b'.repeat(32),
  INVITATION_RESEND_INTERVAL: '5m',
  INVITATION_EXPIRES_IN: '7d',
};

// abortEarly: false refleja cómo valida @nestjs/config (JOI_DEFAULT_LIBRARY_OPTIONS)
function validate(env: Record<string, unknown>) {
  return envValidationSchema.validate(
    { ...baseEnv, ...env },
    { abortEarly: false },
  );
}

function detailMessages(error: Error | undefined): string {
  if (!error) return '';
  const { details } = error as { details: { message: string }[] };
  return details.map((d) => d.message).join(' ');
}

describe('envValidationSchema — email', () => {
  it('defaults EMAIL_PROVIDER to file and accepts an env without SMTP vars', () => {
    const { error, value } = validate({});
    expect(error).toBeUndefined();
    expect(value.EMAIL_PROVIDER).toBe('file');
  });

  it('applies the SMTP defaults (port 587, insecure, default from) when valid', () => {
    const { error, value } = validate({
      EMAIL_PROVIDER: 'smtp',
      SMTP_HOST: 'smtp.local',
      SMTP_USER: 'user',
      SMTP_PASS: 'pass',
    });
    expect(error).toBeUndefined();
    expect(value.SMTP_PORT).toBe(587);
    expect(value.SMTP_SECURE).toBe(false);
    expect(value.SMTP_FROM).toBe('NodooTrace <no-reply@nodoo.local>');
    expect(value.MAIL_OUTBOX_PATH).toBe('./.mail-outbox.json');
  });

  it('rejects smtp without SMTP_HOST/SMTP_USER/SMTP_PASS, naming each variable', () => {
    const { error } = validate({ EMAIL_PROVIDER: 'smtp' });
    expect(error).toBeDefined();
    const detail = detailMessages(error);
    expect(detail).toContain('SMTP_HOST');
    expect(detail).toContain('SMTP_USER');
    expect(detail).toContain('SMTP_PASS');
  });

  it('treats an empty SMTP_PASS as missing under smtp', () => {
    const { error } = validate({
      EMAIL_PROVIDER: 'smtp',
      SMTP_HOST: 'smtp.local',
      SMTP_USER: 'user',
      SMTP_PASS: '',
    });
    expect(error).toBeDefined();
    expect(detailMessages(error)).toContain('SMTP_PASS');
  });

  it('rejects an unknown EMAIL_PROVIDER showing the valid values', () => {
    const { error } = validate({ EMAIL_PROVIDER: 'carrier-pigeon' });
    expect(error).toBeDefined();
    const detail = detailMessages(error);
    expect(detail).toContain('file');
    expect(detail).toContain('smtp');
  });

  it('rejects a non-numeric SMTP_PORT', () => {
    const { error } = validate({
      EMAIL_PROVIDER: 'smtp',
      SMTP_HOST: 'smtp.local',
      SMTP_USER: 'user',
      SMTP_PASS: 'pass',
      SMTP_PORT: 'not-a-port',
    });
    expect(error).toBeDefined();
    expect(detailMessages(error)).toContain('SMTP_PORT');
  });
});

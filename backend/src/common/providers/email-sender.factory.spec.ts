import { describe, expect, it } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { createEmailSender } from './email-sender.factory.js';
import { FileEmailSender } from './file-email-sender.js';
import { SmtpEmailSender } from './smtp-email-sender.js';

describe('createEmailSender', () => {
  it('returns the file sender when EMAIL_PROVIDER is missing', () => {
    const sender = createEmailSender(new ConfigService({}));
    expect(sender).toBeInstanceOf(FileEmailSender);
  });

  it('returns the file sender for EMAIL_PROVIDER=file', () => {
    const sender = createEmailSender(
      new ConfigService({ EMAIL_PROVIDER: 'file' }),
    );
    expect(sender).toBeInstanceOf(FileEmailSender);
  });

  it('returns the smtp sender for EMAIL_PROVIDER=smtp', () => {
    const sender = createEmailSender(
      new ConfigService({
        EMAIL_PROVIDER: 'smtp',
        SMTP_HOST: 'smtp.local',
        SMTP_USER: 'user',
        SMTP_PASS: 'pass',
      }),
    );
    expect(sender).toBeInstanceOf(SmtpEmailSender);
  });
});

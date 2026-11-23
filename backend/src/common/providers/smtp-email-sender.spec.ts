import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { SmtpEmailSender } from './smtp-email-sender.js';

const mockSendMail = vi.fn();
const mockCreateTransport = vi.fn(() => ({ sendMail: mockSendMail }));

vi.mock('nodemailer', () => ({
  createTransport: (...args: unknown[]) => mockCreateTransport(...args),
}));

function configWith(
  env: Record<string, string | number | boolean>,
): ConfigService {
  return new ConfigService(env);
}

describe('SmtpEmailSender', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateTransport.mockReturnValue({ sendMail: mockSendMail });
  });

  it('builds the transport from the SMTP config', () => {
    new SmtpEmailSender(
      configWith({
        SMTP_HOST: 'smtp.local',
        SMTP_PORT: 2525,
        SMTP_SECURE: true,
        SMTP_USER: 'user',
        SMTP_PASS: 'pass',
      }),
    );

    expect(mockCreateTransport).toHaveBeenCalledWith({
      host: 'smtp.local',
      port: 2525,
      secure: true,
      auth: { user: 'user', pass: 'pass' },
    });
  });

  it('falls back to port 587 and insecure when port/secure are absent', () => {
    new SmtpEmailSender(configWith({ SMTP_HOST: 'smtp.local' }));

    expect(mockCreateTransport).toHaveBeenCalledWith(
      expect.objectContaining({ port: 587, secure: false }),
    );
  });

  it('maps the message to sendMail verbatim', async () => {
    const sender = new SmtpEmailSender(
      configWith({
        SMTP_HOST: 'smtp.local',
        SMTP_USER: 'user',
        SMTP_PASS: 'pass',
        SMTP_FROM: 'Nodoo <noreply@nodoo.local>',
      }),
    );

    await sender.send({
      to: 'user@example.com',
      subject: 'Hi',
      text: 'plain text',
      html: '<p>html</p>',
    });

    expect(mockSendMail).toHaveBeenCalledWith({
      from: 'Nodoo <noreply@nodoo.local>',
      to: 'user@example.com',
      subject: 'Hi',
      text: 'plain text',
      html: '<p>html</p>',
    });
  });

  it('uses the default sender when SMTP_FROM is absent', async () => {
    const sender = new SmtpEmailSender(
      configWith({
        SMTP_HOST: 'smtp.local',
        SMTP_USER: 'user',
        SMTP_PASS: 'pass',
      }),
    );

    await sender.send({ to: 'user@example.com', subject: 'Hi' });

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'NodooTrace <no-reply@nodoo.local>' }),
    );
  });

  it('propagates transport errors instead of swallowing them', async () => {
    const failure = new Error('connect ECONNREFUSED 127.0.0.1:2525');
    mockSendMail.mockRejectedValueOnce(failure);
    const sender = new SmtpEmailSender(
      configWith({ SMTP_HOST: 'smtp.local' }),
    );

    await expect(
      sender.send({ to: 'user@example.com', subject: 'Hi' }),
    ).rejects.toBe(failure);
  });
});

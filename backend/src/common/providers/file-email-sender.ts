import { Injectable, Logger } from "@nestjs/common";
import { EmailMessage, EmailSender } from "../interfaces/email-sender.js";
import { dirname } from "path";
import { promises as fs } from 'node:fs';

interface StoredEmail {
  to: string;
  subject: string;
  text: string;
  html: string | null; // ← dev: URLs de verificación solo van en el html
  sentAt: string;
}

@Injectable()
export class FileEmailSender implements EmailSender {
  private readonly logger = new Logger(FileEmailSender.name);
  private readonly filePath = process.env.MAIL_OUTBOX_PATH ?? './.mail-outbox.json';

  // Serializamos escrituras para que requests concurrentes no pisen el archivo
  private writeChain: Promise<void> = Promise.resolve();

  async send(message: EmailMessage): Promise<void> {
    this.writeChain = this.writeChain.then(() => this.appendToFile(message));
    return this.writeChain;
  }

  private async appendToFile(message: EmailMessage): Promise<void> {
    const stored: StoredEmail = {
      to: message.to,
      subject: message.subject,
      text: message.text ?? message.html ?? '',
      html: message.html ?? null,
      sentAt: new Date().toISOString(),
    };

    const emails = await this.readExisting();
    emails.push(stored);

    await fs.mkdir(dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(emails, null, 2), 'utf-8');

    this.logger.log(`[MOCK] Email to ${message.to} written to ${this.filePath}`);
  }

  private async readExisting(): Promise<StoredEmail[]> {
    try {
      return JSON.parse(await fs.readFile(this.filePath, 'utf-8'));
    } catch (err: any) {
      if (err?.code === 'ENOENT') return [];
      throw err;
    }
  }
}
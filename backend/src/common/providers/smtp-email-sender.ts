// // common/providers/real/smtp-email-sender.ts
// import { Injectable, Logger } from '@nestjs/common';
// import { ConfigService } from '@nestjs/config';
// // import { createTransport, Transporter } from 'nodemailer';
// // import { EmailMessage, EmailSender } from '../../interfaces/email-sender.interface.js';

// @Injectable()
// export class SmtpEmailSender implements EmailSender {
//   private readonly logger = new Logger(SmtpEmailSender.name);
//   private readonly transport: Transporter;

//   constructor(config: ConfigService) {
//     this.transport = createTransport({
//       host: config.get<string>('SMTP_HOST'),
//       port: config.get<number>('SMTP_PORT', 587),
//       secure: config.get<boolean>('SMTP_SECURE', false),
//       auth: {
//         user: config.get<string>('SMTP_USER'),
//         pass: config.get<string>('SMTP_PASS'),
//       },
//     });
//   }

//   async send(message: EmailMessage): Promise<void> {
//     await this.transport.sendMail({
//       from: 'no-reply@supplychain.app',
//       to: message.to,
//       subject: message.subject,
//       text: message.text,
//       html: message.html,
//     });
//     this.logger.log(`Email sent to ${message.to}`);
//   }
// }
import { ConfigService } from "@nestjs/config";
import { EmailSender } from "../interfaces/email-sender.js";
import { FileEmailSender } from "./file-email-sender.js";
import { SmtpEmailSender } from "./smtp-email-sender.js";

export function createEmailSender(config: ConfigService): EmailSender {
  const provider = config.get<string>("EMAIL_PROVIDER") ?? "file";
  return provider === "smtp" ? new SmtpEmailSender(config) : new FileEmailSender(config);
}

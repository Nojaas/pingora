import nodemailer from "nodemailer";
import { sendEmailViaSes } from "./ses.js";
import { resolveEmailProvider, type SendEmailInput } from "./types.js";

export type { SendEmailInput } from "./types.js";
export { resolveEmailProvider } from "./types.js";

export type SmtpTransportEnv = {
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  SMTP_SECURE?: string;
};

export function buildSmtpTransportOptions(env: SmtpTransportEnv = process.env) {
  const host = env.SMTP_HOST ?? "localhost";
  const port = Number(env.SMTP_PORT ?? 1025);
  const user = env.SMTP_USER?.trim();
  const pass = env.SMTP_PASS;
  const secure =
    env.SMTP_SECURE?.toLowerCase() === "true" ||
    env.SMTP_SECURE === "1" ||
    port === 465;

  return {
    host,
    port,
    secure,
    ...(user
      ? {
          auth: {
            user,
            pass: pass ?? "",
          },
        }
      : {}),
  };
}

function createTransporter() {
  return nodemailer.createTransport(buildSmtpTransportOptions());
}

async function sendEmailViaNodemailer(input: SendEmailInput): Promise<string> {
  const from = process.env.SMTP_FROM ?? "pingora@localhost";
  const transporter = createTransporter();

  const info = await transporter.sendMail({
    from,
    to: input.to,
    subject: input.subject,
    text: input.body,
  });

  return info.messageId;
}

export async function sendEmail(input: SendEmailInput): Promise<string> {
  const provider = resolveEmailProvider();

  if (provider === "ses") {
    return sendEmailViaSes(input);
  }

  return sendEmailViaNodemailer(input);
}

import nodemailer from "nodemailer";
import { resolveEmailProvider, type SendEmailInput } from "./types.js";
import { sendEmailViaSes } from "./ses.js";

export type { SendEmailInput } from "./types.js";
export { resolveEmailProvider } from "./types.js";

function createTransporter() {
  const host = process.env.SMTP_HOST ?? "localhost";
  const port = Number(process.env.SMTP_PORT ?? 1025);

  return nodemailer.createTransport({
    host,
    port,
    secure: false,
  });
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

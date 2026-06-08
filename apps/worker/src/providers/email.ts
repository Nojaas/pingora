import nodemailer from "nodemailer";

export type SendEmailInput = {
  to: string;
  subject: string;
  body: string;
};

function createTransporter() {
  const host = process.env.SMTP_HOST ?? "localhost";
  const port = Number(process.env.SMTP_PORT ?? 1025);

  return nodemailer.createTransport({
    host,
    port,
    secure: false,
  });
}

export async function sendEmail(input: SendEmailInput) {
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

export type SendEmailInput = {
  to: string;
  subject: string;
  body: string;
};

export type EmailProviderName = "nodemailer" | "ses" | "resend";

export function resolveEmailProvider(
  env: NodeJS.ProcessEnv = process.env,
): EmailProviderName {
  const raw = (env.EMAIL_PROVIDER ?? "nodemailer").toLowerCase().trim();

  if (raw === "ses") {
    return "ses";
  }

  if (raw === "resend") {
    return "resend";
  }

  return "nodemailer";
}

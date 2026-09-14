import type { SendEmailInput } from "./types.js";

export type ResendEnv = {
  RESEND_API_KEY?: string;
  SMTP_FROM?: string;
};

export async function sendEmailViaResend(
  input: SendEmailInput,
  env: ResendEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const apiKey = env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is required when EMAIL_PROVIDER=resend");
  }

  const from = env.SMTP_FROM ?? "onboarding@resend.dev";

  const response = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      text: input.body,
    }),
  });

  const payload = (await response.json().catch(() => null)) as {
    id?: string;
    message?: string;
    name?: string;
  } | null;

  if (!response.ok) {
    const detail =
      payload?.message ?? payload?.name ?? `HTTP ${response.status}`;
    throw new Error(`Resend API error: ${detail}`);
  }

  if (!payload?.id) {
    throw new Error("Resend API error: missing email id in response");
  }

  return payload.id;
}

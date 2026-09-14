import { describe, expect, it, vi } from "vitest";
import { buildSmtpTransportOptions } from "./email.js";
import { sendEmailViaResend } from "./resend.js";
import { buildSesClientConfig } from "./ses.js";
import { resolveEmailProvider } from "./types.js";

describe("resolveEmailProvider", () => {
  it("defaults to nodemailer", () => {
    expect(resolveEmailProvider({})).toBe("nodemailer");
  });

  it("selects ses", () => {
    expect(resolveEmailProvider({ EMAIL_PROVIDER: "ses" })).toBe("ses");
  });

  it("selects resend", () => {
    expect(resolveEmailProvider({ EMAIL_PROVIDER: "resend" })).toBe("resend");
  });

  it("is case-insensitive", () => {
    expect(resolveEmailProvider({ EMAIL_PROVIDER: "SES" })).toBe("ses");
  });

  it("falls back to nodemailer for unknown values", () => {
    expect(resolveEmailProvider({ EMAIL_PROVIDER: "mailgun" })).toBe(
      "nodemailer",
    );
  });
});

describe("buildSmtpTransportOptions", () => {
  it("defaults to local Mailpit without auth", () => {
    expect(buildSmtpTransportOptions({})).toEqual({
      host: "localhost",
      port: 1025,
      secure: false,
    });
  });

  it("configures Resend SMTP with auth and secure port 465", () => {
    expect(
      buildSmtpTransportOptions({
        SMTP_HOST: "smtp.resend.com",
        SMTP_PORT: "465",
        SMTP_USER: "resend",
        SMTP_PASS: "re_test",
      }),
    ).toEqual({
      host: "smtp.resend.com",
      port: 465,
      secure: true,
      auth: {
        user: "resend",
        pass: "re_test",
      },
    });
  });

  it("honors SMTP_SECURE=true on non-465 ports", () => {
    expect(
      buildSmtpTransportOptions({
        SMTP_HOST: "smtp.example.com",
        SMTP_PORT: "587",
        SMTP_SECURE: "true",
        SMTP_USER: "user",
        SMTP_PASS: "pass",
      }),
    ).toMatchObject({
      port: 587,
      secure: true,
      auth: { user: "user", pass: "pass" },
    });
  });
});

describe("sendEmailViaResend", () => {
  it("posts to Resend HTTP API and returns the email id", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "email_123" }),
    });

    const id = await sendEmailViaResend(
      {
        to: "user@example.com",
        subject: "Hello",
        body: "World",
      },
      {
        RESEND_API_KEY: "re_test",
        SMTP_FROM: "onboarding@resend.dev",
      },
      fetchImpl as unknown as typeof fetch,
    );

    expect(id).toBe("email_123");
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer re_test",
          "Content-Type": "application/json",
        },
      }),
    );
  });

  it("throws when RESEND_API_KEY is missing", async () => {
    await expect(
      sendEmailViaResend(
        { to: "a@b.com", subject: "s", body: "b" },
        {},
        vi.fn() as unknown as typeof fetch,
      ),
    ).rejects.toThrow(/RESEND_API_KEY/);
  });
});

describe("buildSesClientConfig", () => {
  it("uses LocalStack endpoint and dummy credentials", () => {
    const config = buildSesClientConfig({
      AWS_ENDPOINT: "http://localhost:4566",
      AWS_REGION: "eu-west-1",
      AWS_ACCESS_KEY_ID: "test",
      AWS_SECRET_ACCESS_KEY: "test",
    });

    expect(config).toMatchObject({
      region: "eu-west-1",
      endpoint: "http://localhost:4566",
      credentials: {
        accessKeyId: "test",
        secretAccessKey: "test",
      },
    });
  });

  it("omits endpoint when not set (real AWS)", () => {
    const config = buildSesClientConfig({
      AWS_REGION: "eu-west-1",
      AWS_ACCESS_KEY_ID: "AKIA",
      AWS_SECRET_ACCESS_KEY: "secret",
    });

    expect(config.endpoint).toBeUndefined();
    expect(config.region).toBe("eu-west-1");
  });
});

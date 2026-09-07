import { describe, expect, it } from "vitest";
import { buildSesClientConfig } from "./ses.js";
import { resolveEmailProvider } from "./types.js";

describe("resolveEmailProvider", () => {
  it("defaults to nodemailer", () => {
    expect(resolveEmailProvider({})).toBe("nodemailer");
  });

  it("selects ses", () => {
    expect(resolveEmailProvider({ EMAIL_PROVIDER: "ses" })).toBe("ses");
  });

  it("is case-insensitive", () => {
    expect(resolveEmailProvider({ EMAIL_PROVIDER: "SES" })).toBe("ses");
  });

  it("falls back to nodemailer for unknown values", () => {
    expect(resolveEmailProvider({ EMAIL_PROVIDER: "resend" })).toBe(
      "nodemailer",
    );
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

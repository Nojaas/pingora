import { afterEach, describe, expect, it, vi } from "vitest";

const { sendMock } = vi.hoisted(() => ({
  sendMock: vi.fn(),
}));

vi.mock("@aws-sdk/client-ses", () => {
  class SendEmailCommand {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  }

  class SESClient {
    send = sendMock;
  }

  return { SESClient, SendEmailCommand };
});

import { sendEmailViaSes } from "./ses.js";

describe("sendEmailViaSes", () => {
  afterEach(() => {
    sendMock.mockReset();
  });

  it("sends via SES and returns MessageId", async () => {
    sendMock.mockResolvedValue({ MessageId: "ses-msg-1" });

    const messageId = await sendEmailViaSes(
      {
        to: "user@example.com",
        subject: "Hello",
        body: "World",
      },
      {
        SMTP_FROM: "pingora@localhost",
        AWS_ENDPOINT: "http://localhost:4566",
        AWS_REGION: "eu-west-1",
        AWS_ACCESS_KEY_ID: "test",
        AWS_SECRET_ACCESS_KEY: "test",
      },
    );

    expect(messageId).toBe("ses-msg-1");
    expect(sendMock).toHaveBeenCalledOnce();

    const command = sendMock.mock.calls[0]?.[0] as { input: Record<string, unknown> };
    expect(command.input).toMatchObject({
      Source: "pingora@localhost",
      Destination: { ToAddresses: ["user@example.com"] },
      Message: {
        Subject: { Data: "Hello", Charset: "UTF-8" },
        Body: { Text: { Data: "World", Charset: "UTF-8" } },
      },
    });
  });

  it("throws when SES returns no MessageId", async () => {
    sendMock.mockResolvedValue({});

    await expect(
      sendEmailViaSes({
        to: "user@example.com",
        subject: "Hello",
        body: "World",
      }),
    ).rejects.toThrow("SES SendEmail returned no MessageId");
  });
});

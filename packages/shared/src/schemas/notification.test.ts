import { describe, expect, it } from "vitest";
import {
  createNotificationBodySchema,
  toApiChannel,
  toApiStatus,
  toPrismaChannel,
} from "./notification.js";

const validEmailPayload = {
  channel: "email" as const,
  recipient: "user@example.com",
  subject: "Hello",
  body: "World",
};

describe("createNotificationBodySchema", () => {
  it("accepts a valid email payload", () => {
    const result = createNotificationBodySchema.safeParse(validEmailPayload);
    expect(result.success).toBe(true);
  });

  it("accepts optional metadata", () => {
    const result = createNotificationBodySchema.safeParse({
      ...validEmailPayload,
      metadata: { orderId: "1234" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects email without subject", () => {
    const result = createNotificationBodySchema.safeParse({
      channel: "email",
      recipient: "user@example.com",
      body: "World",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email recipient", () => {
    const result = createNotificationBodySchema.safeParse({
      ...validEmailPayload,
      recipient: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid sms payload", () => {
    const result = createNotificationBodySchema.safeParse({
      channel: "sms",
      recipient: "+33612345678",
      body: "Code: 1234",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid sms phone number", () => {
    const result = createNotificationBodySchema.safeParse({
      channel: "sms",
      recipient: "0612345678",
      body: "Code: 1234",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty body", () => {
    const result = createNotificationBodySchema.safeParse({
      ...validEmailPayload,
      body: "   ",
    });
    expect(result.success).toBe(false);
  });
});

describe("channel and status mappers", () => {
  it("maps api channel to prisma enum", () => {
    expect(toPrismaChannel("email")).toBe("EMAIL");
    expect(toPrismaChannel("sms")).toBe("SMS");
    expect(toPrismaChannel("push")).toBe("PUSH");
  });

  it("maps prisma channel to api", () => {
    expect(toApiChannel("EMAIL")).toBe("email");
  });

  it("maps prisma status to api lowercase", () => {
    expect(toApiStatus("QUEUED")).toBe("queued");
    expect(toApiStatus("PENDING")).toBe("pending");
  });
});

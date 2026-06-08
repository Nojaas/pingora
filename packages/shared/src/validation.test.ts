import { describe, expect, it } from "vitest";
import { z } from "zod";
import { formatZodError } from "./validation.js";

describe("formatZodError", () => {
  it("returns a stable validation error shape", () => {
    const schema = z.object({
      recipient: z.string().email(),
    });

    const result = schema.safeParse({ recipient: "bad" });
    if (result.success) {
      throw new Error("expected validation failure");
    }

    expect(formatZodError(result.error)).toEqual({
      error: "validation_error",
      message: "Invalid request body",
      details: {
        recipient: ["Invalid email"],
      },
    });
  });
});

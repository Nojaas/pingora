import type { ZodError } from "zod";

export function formatZodError(error: ZodError) {
  return {
    error: "validation_error" as const,
    message: "Invalid request body",
    details: error.flatten().fieldErrors,
  };
}

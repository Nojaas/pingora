import { afterEach, describe, expect, it, vi } from "vitest";
import {
  LOG_SERVICES,
  buildLoggerOptions,
  createLogger,
  resolveLogLevel,
} from "./logger.js";

describe("resolveLogLevel", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses LOG_LEVEL when valid", () => {
    vi.stubEnv("LOG_LEVEL", "warn");
    expect(resolveLogLevel()).toBe("warn");
  });

  it("defaults to debug outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("LOG_LEVEL", "");
    expect(resolveLogLevel()).toBe("debug");
  });

  it("defaults to info in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LOG_LEVEL", "");
    expect(resolveLogLevel()).toBe("info");
  });
});

describe("buildLoggerOptions", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("includes service metadata", () => {
    vi.stubEnv("NODE_ENV", "production");
    const options = buildLoggerOptions(LOG_SERVICES.API);

    expect(options.base).toEqual({
      service: "pingora-api",
      version: "0.0.0",
    });
    expect(options.level).toBe("info");
    expect(options.transport).toBeUndefined();
  });

  it("enables pretty transport in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    const options = buildLoggerOptions(LOG_SERVICES.WORKER);

    expect(options.transport).toMatchObject({
      target: "pino-pretty",
    });
  });
});

describe("createLogger", () => {
  it("returns a pino logger", () => {
    vi.stubEnv("NODE_ENV", "production");
    const logger = createLogger(LOG_SERVICES.API);
    expect(typeof logger.info).toBe("function");
    vi.unstubAllEnvs();
  });
});

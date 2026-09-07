import { afterEach, describe, expect, it, vi } from "vitest";
import {
  extractBearerToken,
  isInternalAccessAuthorized,
  resolveMetricsSecret,
} from "./internal-auth.js";

describe("resolveMetricsSecret", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("prefers METRICS_SECRET over ADMIN_SECRET", () => {
    vi.stubEnv("METRICS_SECRET", "metrics-token");
    vi.stubEnv("ADMIN_SECRET", "admin-token");
    expect(resolveMetricsSecret()).toBe("metrics-token");
  });

  it("falls back to ADMIN_SECRET", () => {
    vi.stubEnv("METRICS_SECRET", undefined);
    vi.stubEnv("ADMIN_SECRET", "admin-token");
    expect(resolveMetricsSecret()).toBe("admin-token");
  });
});

describe("extractBearerToken", () => {
  it("parses bearer authorization header", () => {
    expect(extractBearerToken("Bearer secret-token")).toBe("secret-token");
  });

  it("returns undefined for invalid header", () => {
    expect(extractBearerToken("Basic abc")).toBeUndefined();
  });
});

describe("isInternalAccessAuthorized", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts bearer token", () => {
    vi.stubEnv("METRICS_SECRET", "metrics-token");
    const authorized = isInternalAccessAuthorized({
      headers: {
        authorization: "Bearer metrics-token",
      },
    } as never);

    expect(authorized).toBe(true);
  });

  it("accepts x-metrics-token header", () => {
    vi.stubEnv("METRICS_SECRET", "metrics-token");
    const authorized = isInternalAccessAuthorized({
      headers: {
        "x-metrics-token": "metrics-token",
      },
    } as never);

    expect(authorized).toBe(true);
  });

  it("rejects invalid token", () => {
    vi.stubEnv("METRICS_SECRET", "metrics-token");
    const authorized = isInternalAccessAuthorized({
      headers: {
        authorization: "Bearer wrong",
      },
    } as never);

    expect(authorized).toBe(false);
  });
});

import { NextResponse } from "next/server";
import { DashboardApiError, fetchWebhookDeliveries } from "../../../lib/api";
import type { WebhookDeliveryStatus } from "../../../lib/types";

export const dynamic = "force-dynamic";

function optionalParam<T extends string>(
  value: string | null,
  allowed: readonly T[],
): T | undefined {
  if (!value) return undefined;
  return (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limitRaw = Number(searchParams.get("limit") ?? "25");
  const limit = Number.isFinite(limitRaw)
    ? Math.min(100, Math.max(1, Math.trunc(limitRaw)))
    : 25;

  const status = optionalParam(searchParams.get("status"), [
    "success",
    "failed",
    "pending",
    "retrying",
  ] as const satisfies readonly WebhookDeliveryStatus[]);

  try {
    const payload = await fetchWebhookDeliveries({ limit, status });
    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof DashboardApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: "Failed to fetch webhook deliveries" },
      { status: 502 },
    );
  }
}

import { NextResponse } from "next/server";
import { DashboardApiError, fetchDashboardSummary } from "../../../lib/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const hoursRaw = Number(searchParams.get("windowHours") ?? "24");
  const windowHours = Number.isFinite(hoursRaw)
    ? Math.min(168, Math.max(1, Math.trunc(hoursRaw)))
    : 24;

  try {
    const payload = await fetchDashboardSummary(windowHours);
    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof DashboardApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch dashboard summary" },
      { status: 502 },
    );
  }
}

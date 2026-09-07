import { NextResponse } from "next/server";
import { DashboardApiError, fetchQueues } from "../../../lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const payload = await fetchQueues();
    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof DashboardApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: "Failed to fetch queues" },
      { status: 502 },
    );
  }
}

import { z } from "zod";

export const dashboardSummaryQuerySchema = z.object({
  /** Lookback window in hours (default 24). */
  windowHours: z.coerce.number().int().min(1).max(168).default(24),
});

export type DashboardSummaryQuery = z.infer<typeof dashboardSummaryQuerySchema>;

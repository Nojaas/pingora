import { create } from "zustand";
import type { NotificationChannel, NotificationStatus } from "../lib/types";

export type RefreshIntervalMs = 0 | 5_000 | 15_000 | 30_000;

type DashboardUiState = {
  status: NotificationStatus | "all";
  channel: NotificationChannel | "all";
  refreshIntervalMs: RefreshIntervalMs;
  setStatus: (status: NotificationStatus | "all") => void;
  setChannel: (channel: NotificationChannel | "all") => void;
  setRefreshIntervalMs: (ms: RefreshIntervalMs) => void;
};

export const useDashboardUi = create<DashboardUiState>()((set) => ({
  status: "all",
  channel: "all",
  refreshIntervalMs: 15_000,
  setStatus: (status) => set({ status }),
  setChannel: (channel) => set({ channel }),
  setRefreshIntervalMs: (refreshIntervalMs) => set({ refreshIntervalMs }),
}));

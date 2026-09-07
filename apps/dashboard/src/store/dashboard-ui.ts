import { create } from "zustand";
import type {
  NotificationChannel,
  NotificationStatus,
  WebhookDeliveryStatus,
} from "../lib/types";

export type RefreshIntervalMs = 0 | 5_000 | 15_000 | 30_000;

type DashboardUiState = {
  status: NotificationStatus | "all";
  channel: NotificationChannel | "all";
  deliveryStatus: WebhookDeliveryStatus | "all";
  refreshIntervalMs: RefreshIntervalMs;
  setStatus: (status: NotificationStatus | "all") => void;
  setChannel: (channel: NotificationChannel | "all") => void;
  setDeliveryStatus: (status: WebhookDeliveryStatus | "all") => void;
  setRefreshIntervalMs: (ms: RefreshIntervalMs) => void;
};

export const useDashboardUi = create<DashboardUiState>()((set) => ({
  status: "all",
  channel: "all",
  deliveryStatus: "all",
  refreshIntervalMs: 15_000,
  setStatus: (status) => set({ status }),
  setChannel: (channel) => set({ channel }),
  setDeliveryStatus: (deliveryStatus) => set({ deliveryStatus }),
  setRefreshIntervalMs: (refreshIntervalMs) => set({ refreshIntervalMs }),
}));

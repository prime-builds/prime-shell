import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export type UpdateChannel = "stable" | "beta";

export type UpdateStatusState =
  | "idle"
  | "checking"
  | "available"
  | "upToDate"
  | "downloading"
  | "downloaded"
  | "error";

export interface UpdateStatus {
  status: UpdateStatusState;
  currentVersion: string;
  availableVersion: string | null;
  channel: UpdateChannel;
  error: string | null;
  downloadProgress: number | null;
  checkedAt: string | null;
}

interface UpdateStoreState extends UpdateStatus {
  isChecking: boolean;
  checkForUpdates: (channel?: UpdateChannel) => Promise<void>;
  setChannel: (channel: UpdateChannel) => Promise<void>;
  fetchStatus: () => Promise<void>;
}

export const useUpdateStore = create<UpdateStoreState>((set) => ({
  status: "idle",
  currentVersion: "0.1.0",
  availableVersion: null,
  channel: "stable",
  error: null,
  downloadProgress: null,
  checkedAt: null,
  isChecking: false,

  fetchStatus: async () => {
    try {
      const res = await invoke<UpdateStatus>("get_update_status");
      set({
        status: res.status,
        currentVersion: res.currentVersion,
        availableVersion: res.availableVersion,
        channel: res.channel,
        error: res.error,
        downloadProgress: res.downloadProgress,
        checkedAt: res.checkedAt,
      });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    }
  },

  checkForUpdates: async (channel?: UpdateChannel) => {
    set({ isChecking: true, error: null });
    try {
      const res = await invoke<UpdateStatus>("check_for_updates", { channel });
      set({
        status: res.status,
        currentVersion: res.currentVersion,
        availableVersion: res.availableVersion,
        channel: res.channel,
        error: res.error,
        downloadProgress: res.downloadProgress,
        checkedAt: res.checkedAt,
        isChecking: false,
      });
    } catch (e) {
      set({
        status: "error",
        error: e instanceof Error ? e.message : String(e),
        isChecking: false,
      });
    }
  },

  setChannel: async (channel: UpdateChannel) => {
    set({ channel, error: null });
    try {
      const res = await invoke<UpdateStatus>("set_update_channel", { channel });
      set({
        status: res.status,
        currentVersion: res.currentVersion,
        availableVersion: res.availableVersion,
        channel: res.channel,
        error: res.error,
        downloadProgress: res.downloadProgress,
        checkedAt: res.checkedAt,
      });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    }
  },
}));

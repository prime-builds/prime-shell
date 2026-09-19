import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { SettingsStatus } from "./useSettingsStore";

export interface BackendStatus {
  state: "stopped" | "starting" | "ready" | "busy" | "faulted" | "restarting";
  ready: boolean;
  backendVersion?: string;
  circuitOpen: boolean;
}

export interface DiagnosticsSummary {
  totalRecords: number;
  ringBufferCapacity: number;
  recentErrorsCount: number;
  logFileBytes: number;
  maxLogBytes: number;
  backendStatus: BackendStatus;
  settingsStatus?: SettingsStatus;
  retentionPolicy: string;
}

export interface SafeErrorRecord {
  code: string;
  message: string;
  timestamp: string;
  traceId?: string;
  component?: string;
  userRecoveryHint?: string;
}

export interface ExportPreviewEntry {
  name: string;
  role: string;
  estimatedBytes: number;
  recordCount: number;
}

export interface ExportPreview {
  totalEstimatedBytes: number;
  entryCount: number;
  entries: ExportPreviewEntry[];
  redactionVerified: boolean;
  generatedAt: string;
}

export interface ExportManifestEntry {
  name: string;
  role: string;
  sizeBytes: number;
  sha256: string;
  recordCount: number;
}

export interface ExportManifest {
  manifestVersion: number;
  appVersion: string;
  backendVersion?: string;
  targetOs: string;
  targetArch: string;
  createdAt: string;
  entries: ExportManifestEntry[];
  excludedCategories: string[];
  redactionVerified: boolean;
}

interface DiagnosticsStoreState {
  summary: DiagnosticsSummary | null;
  recentErrors: SafeErrorRecord[];
  preview: ExportPreview | null;
  lastExportManifest: ExportManifest | null;
  isLoading: boolean;
  isExporting: boolean;
  isRecovering: boolean;
  isRepairing: boolean;
  error: string | null;
  successMessage: string | null;

  loadDiagnostics: () => Promise<void>;
  loadPreview: () => Promise<void>;
  exportDiagnostics: () => Promise<ExportManifest | null>;
  recoverBackend: () => Promise<void>;
  repairSettingsSection: (section: string) => Promise<void>;
  clearMessages: () => void;
}

export const useDiagnosticsStore = create<DiagnosticsStoreState>((set, get) => ({
  summary: null,
  recentErrors: [],
  preview: null,
  lastExportManifest: null,
  isLoading: false,
  isExporting: false,
  isRecovering: false,
  isRepairing: false,
  error: null,
  successMessage: null,

  loadDiagnostics: async () => {
    set({ isLoading: true, error: null });
    try {
      const [summary, recentErrors] = await Promise.all([
        invoke<DiagnosticsSummary>("get_diagnostics_summary"),
        invoke<SafeErrorRecord[]>("get_recent_safe_errors"),
      ]);
      set({ summary, recentErrors, isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : String(err),
        isLoading: false,
      });
    }
  },

  loadPreview: async () => {
    try {
      const preview = await invoke<ExportPreview>("get_export_preview");
      set({ preview });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  exportDiagnostics: async () => {
    set({ isExporting: true, error: null, successMessage: null });
    try {
      const manifest = await invoke<ExportManifest | null>("export_diagnostics");
      if (manifest) {
        set({
          lastExportManifest: manifest,
          isExporting: false,
          successMessage: `Diagnostics bundle exported successfully (${manifest.entries.length} files, redaction verified).`,
        });
        // Refresh summary to reflect export event
        void get().loadDiagnostics();
        return manifest;
      } else {
        // User cancelled dialog
        set({ isExporting: false });
        return null;
      }
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : String(err),
        isExporting: false,
      });
      return null;
    }
  },

  recoverBackend: async () => {
    set({ isRecovering: true, error: null, successMessage: null });
    try {
      const newStatus = await invoke<BackendStatus>("recover_backend");
      set({
        isRecovering: false,
        successMessage: `Backend recovered successfully. State is ${newStatus.state}. Note: interrupted tasks are not replayed.`,
      });
      void get().loadDiagnostics();
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : String(err),
        isRecovering: false,
      });
    }
  },

  repairSettingsSection: async (section: string) => {
    set({ isRepairing: true, error: null, successMessage: null });
    try {
      await invoke("repair_settings_section", { section });
      set({
        isRepairing: false,
        successMessage: `Settings section '${section}' successfully repaired to defaults.`,
      });
      void get().loadDiagnostics();
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : String(err),
        isRepairing: false,
      });
    }
  },

  clearMessages: () => {
    set({ error: null, successMessage: null });
  },
}));

import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type {
  AccentMode,
  DensityMode,
  ThemeMode,
  WindowMaterialPreference,
} from "@prime-shell/design-tokens";

export interface AppearanceSettings {
  themeMode: ThemeMode;
  accentMode: AccentMode;
  density: DensityMode;
  materialPreference: WindowMaterialPreference;
}

export interface LayoutSettings {
  schemaVersion: number;
  sidebarWidth: number;
  sidebarCollapsed: boolean;
  inspectorWidth: number;
  inspectorOpen: boolean;
  bottomPanelHeightRatio: number;
  bottomPanelOpen: boolean;
  activeNavigationId?: string;
}

export interface DocumentAnalysisSettings {
  maxTopTerms: number;
}

export interface TextUtilitySettings {
  defaultMode: string;
}

export interface SettingsStatus {
  state:
    | "healthy"
    | "recovered_from_previous_copy"
    | "section_recovered"
    | "reset_to_defaults"
    | "unsupported_future_version";
  recoveredSection?: string;
  message?: string;
}

export interface SettingsDocument {
  schemaVersion: number;
  revision: number;
  appearance: AppearanceSettings;
  layout: LayoutSettings;
  documentAnalysis: DocumentAnalysisSettings;
  textUtility: TextUtilitySettings;
  status?: SettingsStatus;
}

export const DEFAULT_SETTINGS: SettingsDocument = {
  schemaVersion: 1,
  revision: 0,
  appearance: {
    themeMode: "system",
    accentMode: { mode: "default" },
    density: "comfortable",
    materialPreference: "system",
  },
  layout: {
    schemaVersion: 1,
    sidebarWidth: 280,
    sidebarCollapsed: false,
    inspectorWidth: 340,
    inspectorOpen: true,
    bottomPanelHeightRatio: 0.3,
    bottomPanelOpen: false,
    activeNavigationId: "workspace",
  },
  documentAnalysis: {
    maxTopTerms: 20,
  },
  textUtility: {
    defaultMode: "uppercase",
  },
  status: {
    state: "healthy",
  },
};

interface SettingsStoreState {
  document: SettingsDocument;
  isLoaded: boolean;
  isSaving: boolean;
  searchQuery: string;

  setSearchQuery: (query: string) => void;
  loadSettings: () => Promise<void>;
  updateAppearance: (partial: Partial<AppearanceSettings>) => Promise<void>;
  updateLayout: (partial: Partial<LayoutSettings>) => Promise<void>;
  updateDocumentAnalysis: (partial: Partial<DocumentAnalysisSettings>) => Promise<void>;
  updateTextUtility: (partial: Partial<TextUtilitySettings>) => Promise<void>;
  resetSetting: (section: string, key: string) => Promise<void>;
  resetSection: (section: string) => Promise<void>;
  resetAll: () => Promise<void>;
}

let saveTimeout: ReturnType<typeof setTimeout> | null = null;

async function invokeTauri<T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) {
    return null;
  }
  try {
    return args !== undefined ? await invoke<T>(cmd, args) : await invoke<T>(cmd);
  } catch (e) {
    console.warn(`[SettingsStore] Tauri command ${cmd} failed:`, e);
    return null;
  }
}

export const useSettingsStore = create<SettingsStoreState>((set, get) => {
  const triggerDebouncedSave = () => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
      const { document } = get();
      set({ isSaving: true });
      const saved = await invokeTauri<SettingsDocument>("save_settings", {
        expectedRevision: document.revision,
        document,
      });
      if (saved) {
        set({ document: saved, isSaving: false });
      } else {
        set({ isSaving: false });
      }
    }, 300);
  };

  return {
    document: DEFAULT_SETTINGS,
    isLoaded: false,
    isSaving: false,
    searchQuery: "",

    setSearchQuery: (query: string) => {
      set({ searchQuery: query });
    },

    loadSettings: async () => {
      const doc = await invokeTauri<SettingsDocument>("get_settings");
      if (doc) {
        set({ document: doc, isLoaded: true });
      } else {
        set({ isLoaded: true });
      }
    },

    updateAppearance: async (partial: Partial<AppearanceSettings>) => {
      const current = get().document;
      const updated: SettingsDocument = {
        ...current,
        appearance: {
          ...current.appearance,
          ...partial,
        },
      };
      set({ document: updated });
      triggerDebouncedSave();
    },

    updateLayout: async (partial: Partial<LayoutSettings>) => {
      const current = get().document;
      const updated: SettingsDocument = {
        ...current,
        layout: {
          ...current.layout,
          ...partial,
        },
      };
      set({ document: updated });
      triggerDebouncedSave();
    },

    updateDocumentAnalysis: async (partial: Partial<DocumentAnalysisSettings>) => {
      const current = get().document;
      const updated: SettingsDocument = {
        ...current,
        documentAnalysis: {
          ...current.documentAnalysis,
          ...partial,
        },
      };
      set({ document: updated });
      triggerDebouncedSave();
    },

    updateTextUtility: async (partial: Partial<TextUtilitySettings>) => {
      const current = get().document;
      const updated: SettingsDocument = {
        ...current,
        textUtility: {
          ...current.textUtility,
          ...partial,
        },
      };
      set({ document: updated });
      triggerDebouncedSave();
    },

    resetSetting: async (section: string, key: string) => {
      set({ isSaving: true });
      const doc = await invokeTauri<SettingsDocument>("reset_setting", { section, key });
      if (doc) {
        set({ document: doc, isSaving: false });
      } else {
        set({ isSaving: false });
      }
    },

    resetSection: async (section: string) => {
      set({ isSaving: true });
      const doc = await invokeTauri<SettingsDocument>("reset_settings_section", { section });
      if (doc) {
        set({ document: doc, isSaving: false });
      } else {
        set({ isSaving: false });
      }
    },

    resetAll: async () => {
      set({ isSaving: true });
      const doc = await invokeTauri<SettingsDocument>("reset_all_settings");
      if (doc) {
        set({ document: doc, isSaving: false });
      } else {
        set({ isSaving: false });
      }
    },
  };
});

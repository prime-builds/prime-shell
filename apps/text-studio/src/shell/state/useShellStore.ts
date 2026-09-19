import { create } from "zustand";
import {
  BOTTOM_PANEL_DEFAULT_RATIO,
  BOTTOM_PANEL_MAX_RATIO,
  BOTTOM_PANEL_MIN_RATIO,
  getResponsiveBand,
  INSPECTOR_DEFAULT_WIDTH,
  INSPECTOR_MAX_WIDTH,
  INSPECTOR_MIN_WIDTH,
  type ResponsiveBand,
  type ShellLayoutPreferencesV1,
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
} from "../types";

interface ShellState {
  // Dimensions and responsive state
  windowWidth: number;
  windowHeight: number;
  band: ResponsiveBand;

  // Sidebar
  sidebarWidth: number;
  isSidebarCollapsed: boolean;
  isSidebarOverlayOpen: boolean;

  // Inspector
  inspectorWidth: number;
  isInspectorOpen: boolean;
  isInspectorDrawerOpen: boolean;

  // Bottom Panel
  bottomPanelHeightRatio: number;
  isBottomPanelOpen: boolean;

  // Navigation
  activeNavId: string;

  // Persistence status
  isLoaded: boolean;
  isSaving: boolean;

  // Actions
  setWindowDimensions: (width: number, height: number) => void;
  setSidebarWidth: (width: number) => void;
  toggleSidebar: () => void;
  setSidebarOverlayOpen: (open: boolean) => void;
  setInspectorWidth: (width: number) => void;
  toggleInspector: () => void;
  setInspectorDrawerOpen: (open: boolean) => void;
  setBottomPanelHeightRatio: (ratio: number) => void;
  toggleBottomPanel: () => void;
  setActiveNavId: (id: string) => void;
  loadPreferences: () => Promise<void>;
  savePreferences: () => Promise<void>;
  resetPreferences: () => Promise<void>;
}

import { invoke } from "@tauri-apps/api/core";

let saveTimeout: ReturnType<typeof setTimeout> | null = null;

async function invokeTauri<T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
  try {
    return args !== undefined ? await invoke<T>(cmd, args) : await invoke<T>(cmd);
  } catch (e) {
    console.warn(`[ShellStore] Tauri command ${cmd} failed:`, e);
    return null;
  }
}

export const useShellStore = create<ShellState>((set, get) => {
  const initialWidth = typeof window !== "undefined" ? window.innerWidth : 1280;
  const initialHeight = typeof window !== "undefined" ? window.innerHeight : 720;

  const triggerDebouncedSave = () => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      get().savePreferences();
    }, 400);
  };

  return {
    windowWidth: initialWidth,
    windowHeight: initialHeight,
    band: getResponsiveBand(initialWidth),

    sidebarWidth: SIDEBAR_DEFAULT_WIDTH,
    isSidebarCollapsed: false,
    isSidebarOverlayOpen: false,

    inspectorWidth: INSPECTOR_DEFAULT_WIDTH,
    isInspectorOpen: true,
    isInspectorDrawerOpen: false,

    bottomPanelHeightRatio: BOTTOM_PANEL_DEFAULT_RATIO,
    isBottomPanelOpen: false,

    activeNavId: "workspace",
    isLoaded: false,
    isSaving: false,

    setWindowDimensions: (width, height) => {
      const band = getResponsiveBand(width);
      set((state) => {
        // Automatically close overlay/drawer if resized into a wider band
        const isSidebarOverlayOpen = band === "compact" ? state.isSidebarOverlayOpen : false;
        const isInspectorDrawerOpen = band === "compact" || band === "tablet" ? state.isInspectorDrawerOpen : false;
        return {
          windowWidth: width,
          windowHeight: height,
          band,
          isSidebarOverlayOpen,
          isInspectorDrawerOpen,
        };
      });
    },

    setSidebarWidth: (width) => {
      const clamped = Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, width));
      set({ sidebarWidth: clamped, isSidebarCollapsed: false });
      triggerDebouncedSave();
    },

    toggleSidebar: () => {
      const { band, isSidebarCollapsed, isSidebarOverlayOpen } = get();
      if (band === "compact") {
        set({ isSidebarOverlayOpen: !isSidebarOverlayOpen });
      } else {
        set({ isSidebarCollapsed: !isSidebarCollapsed });
        triggerDebouncedSave();
      }
    },

    setSidebarOverlayOpen: (open) => {
      set({ isSidebarOverlayOpen: open });
    },

    setInspectorWidth: (width) => {
      const clamped = Math.max(INSPECTOR_MIN_WIDTH, Math.min(INSPECTOR_MAX_WIDTH, width));
      set({ inspectorWidth: clamped, isInspectorOpen: true });
      triggerDebouncedSave();
    },

    toggleInspector: () => {
      const { band, isInspectorOpen, isInspectorDrawerOpen } = get();
      if (band === "compact" || band === "tablet") {
        set({ isInspectorDrawerOpen: !isInspectorDrawerOpen });
      } else {
        set({ isInspectorOpen: !isInspectorOpen });
        triggerDebouncedSave();
      }
    },

    setInspectorDrawerOpen: (open) => {
      set({ isInspectorDrawerOpen: open });
    },

    setBottomPanelHeightRatio: (ratio) => {
      const clamped = Math.max(BOTTOM_PANEL_MIN_RATIO, Math.min(BOTTOM_PANEL_MAX_RATIO, ratio));
      set({ bottomPanelHeightRatio: clamped, isBottomPanelOpen: true });
      triggerDebouncedSave();
    },

    toggleBottomPanel: () => {
      set((state) => ({ isBottomPanelOpen: !state.isBottomPanelOpen }));
      triggerDebouncedSave();
    },

    setActiveNavId: (id) => {
      set({ activeNavId: id });
      triggerDebouncedSave();
    },

    loadPreferences: async () => {
      const prefs = await invokeTauri<ShellLayoutPreferencesV1>("get_shell_layout_preferences");
      if (prefs) {
        set({
          sidebarWidth: Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, prefs.sidebarWidth)),
          isSidebarCollapsed: Boolean(prefs.sidebarCollapsed),
          inspectorWidth: Math.max(INSPECTOR_MIN_WIDTH, Math.min(INSPECTOR_MAX_WIDTH, prefs.inspectorWidth)),
          isInspectorOpen: Boolean(prefs.inspectorOpen),
          bottomPanelHeightRatio: Math.max(
            BOTTOM_PANEL_MIN_RATIO,
            Math.min(BOTTOM_PANEL_MAX_RATIO, prefs.bottomPanelHeightRatio),
          ),
          isBottomPanelOpen: Boolean(prefs.bottomPanelOpen),
          activeNavId: prefs.activeNavigationId || "workspace",
          isLoaded: true,
        });
      } else {
        set({ isLoaded: true });
      }
    },

    savePreferences: async () => {
      const state = get();
      const prefs: ShellLayoutPreferencesV1 = {
        schemaVersion: 1,
        sidebarWidth: state.sidebarWidth,
        sidebarCollapsed: state.isSidebarCollapsed,
        inspectorWidth: state.inspectorWidth,
        inspectorOpen: state.isInspectorOpen,
        bottomPanelHeightRatio: state.bottomPanelHeightRatio,
        bottomPanelOpen: state.isBottomPanelOpen,
        activeNavigationId: state.activeNavId,
      };

      set({ isSaving: true });
      await invokeTauri("save_shell_layout_preferences", { preferences: prefs });
      set({ isSaving: false });
    },

    resetPreferences: async () => {
      const defaultPrefs = await invokeTauri<ShellLayoutPreferencesV1>("reset_shell_layout_preferences");
      if (defaultPrefs) {
        set({
          sidebarWidth: defaultPrefs.sidebarWidth,
          isSidebarCollapsed: defaultPrefs.sidebarCollapsed,
          inspectorWidth: defaultPrefs.inspectorWidth,
          isInspectorOpen: defaultPrefs.inspectorOpen,
          bottomPanelHeightRatio: defaultPrefs.bottomPanelHeightRatio,
          isBottomPanelOpen: defaultPrefs.bottomPanelOpen,
          activeNavId: defaultPrefs.activeNavigationId || "workspace",
        });
      } else {
        set({
          sidebarWidth: SIDEBAR_DEFAULT_WIDTH,
          isSidebarCollapsed: false,
          inspectorWidth: INSPECTOR_DEFAULT_WIDTH,
          isInspectorOpen: true,
          bottomPanelHeightRatio: BOTTOM_PANEL_DEFAULT_RATIO,
          isBottomPanelOpen: false,
          activeNavId: "workspace",
        });
      }
    },
  };
});

import type React from "react";

export interface ShellLayoutPreferencesV1 {
  schemaVersion: 1;
  sidebarWidth: number;
  sidebarCollapsed: boolean;
  inspectorWidth: number;
  inspectorOpen: boolean;
  bottomPanelHeightRatio: number;
  bottomPanelOpen: boolean;
  activeNavigationId?: string;
}

export type ResponsiveBand = "wide" | "desktop" | "tablet" | "compact";

export const WIDE_MIN_WIDTH = 1440;
export const DESKTOP_MIN_WIDTH = 1200;
export const DESKTOP_MAX_WIDTH = 1439;
export const TABLET_MIN_WIDTH = 840;
export const TABLET_MAX_WIDTH = 1199;
export const COMPACT_MIN_WIDTH = 500;
export const COMPACT_MAX_WIDTH = 839;
export const COMPACT_MIN_HEIGHT = 480;
export const MIN_WINDOW_WIDTH = COMPACT_MIN_WIDTH;
export const MIN_WINDOW_HEIGHT = COMPACT_MIN_HEIGHT;

export const SIDEBAR_MIN_WIDTH = 220;
export const SIDEBAR_MAX_WIDTH = 400;
export const SIDEBAR_DEFAULT_WIDTH = 280;

export const INSPECTOR_MIN_WIDTH = 280;
export const INSPECTOR_MAX_WIDTH = 480;
export const INSPECTOR_DEFAULT_WIDTH = 340;

export const BOTTOM_PANEL_MIN_HEIGHT = 160;
export const BOTTOM_PANEL_MIN_RATIO = 0.20;
export const BOTTOM_PANEL_MAX_RATIO = 0.50;
export const BOTTOM_PANEL_DEFAULT_RATIO = 0.30;

export const TITLE_BAR_HEIGHT = 32;
export const RAIL_WIDTH = 48;
export const STATUS_BAR_HEIGHT = 28;

export function getResponsiveBand(width: number): ResponsiveBand {
  if (width >= WIDE_MIN_WIDTH) return "wide";
  if (width >= DESKTOP_MIN_WIDTH) return "desktop";
  if (width >= TABLET_MIN_WIDTH) return "tablet";
  return "compact";
}

export interface NavigationItem {
  id: string;
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  ariaLabel?: string;
}

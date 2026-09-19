import type { DensityMode, DensityTokens } from "./contract";

export const densityTokens: Record<DensityMode, DensityTokens> = {
  comfortable: {
    controlHeight: "32px",
    paddingHorizontal: "12px",
    paddingVertical: "6px",
    fontSizeBase: "14px",
    lineHeightBase: "20px",
    gap: "12px",
  },
  compact: {
    controlHeight: "24px",
    paddingHorizontal: "8px",
    paddingVertical: "2px",
    fontSizeBase: "12px",
    lineHeightBase: "16px",
    gap: "8px",
  },
};

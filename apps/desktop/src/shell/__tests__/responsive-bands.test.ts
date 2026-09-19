import { describe, expect, it } from "vitest";
import {
  COMPACT_MAX_WIDTH,
  DESKTOP_MAX_WIDTH,
  DESKTOP_MIN_WIDTH,
  getResponsiveBand,
  MIN_WINDOW_HEIGHT,
  MIN_WINDOW_WIDTH,
  TABLET_MAX_WIDTH,
  TABLET_MIN_WIDTH,
  WIDE_MIN_WIDTH,
} from "../types";

describe("Responsive Bands and Viewport Clamping", () => {
  it("correctly identifies compact band (500px to 839px)", () => {
    expect(getResponsiveBand(500)).toBe("compact");
    expect(getResponsiveBand(600)).toBe("compact");
    expect(getResponsiveBand(COMPACT_MAX_WIDTH)).toBe("compact");
  });

  it("correctly identifies tablet band (840px to 1199px)", () => {
    expect(getResponsiveBand(TABLET_MIN_WIDTH)).toBe("tablet");
    expect(getResponsiveBand(1000)).toBe("tablet");
    expect(getResponsiveBand(TABLET_MAX_WIDTH)).toBe("tablet");
  });

  it("correctly identifies desktop band (1200px to 1439px)", () => {
    expect(getResponsiveBand(DESKTOP_MIN_WIDTH)).toBe("desktop");
    expect(getResponsiveBand(1300)).toBe("desktop");
    expect(getResponsiveBand(DESKTOP_MAX_WIDTH)).toBe("desktop");
  });

  it("correctly identifies wide band (>= 1440px)", () => {
    expect(getResponsiveBand(WIDE_MIN_WIDTH)).toBe("wide");
    expect(getResponsiveBand(1920)).toBe("wide");
    expect(getResponsiveBand(2560)).toBe("wide");
  });

  it("handles boundary values and edge cases", () => {
    // Under minimum width still falls into compact
    expect(getResponsiveBand(MIN_WINDOW_WIDTH)).toBe("compact");
    expect(getResponsiveBand(400)).toBe("compact");
    expect(MIN_WINDOW_WIDTH).toBe(500);
    expect(MIN_WINDOW_HEIGHT).toBe(480);
  });
});

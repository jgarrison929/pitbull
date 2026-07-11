import { describe, expect, it } from "vitest";
import {
  classifyViewportWidth,
  isNarrowViewport,
  MOBILE_VIEWPORT_MAX_PX,
} from "./viewport-class";

describe("PostHog viewport classification", () => {
  it("classifies phone / tablet / desktop for mobile-first analysis", () => {
    expect(classifyViewportWidth(375)).toBe("phone");
    expect(classifyViewportWidth(640)).toBe("phone");
    expect(classifyViewportWidth(768)).toBe("tablet");
    expect(classifyViewportWidth(1023)).toBe("tablet");
    expect(classifyViewportWidth(1024)).toBe("desktop");
    expect(classifyViewportWidth(1440)).toBe("desktop");
  });

  it("narrow viewport matches bottom-nav visibility (below lg)", () => {
    expect(isNarrowViewport(MOBILE_VIEWPORT_MAX_PX)).toBe(true);
    expect(isNarrowViewport(MOBILE_VIEWPORT_MAX_PX + 1)).toBe(false);
    expect(isNarrowViewport(390)).toBe(true);
  });
});

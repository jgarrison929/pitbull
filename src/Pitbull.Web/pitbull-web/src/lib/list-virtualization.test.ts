import { describe, it, expect } from "vitest";
import { getVirtualWindow, sliceVirtualItems } from "./list-virtualization";

describe("list-virtualization (2.13.0)", () => {
  it("windows a large list so only a subset of rows would mount", () => {
    const itemCount = 250;
    const rowH = 80;
    const viewport = 400;
    // Mid-scroll
    const win = getVirtualWindow(itemCount, rowH, 40 * rowH, viewport, 2);
    expect(win.totalHeight).toBe(itemCount * rowH);
    expect(win.endIndex - win.startIndex).toBeLessThan(itemCount);
    expect(win.endIndex - win.startIndex).toBeLessThanOrEqual(
      Math.ceil(viewport / rowH) + 4
    );
    expect(win.startIndex).toBeGreaterThan(0);
    expect(win.paddingTop).toBe(win.startIndex * rowH);
    expect(win.paddingBottom).toBe((itemCount - win.endIndex) * rowH);
  });

  it("slices only the windowed items", () => {
    const items = Array.from({ length: 200 }, (_, i) => `rfi-${i}`);
    const win = getVirtualWindow(items.length, 72, 0, 360, 3);
    const slice = sliceVirtualItems(items, win);
    expect(slice[0]).toBe("rfi-0");
    expect(slice.length).toBe(win.endIndex - win.startIndex);
    expect(slice.length).toBeLessThan(200);
  });

  it("handles empty lists", () => {
    const win = getVirtualWindow(0, 72, 0, 400);
    expect(win.endIndex).toBe(0);
    expect(sliceVirtualItems([], win)).toEqual([]);
  });
});

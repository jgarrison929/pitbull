/**
 * Pure list windowing helpers (2.13.0).
 * Server pagination is unchanged — this only reduces DOM for a client-held page of rows.
 */

export type VirtualWindow = {
  /** Inclusive start index into the items array. */
  startIndex: number;
  /** Exclusive end index. */
  endIndex: number;
  /** Spacer height above the window (px). */
  paddingTop: number;
  /** Spacer height below the window (px). */
  paddingBottom: number;
  /** Total scroll height for the full list (px). */
  totalHeight: number;
};

/**
 * Compute which slice of a fixed-height row list should mount for a scroll position.
 */
export function getVirtualWindow(
  itemCount: number,
  rowHeightPx: number,
  scrollTopPx: number,
  viewportHeightPx: number,
  overscan = 4
): VirtualWindow {
  const safeCount = Math.max(0, Math.floor(itemCount));
  const rowH = Math.max(1, rowHeightPx);
  const totalHeight = safeCount * rowH;
  if (safeCount === 0) {
    return {
      startIndex: 0,
      endIndex: 0,
      paddingTop: 0,
      paddingBottom: 0,
      totalHeight: 0,
    };
  }

  const firstVisible = Math.floor(Math.max(0, scrollTopPx) / rowH);
  const visibleCount = Math.ceil(Math.max(1, viewportHeightPx) / rowH);
  const startIndex = Math.max(0, firstVisible - overscan);
  const endIndex = Math.min(safeCount, firstVisible + visibleCount + overscan);
  const paddingTop = startIndex * rowH;
  const paddingBottom = Math.max(0, (safeCount - endIndex) * rowH);

  return { startIndex, endIndex, paddingTop, paddingBottom, totalHeight };
}

/** Slice items using a virtual window (does not copy outside range). */
export function sliceVirtualItems<T>(items: readonly T[], window: VirtualWindow): T[] {
  return items.slice(window.startIndex, window.endIndex);
}

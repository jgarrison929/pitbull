/**
 * Plan pin offline queue flush when back online (3.2.4).
 * Honest success/fail results — does not invent RFI ids on failure.
 */

export type PinFlushItemStatus = "pending" | "success" | "failed";

export interface PinFlushItem {
  id: string;
  projectId: string;
  status: PinFlushItemStatus;
  error?: string;
}

export interface PinFlushResult {
  attempted: number;
  succeeded: number;
  failed: number;
  items: PinFlushItem[];
}

export function summarizePinFlush(items: PinFlushItem[]): PinFlushResult {
  const succeeded = items.filter((i) => i.status === "success").length;
  const failed = items.filter((i) => i.status === "failed").length;
  return {
    attempted: items.length,
    succeeded,
    failed,
    items,
  };
}

export function pinFlushToastCopy(result: PinFlushResult): string {
  if (result.attempted === 0) return "No queued plan pins to sync.";
  if (result.failed === 0) {
    return `Synced ${result.succeeded} plan pin draft${result.succeeded === 1 ? "" : "s"}.`;
  }
  if (result.succeeded === 0) {
    return `Could not sync ${result.failed} plan pin draft${result.failed === 1 ? "" : "s"}. Try again when online.`;
  }
  return `Synced ${result.succeeded}, failed ${result.failed} plan pin draft(s).`;
}

/** Filter offline queue rows that are plan-pin RFIs. */
export function selectPlanPinQueueItems<T extends { type?: string }>(queue: T[]): T[] {
  return queue.filter((q) => q.type === "plan-pin-rfi");
}

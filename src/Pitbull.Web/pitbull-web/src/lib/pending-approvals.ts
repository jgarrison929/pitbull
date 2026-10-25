/**
 * Pending approvals aggregate (2.21.4 API / 2.21.6 PM card).
 * Real DB counts — zero is honest empty, not a hidden queue.
 */

export type PendingApprovalsDto = {
  total: number;
  timeEntries: number;
  changeOrders: number;
  expandedLifecycle: string;
  truthNote: string;
};

export function normalizePendingApprovals(raw: unknown): PendingApprovalsDto {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    total: Number(o.total ?? o.Total ?? 0) || 0,
    timeEntries: Number(o.timeEntries ?? o.TimeEntries ?? 0) || 0,
    changeOrders: Number(o.changeOrders ?? o.ChangeOrders ?? 0) || 0,
    expandedLifecycle: String(
      o.expandedLifecycle ?? o.ExpandedLifecycle ?? "timeEntries"
    ),
    truthNote: String(
      o.truthNote ??
        o.TruthNote ??
        "Counts are live database queries. Zero means no pending rows."
    ),
  };
}

/** Display label for PM card when total is 0. */
export function pendingApprovalsEmptyCopy(): string {
  return "No pending approvals — queue is empty (not hidden).";
}

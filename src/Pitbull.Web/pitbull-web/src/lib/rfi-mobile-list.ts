/**
 * Phone-first RFI list helpers (band 3.5 / 3.4.4).
 * Pairs with GET /api/projects/{id}/rfis?view=mobile (RfiMobileListItemDto).
 * Empty list ≠ health; overdue is calendar truth only.
 */

export type RfiMobileListItem = {
  id: string;
  number: number;
  subject: string;
  /** Server enum string (JsonStringEnumConverter) or legacy numeric */
  status: string | number;
  projectId: string;
  dueDate?: string | null;
  updatedAt?: string | null;
};

export const RFI_LIST_EMPTY_TITLE = "No RFIs";
export const RFI_LIST_EMPTY_DESCRIPTION =
  "No RFIs for this job yet. Create one when you have a real question — this is not a health score.";

export const RFI_LIST_ERROR_TITLE = "Couldn't load RFIs";
export const RFI_LIST_ERROR_DESCRIPTION =
  "Check your connection and try again. We don't invent status while offline.";

/** Normalize API status (string enum or number) for labels/filters. */
export function normalizeRfiStatus(status: string | number | null | undefined): string {
  if (status === null || status === undefined) return "Unknown";
  if (typeof status === "number") {
    switch (status) {
      case 0:
        return "Open";
      case 1:
        return "Answered";
      case 2:
        return "Closed";
      default:
        return "Unknown";
    }
  }
  const s = String(status).trim();
  if (!s) return "Unknown";
  // Accept "Open" / "open" / numeric strings
  if (s === "0") return "Open";
  if (s === "1") return "Answered";
  if (s === "2") return "Closed";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function isRfiStatusClosed(status: string | number | null | undefined): boolean {
  const n = normalizeRfiStatus(status).toLowerCase();
  return n === "closed";
}

/** Overdue when dueDate is before local start-of-today and status is not Closed. */
export function isRfiOverdue(
  dueDate: string | null | undefined,
  status: string | number | null | undefined,
  now: Date = new Date()
): boolean {
  if (!dueDate) return false;
  if (isRfiStatusClosed(status)) return false;
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return false;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return due < startOfToday;
}

export function formatRfiDueLabel(
  dueDate: string | null | undefined,
  status: string | number | null | undefined,
  now: Date = new Date()
): { text: string; overdue: boolean } {
  if (!dueDate) return { text: "No due date", overdue: false };
  const overdue = isRfiOverdue(dueDate, status, now);
  const dateText = new Date(dueDate).toLocaleDateString();
  return {
    text: overdue ? `Overdue · ${dateText}` : `Due ${dateText}`,
    overdue,
  };
}

export function rfiMobileListUrl(projectId: string, pageSize = 50): string {
  return `/api/projects/${projectId}/rfis?view=mobile&pageSize=${pageSize}`;
}

export function rfiStatusBadgeClass(status: string | number | null | undefined): string {
  switch (normalizeRfiStatus(status).toLowerCase()) {
    case "open":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 hover:bg-blue-100";
    case "answered":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 hover:bg-green-100";
    case "closed":
      return "bg-neutral-100 text-neutral-600 hover:bg-neutral-100";
    default:
      return "bg-neutral-100 text-neutral-600 hover:bg-neutral-100";
  }
}

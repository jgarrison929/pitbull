/**
 * Phone-first submittal list helpers (band 3.5 / 3.4.6).
 * Pairs with GET /api/projects/{id}/submittals?view=mobile.
 * No register-complete % or health scores.
 */

export type SubmittalMobileListItem = {
  id: string;
  number: number;
  title: string;
  status: string;
  projectId: string;
  dueDate?: string | null;
  updatedAt?: string | null;
  type?: string | null;
};

export const SUBMITTAL_LIST_EMPTY_TITLE = "No submittals";
export const SUBMITTAL_LIST_EMPTY_DESCRIPTION =
  "No submittals on this job yet. Create one when you have a real package — this is not a register health score.";

export const SUBMITTAL_LIST_ERROR_TITLE = "Couldn't load submittals";
export const SUBMITTAL_LIST_ERROR_DESCRIPTION =
  "Check your connection and try again. We don't invent status while offline.";

export function submittalMobileListUrl(projectId: string, pageSize = 100): string {
  return `/api/projects/${projectId}/submittals?view=mobile&pageSize=${pageSize}`;
}

export function isSubmittalTerminal(status: string | null | undefined): boolean {
  const s = (status ?? "").toLowerCase();
  return s === "closed" || s === "approved" || s === "approvedasnoted" || s === "rejected";
}

export function isSubmittalOverdue(
  dueDate: string | null | undefined,
  status: string | null | undefined,
  now: Date = new Date()
): boolean {
  if (!dueDate) return false;
  if (isSubmittalTerminal(status)) return false;
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return false;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return due < start;
}

export function formatSubmittalDueLabel(
  dueDate: string | null | undefined,
  status: string | null | undefined,
  now: Date = new Date()
): { text: string; overdue: boolean } {
  if (!dueDate) return { text: "No due date", overdue: false };
  const overdue = isSubmittalOverdue(dueDate, status, now);
  const dateText = new Date(dueDate).toLocaleDateString();
  return {
    text: overdue ? `Overdue · ${dateText}` : `Due ${dateText}`,
    overdue,
  };
}

export function submittalTypeLabel(type: string | null | undefined): string {
  if (!type) return "—";
  const map: Record<string, string> = {
    ProductData: "Product Data",
    ShopDrawing: "Shop Drawing",
    Sample: "Sample",
    Mockup: "Mockup",
    Closeout: "Closeout",
    Other: "Other",
  };
  return map[type] ?? type;
}

export function submittalStatusLabel(status: string | null | undefined): string {
  if (!status) return "Unknown";
  const map: Record<string, string> = {
    Draft: "Draft",
    Submitted: "Submitted",
    InReview: "In Review",
    Approved: "Approved",
    ApprovedAsNoted: "Approved as Noted",
    ReviseAndResubmit: "Revise & Resubmit",
    Rejected: "Rejected",
    Closed: "Closed",
  };
  return map[status] ?? status;
}

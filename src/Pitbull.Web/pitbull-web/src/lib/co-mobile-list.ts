/**
 * Change order mobile list contract helpers (band 3.6 / 3.5.1+).
 * Fields: id, number, title/subject, status, projectId, amount?, dueDate?
 * No portfolio CO health scores.
 */

export type CoMobileListItem = {
  id: string;
  number: string;
  title: string;
  status: string;
  projectId: string;
  amount?: number | null;
  dueDate?: string | null;
};

export const CO_LIST_EMPTY_TITLE = "No change orders";
export const CO_LIST_EMPTY_DESCRIPTION =
  "No change orders for this job yet. Empty is honest — not a commercial health score.";

export function coMobileListUrl(projectId?: string, pageSize = 50): string {
  if (projectId) {
    return `/api/projects/${projectId}/change-orders?view=mobile&pageSize=${pageSize}`;
  }
  return `/api/owner-change-orders?view=mobile&pageSize=${pageSize}`;
}

export function formatCoAmount(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function isCoClosed(status: string | null | undefined): boolean {
  const s = (status ?? "").toLowerCase();
  return s === "approved" || s === "void" || s === "rejected" || s === "withdrawn";
}

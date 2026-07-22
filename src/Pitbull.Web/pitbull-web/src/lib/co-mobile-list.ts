/**
 * Change order mobile list contract helpers (band 3.6 / 3.5.1+).
 * Fields: id, number, title/subject, status, projectId, amount?, dueDate?
 * No portfolio CO health scores.
 *
 * APIs:
 * - Subcontract COs: GET /api/changeorders?view=mobile
 * - Owner COs: GET /api/owner-change-orders?view=mobile
 */

export type CoMobileListItem = {
  id: string;
  number: string;
  title: string;
  status: string;
  projectId: string;
  amount?: number | null;
  dueDate?: string | null;
  subcontractId?: string | null;
};

export const CO_LIST_EMPTY_TITLE = "No change orders";
export const CO_LIST_EMPTY_DESCRIPTION =
  "No change orders for this job yet. Empty is honest — not a commercial health score.";

/** Subcontract change orders (primary /change-orders page). */
export function coMobileListUrl(projectId?: string, pageSize = 50): string {
  const params = new URLSearchParams();
  params.set("view", "mobile");
  params.set("pageSize", String(pageSize));
  if (projectId) params.set("projectId", projectId);
  return `/api/changeorders?${params.toString()}`;
}

/** Owner change orders (owner commercial paper). */
export function ownerCoMobileListUrl(projectId?: string, pageSize = 50): string {
  const params = new URLSearchParams();
  params.set("view", "mobile");
  params.set("pageSize", String(pageSize));
  if (projectId) params.set("projectId", projectId);
  return `/api/owner-change-orders?${params.toString()}`;
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

/** Normalize API mobile row (number or changeOrderNumber casing). */
export function normalizeCoMobileItem(raw: Record<string, unknown>): CoMobileListItem {
  const statusVal = raw.status ?? raw.Status;
  const status =
    typeof statusVal === "number"
      ? String(statusVal)
      : statusVal != null
        ? String(statusVal)
        : "";
  return {
    id: String(raw.id ?? raw.Id ?? ""),
    number: String(raw.number ?? raw.Number ?? raw.changeOrderNumber ?? raw.ChangeOrderNumber ?? ""),
    title: String(raw.title ?? raw.Title ?? ""),
    status,
    projectId: String(raw.projectId ?? raw.ProjectId ?? ""),
    amount:
      raw.amount === null || raw.amount === undefined
        ? raw.Amount === null || raw.Amount === undefined
          ? null
          : Number(raw.Amount)
        : Number(raw.amount),
    dueDate: (raw.dueDate ?? raw.DueDate ?? null) as string | null,
    subcontractId: (raw.subcontractId ?? raw.SubcontractId ?? null) as string | null,
  };
}

/**
 * Subcontract mobile list helpers (band 3.6 / 3.5.6–3.5.7).
 * SOV edit stays desktop; phone is status + amount glance only.
 */

export type SubcontractMobileListItem = {
  id: string;
  number: string;
  title: string;
  status: string;
  projectId: string;
  amount?: number | null;
  billedToDate?: number | null;
  retainageHeld?: number | null;
  tradeCode?: string | null;
};

export const SUBCONTRACT_LIST_EMPTY_TITLE = "No subcontracts";
export const SUBCONTRACT_LIST_EMPTY_DESCRIPTION =
  "No subcontracts for this filter yet. Empty is honest — not a commercial health score.";

export const SOV_PHONE_GLANCE_NOTE =
  "SOV glance is read-only on phone. Edit schedule of values on desktop.";

export function subcontractMobileListUrl(projectId?: string, pageSize = 50): string {
  const params = new URLSearchParams();
  params.set("view", "mobile");
  params.set("pageSize", String(pageSize));
  if (projectId) params.set("projectId", projectId);
  return `/api/subcontracts?${params.toString()}`;
}

export function subcontractSovHref(subcontractId: string): string {
  return `/contracts/${subcontractId}/sov`;
}

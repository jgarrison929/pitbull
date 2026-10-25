/**
 * Subcontract mobile list helpers (band 3.6 / 3.5.6–3.5.7).
 * SOV edit stays desktop; phone is status + amount glance only.
 * Money fields come from the server DTO only — never invent paid/remaining.
 */

export type SubcontractMobileListItem = {
  id: string;
  number: string;
  title: string;
  status: string;
  projectId: string;
  /** Current contract value from server (null/undefined = insufficient). */
  amount: number | null;
  billedToDate: number | null;
  paidToDate: number | null;
  retainageHeld: number | null;
  tradeCode: string | null;
};

export type SubcontractMoneySummary = {
  totalCommitted: number | null;
  totalPaidToDate: number | null;
  totalRetentionHeld: number | null;
  /** Only set when both committed and paid are real numbers. */
  totalRemaining: number | null;
  /** True when any money field is missing from the server rows. */
  moneyInsufficient: boolean;
};

export const SUBCONTRACT_LIST_EMPTY_TITLE = "No subcontracts";
export const SUBCONTRACT_LIST_EMPTY_DESCRIPTION =
  "No subcontracts for this filter yet. Empty is honest — not a commercial health score.";

export const SOV_PHONE_GLANCE_NOTE =
  "SOV glance is read-only on phone. Edit schedule of values on desktop.";

export const MONEY_INSUFFICIENT_LABEL = "Insufficient data";

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

/** Parse a money field: null/undefined/NaN → null (never invent 0). */
export function parseMoneyField(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Map a raw API mobile row (camelCase or PascalCase) to a typed item.
 * Does not invent paidToDate, billedToDate, or amount as 0 when absent.
 */
export function mapSubcontractMobileRow(raw: Record<string, unknown>): SubcontractMobileListItem {
  const statusVal = raw.status ?? raw.Status;
  const status =
    statusVal === null || statusVal === undefined
      ? ""
      : typeof statusVal === "number"
        ? String(statusVal)
        : String(statusVal);

  return {
    id: String(raw.id ?? raw.Id ?? ""),
    number: String(raw.number ?? raw.Number ?? raw.subcontractNumber ?? raw.SubcontractNumber ?? ""),
    title: String(raw.title ?? raw.Title ?? raw.subcontractorName ?? raw.SubcontractorName ?? ""),
    status,
    projectId: String(raw.projectId ?? raw.ProjectId ?? ""),
    amount: parseMoneyField(raw.amount ?? raw.Amount ?? raw.currentValue ?? raw.CurrentValue),
    billedToDate: parseMoneyField(raw.billedToDate ?? raw.BilledToDate),
    paidToDate: parseMoneyField(raw.paidToDate ?? raw.PaidToDate),
    retainageHeld: parseMoneyField(raw.retainageHeld ?? raw.RetainageHeld),
    tradeCode:
      raw.tradeCode === null || raw.tradeCode === undefined
        ? raw.TradeCode === null || raw.TradeCode === undefined
          ? null
          : String(raw.TradeCode)
        : String(raw.tradeCode),
  };
}

/**
 * Sum commercial tiles from mobile rows without inventing missing paid/amount.
 * Remaining is only computed when every row has both amount and paidToDate.
 */
export function summarizeSubcontractListMoney(
  rows: SubcontractMobileListItem[]
): SubcontractMoneySummary {
  if (rows.length === 0) {
    return {
      totalCommitted: 0,
      totalPaidToDate: 0,
      totalRetentionHeld: 0,
      totalRemaining: 0,
      moneyInsufficient: false,
    };
  }

  let committed = 0;
  let paid = 0;
  let retention = 0;
  let anyCommittedMissing = false;
  let anyPaidMissing = false;
  let anyRetentionMissing = false;

  for (const row of rows) {
    if (row.amount === null) anyCommittedMissing = true;
    else committed += row.amount;

    if (row.paidToDate === null) anyPaidMissing = true;
    else paid += row.paidToDate;

    if (row.retainageHeld === null) anyRetentionMissing = true;
    else retention += row.retainageHeld;
  }

  const totalCommitted = anyCommittedMissing ? null : committed;
  const totalPaidToDate = anyPaidMissing ? null : paid;
  const totalRetentionHeld = anyRetentionMissing ? null : retention;

  const totalRemaining =
    totalCommitted !== null && totalPaidToDate !== null
      ? Math.max(0, totalCommitted - totalPaidToDate)
      : null;

  return {
    totalCommitted,
    totalPaidToDate,
    totalRetentionHeld,
    totalRemaining,
    moneyInsufficient:
      anyCommittedMissing || anyPaidMissing || anyRetentionMissing || totalRemaining === null,
  };
}

/** Display helper for summary tiles: number → currency string, null → insufficient. */
export function formatMoneyOrInsufficient(
  value: number | null,
  formatCurrency: (n: number) => string
): string {
  if (value === null) return MONEY_INSUFFICIENT_LABEL;
  return formatCurrency(value);
}

/**
 * Human labels for the assistant rail / change feed chips.
 * Never show raw action ids like `changeOrder.reject(24-118)`.
 * Refused runs never get success wording.
 */

const LABELS: Record<string, string> = {
  "portfolio.summary": "Portfolio summary",
  "job.costVariance": "Cost variance",
  "dailyPlan.show": "Showed crew plan",
  "dailyPlan.updateLine": "Updated plan line",
  "dailyPlan.submit": "Submitted plan",
  "dailyPlan.approve": "Approved daily report",
  "dailyPlan.return": "Returned daily report",
  "dailyReport.post": "Reported day's work",
  "progressClaim.lock": "Locked progress claim",
  "estimate.approve": "Approved estimate",
  "costItem.setPmPercent": "Set PM percent",
  "costItem.setMilestone": "Set milestone",
  "changeOrder.show": "Showed change orders",
  "changeOrder.create": "Raised change order",
  "changeOrder.price": "Priced change order",
  "changeOrder.approve": "Approved change order",
  "changeOrder.reject": "Rejected change order",
  "changeOrder.void": "Voided change order",
};

/** Past-tense success → "Couldn't …" so a role/unknown/domain refusal never reads as done. */
const REFUSAL_LABELS: Record<string, string> = {
  "portfolio.summary": "Couldn't summarize portfolio",
  "job.costVariance": "Couldn't show cost variance",
  "dailyPlan.show": "Couldn't show crew plan",
  "dailyPlan.updateLine": "Couldn't update plan line",
  "dailyPlan.submit": "Couldn't submit plan",
  "dailyPlan.approve": "Couldn't approve daily report",
  "dailyPlan.return": "Couldn't return daily report",
  "dailyReport.post": "Couldn't report day's work",
  "progressClaim.lock": "Couldn't lock progress claim",
  "estimate.approve": "Couldn't approve estimate",
  "costItem.setPmPercent": "Couldn't set PM percent",
  "costItem.setMilestone": "Couldn't set milestone",
  "changeOrder.show": "Couldn't show change orders",
  "changeOrder.create": "Couldn't raise change order",
  "changeOrder.price": "Couldn't price change order",
  "changeOrder.approve": "Couldn't approve change order",
  "changeOrder.reject": "Couldn't reject change order",
  "changeOrder.void": "Couldn't void change order",
};

/** e.g. "Rejected change order on 24-118" — never `changeOrder.reject(24-118)`. */
export function actionRailLabel(
  action: string,
  job?: string | null,
  opts?: { refused?: boolean },
): string {
  const base = opts?.refused
    ? (REFUSAL_LABELS[action] ?? `Couldn't run ${action}`)
    : (LABELS[action] ?? action);
  const j = (job ?? "").trim();
  if (!j) return base;
  return `${base} on ${j}`;
}

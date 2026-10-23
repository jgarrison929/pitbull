/**
 * Human labels for the assistant rail / change feed chips.
 * Never show raw action ids like `changeOrder.reject(24-118)`.
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

/** e.g. "Rejected change order on 24-118" — never `changeOrder.reject(24-118)`. */
export function actionRailLabel(
  action: string,
  job?: string | null,
): string {
  const base = LABELS[action] ?? action;
  const j = (job ?? "").trim();
  if (!j) return base;
  // Titles that already name the object read better as "… on JOB".
  return `${base} on ${j}`;
}

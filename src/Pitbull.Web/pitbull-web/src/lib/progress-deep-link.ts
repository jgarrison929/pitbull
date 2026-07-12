/**
 * Progress draft deep links from schedule (2.14.4).
 */
export function buildProgressDraftHref(
  projectId: string,
  opts?: { activityId?: string; activityName?: string }
): string {
  const params = new URLSearchParams();
  if (opts?.activityId) params.set("activityId", opts.activityId);
  if (opts?.activityName) params.set("activityName", opts.activityName);
  const qs = params.toString();
  return `/projects/${projectId}/progress${qs ? `?${qs}` : ""}`;
}

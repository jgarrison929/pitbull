import { buildProgressDraftHref } from "./progress-deep-link";

/** Optional field report schedule deep link (2.15.0). */
export function buildFieldReportWithActivityHref(
  projectId: string,
  opts?: { activityId?: string; activityName?: string }
): string {
  const params = new URLSearchParams();
  params.set("projectId", projectId);
  if (opts?.activityId) params.set("activityId", opts.activityId);
  if (opts?.activityName) params.set("activityName", opts.activityName);
  return `/daily-reports/mobile?${params.toString()}`;
}

export { buildProgressDraftHref };

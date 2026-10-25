/**
 * Sub → RFI list deep link (2.14.6). Real search filter only — no fake health scores.
 */
export function buildProjectRfisForSubHref(
  projectId: string,
  opts?: { subName?: string | null; subId?: string | null }
): string {
  const params = new URLSearchParams();
  const q = opts?.subName?.trim();
  if (q) params.set("search", q);
  if (opts?.subId?.trim()) params.set("subId", opts.subId.trim());
  const qs = params.toString();
  return `/projects/${projectId}/rfis${qs ? `?${qs}` : ""}`;
}

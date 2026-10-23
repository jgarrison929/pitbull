/** A job is active only after the estimate is approved into Original Budget. */
export function isActiveJob(job: { estimateStatus: string }): boolean {
  return job.estimateStatus === "approved";
}

/** Portfolio health (counts, CPI/SPI/EAC roll-ups) uses active jobs only. */
export function activeJobsOnly<T extends { job: { estimateStatus: string } }>(
  jobs: T[],
): T[] {
  return jobs.filter((j) => isActiveJob(j.job));
}

/** Draft-estimate jobs show "—" for indices and EAC — never 1.00 / $0 / On track. */
export function isEstimateDraft(job: { estimateStatus: string }): boolean {
  return job.estimateStatus === "draft";
}

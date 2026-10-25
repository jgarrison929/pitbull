/**
 * Part E (5.0.3): exact unknown-job refusal wording.
 * Cap at 3 approved jobs; never offer drafts such as 26-010.
 */

/** Approved jobs only, number ascending, at most 3. */
export function pickUnknownJobChoices(
  portfolio: { job: { number: string; estimateStatus: string } }[],
): string[] {
  return portfolio
    .filter((p) => p.job.estimateStatus === "approved")
    .map((p) => p.job.number)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .slice(0, 3);
}

/** Exact templates — no extra sentences. */
export function formatUnknownJobRefusal(
  number: string,
  choices: string[],
): string {
  const offered = choices.slice(0, 3);
  if (offered.length === 0) return `There is no job ${number}.`;
  if (offered.length === 1) {
    return `There is no job ${number}. Try ${offered[0]}`;
  }
  if (offered.length === 2) {
    return `There is no job ${number}. Try ${offered[0]} or ${offered[1]}`;
  }
  return `There is no job ${number}. Try ${offered[0]}, ${offered[1]}, or ${offered[2]}`;
}

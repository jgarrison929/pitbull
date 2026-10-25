/**
 * Overlay formula thresholds (2.17.9) — mirror of API SpatialOverlayCalculator
 * for frontend regression. Source of truth for paint remains the API.
 *
 * Never invent OnTrack when data is missing.
 */

export type OverlayBandName =
  | "InsufficientData"
  | "OnTrack"
  | "Watch"
  | "Risk";

/** RFI open count → band (null = insufficient, not zero). */
export function rfiBandFromOpenCount(
  openRfiCount: number | null | undefined
): OverlayBandName {
  if (openRfiCount === null || openRfiCount === undefined)
    return "InsufficientData";
  if (openRfiCount <= 0) return "OnTrack";
  if (openRfiCount <= 2) return "Watch";
  return "Risk";
}

/** Progress percent 0–100 → band (null = insufficient). */
export function progressBandFromPercent(
  progressPercent: number | null | undefined
): OverlayBandName {
  if (progressPercent === null || progressPercent === undefined)
    return "InsufficientData";
  if (progressPercent < 25) return "Risk";
  if (progressPercent < 75) return "Watch";
  return "OnTrack";
}

/** Schedule: missing both flags → insufficient; critical+delay → risk. */
export function scheduleBandFromSignals(
  isCritical: boolean | null | undefined,
  daysBehind: number | null | undefined
): OverlayBandName {
  if (isCritical === null && daysBehind === null) return "InsufficientData";
  if (isCritical === undefined && daysBehind === undefined)
    return "InsufficientData";
  if (isCritical === true && (daysBehind ?? 0) > 0) return "Risk";
  if (isCritical === true) return "Watch";
  if ((daysBehind ?? 0) > 0) return "Watch";
  return "OnTrack";
}

/** Cost: no allocation → insufficient (never invent green cost). */
export function costBandFromAllocation(
  hasCostAllocation: boolean | null | undefined
): OverlayBandName {
  if (hasCostAllocation !== true) return "InsufficientData";
  return "Watch"; // allocated but full heat deferred — proxy, not OnTrack invent
}

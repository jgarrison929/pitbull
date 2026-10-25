/**
 * Help Center — Digital Twin overlay truth legend (2.15.8).
 * Never claim “all green by default” — empty/gray = insufficient, not all-clear.
 */

export const TWIN_TRUTH_LEGEND_SECTION_TITLE = "Digital Twin overlays — truth legend";

export type TwinTruthBand = {
  id: string;
  band: string;
  meaning: string;
};

/** Band meanings shown in Help; must stay honest. */
export const twinTruthBands: TwinTruthBand[] = [
  {
    id: "on-track",
    band: "On track (green)",
    meaning:
      "Only when overlay data is present and thresholds pass. Never the default for empty zones.",
  },
  {
    id: "watch",
    band: "Watch (amber)",
    meaning: "Data exists but metrics are borderline — treat as attention, not all-clear.",
  },
  {
    id: "risk",
    band: "Risk (red)",
    meaning: "Open issues or thresholds exceeded (e.g. open RFIs). Investigate before claiming health.",
  },
  {
    id: "insufficient",
    band: "Insufficient / gray",
    meaning:
      "Missing graph, mode data, or links. Gray is not green and not “all clear.” Empty photo pins also mean no pins yet — not all-clear.",
  },
];

export const twinTruthLegendBullets: string[] = [
  "Open Digital Twin at `/projects/{id}/twin` for a job with Spatial.View.",
  "Overlay modes (RFIs*, Progress*, Schedule*) may use proxies — labels with * are not full truth.",
  "Gray / insufficient is honest: no data does not paint green.",
  "Never interpret an empty zone panel or empty photo pins as “all clear.”",
];

/** Copy blob for tests — must not claim all-green default. */
export function twinTruthLegendBlob(): string {
  return [
    TWIN_TRUTH_LEGEND_SECTION_TITLE,
    ...twinTruthBands.map((b) => `${b.band}: ${b.meaning}`),
    ...twinTruthLegendBullets,
  ].join("\n");
}

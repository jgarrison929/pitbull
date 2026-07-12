/**
 * Field / pour capture helpers — plain language for supers.
 * Maps form chips → structured daily-report data (no invented KPIs).
 */

export type FieldActivityId =
  | "pour"
  | "form"
  | "rebar"
  | "finish"
  | "excavate"
  | "other";

export const FIELD_ACTIVITIES: {
  id: FieldActivityId;
  label: string;
  /** Short hint under chip */
  hint: string;
}[] = [
  { id: "pour", label: "Pour", hint: "Place concrete" },
  { id: "form", label: "Form", hint: "Formwork" },
  { id: "rebar", label: "Rebar", hint: "Steel / rebar" },
  { id: "finish", label: "Finish", hint: "Screed / finish" },
  { id: "excavate", label: "Dirt", hint: "Excavate / grade" },
  { id: "other", label: "Other", hint: "Other work" },
];

export type TruckConditionId =
  | "ok"
  | "too_wet"
  | "too_dry"
  | "rejected"
  | "held";

export const TRUCK_CONDITIONS: {
  id: TruckConditionId;
  label: string;
}[] = [
  { id: "ok", label: "OK" },
  { id: "too_wet", label: "Too wet" },
  { id: "too_dry", label: "Too dry / chunky" },
  { id: "rejected", label: "Rejected" },
  { id: "held", label: "Held / drive around" },
];

/**
 * Concrete truck / material chips (slump, rejected, drive-around) only apply
 * when the super selected Pour. Other activities hide that section.
 */
export const ACTIVITIES_WITH_TRUCK_MATERIAL: readonly FieldActivityId[] = [
  "pour",
];

/** Whether Trucks / material UI should show for the current activity selection. */
export function showsTruckMaterialSection(
  activities: readonly FieldActivityId[]
): boolean {
  return activities.some((id) => ACTIVITIES_WITH_TRUCK_MATERIAL.includes(id));
}

export interface FieldCrewCount {
  trade: string;
  count: number;
}

export interface PourFieldSnapshot {
  activities: FieldActivityId[];
  truckConditions: TruckConditionId[];
  truckNotes: string;
  crewCounts: FieldCrewCount[];
  workNarrative: string;
}

/** Toggle activity in selection (multi-select). */
export function toggleFieldActivity(
  current: FieldActivityId[],
  id: FieldActivityId
): FieldActivityId[] {
  return current.includes(id)
    ? current.filter((a) => a !== id)
    : [...current, id];
}

export function toggleTruckCondition(
  current: TruckConditionId[],
  id: TruckConditionId
): TruckConditionId[] {
  return current.includes(id)
    ? current.filter((c) => c !== id)
    : [...current, id];
}

/**
 * Build structured crew rows for API/offline payload.
 * Drops empty trades and non-positive counts.
 */
export function normalizeCrewCounts(
  rows: FieldCrewCount[]
): FieldCrewCount[] {
  return rows
    .map((r) => ({
      trade: r.trade.trim(),
      count: Math.max(0, Math.floor(Number(r.count) || 0)),
    }))
    .filter((r) => r.trade.length > 0 && r.count > 0);
}

/**
 * Append activity + truck chips into work narrative when user hasn't typed yet,
 * or as a structured prefix line. Does not invent quantities.
 */
export function buildFieldWorkSummary(snapshot: PourFieldSnapshot): string {
  const activityLabels = snapshot.activities
    .map((id) => FIELD_ACTIVITIES.find((a) => a.id === id)?.label)
    .filter(Boolean) as string[];
  const includeTrucks = showsTruckMaterialSection(snapshot.activities);
  const truckLabels = includeTrucks
    ? (snapshot.truckConditions
        .map((id) => TRUCK_CONDITIONS.find((t) => t.id === id)?.label)
        .filter(Boolean) as string[])
    : [];

  const parts: string[] = [];
  if (activityLabels.length) {
    parts.push(`Work: ${activityLabels.join(", ")}.`);
  }
  if (truckLabels.length) {
    parts.push(`Material/trucks: ${truckLabels.join(", ")}.`);
  }
  if (includeTrucks && snapshot.truckNotes.trim()) {
    parts.push(snapshot.truckNotes.trim());
  }
  const crew = normalizeCrewCounts(snapshot.crewCounts);
  if (crew.length) {
    parts.push(
      `Crew: ${crew.map((c) => `${c.trade}×${c.count}`).join("; ")}.`
    );
  }
  const narrative = snapshot.workNarrative.trim();
  if (narrative) {
    parts.push(narrative);
  }
  return parts.join(" ").trim();
}

/**
 * Field step is complete enough to proceed when project is set and
 * (activity selected OR narrative/voice present OR crew counts).
 */
export function isFieldStepReady(snapshot: PourFieldSnapshot): boolean {
  if (snapshot.activities.length > 0) return true;
  if (snapshot.workNarrative.trim().length > 0) return true;
  if (normalizeCrewCounts(snapshot.crewCounts).length > 0) return true;
  // Truck chips only count when Pour is selected (section is visible)
  if (showsTruckMaterialSection(snapshot.activities)) {
    if (snapshot.truckConditions.length > 0) return true;
    if (snapshot.truckNotes.trim().length > 0) return true;
  }
  return false;
}

/** Default crew trade chips for pour days. */
export const DEFAULT_CREW_TRADES = [
  "Form",
  "Place",
  "Finish",
  "Labor",
  "Operator",
] as const;

/**
 * Steps for mobile daily report (short path for supers).
 * Weather is optional and not a separate wizard step.
 */
export const MOBILE_REPORT_STEPS = [
  "Project",
  "Field",
  "Photos",
  "Review",
] as const;

export type MobileReportStep = (typeof MOBILE_REPORT_STEPS)[number];

export function nextReportStep(
  current: MobileReportStep
): MobileReportStep | null {
  const i = MOBILE_REPORT_STEPS.indexOf(current);
  if (i < 0 || i >= MOBILE_REPORT_STEPS.length - 1) return null;
  return MOBILE_REPORT_STEPS[i + 1]!;
}

export function prevReportStep(
  current: MobileReportStep
): MobileReportStep | null {
  const i = MOBILE_REPORT_STEPS.indexOf(current);
  if (i <= 0) return null;
  return MOBILE_REPORT_STEPS[i - 1]!;
}

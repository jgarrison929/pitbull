/**
 * Build offline queue payload for mobile daily report submit.
 * Pure so unit tests assert projectId/title fields without IndexedDB.
 */

import type { OfflineDailyReport, OfflineDailyReportPhoto } from "./offline-store";
import {
  buildFieldWorkSummary,
  normalizeCrewCounts,
  type FieldActivityId,
  type FieldCrewCount,
  type TruckConditionId,
} from "./pour-field";
import {
  applyTwinFuelToReportData,
  pickPlanSheet,
  pickSpatialContext,
  type PlanSheetOption,
  type SpatialZoneOption,
} from "./spatial-context";

export interface MobileDailyReportFormSnapshot {
  projectId: string;
  reportDate: string;
  reportType: string;
  weatherSummary?: string;
  temperatureLow?: string;
  temperatureHigh?: string;
  precipitation?: string;
  wind?: string;
  workNarrative?: string;
  delaysNarrative?: string;
  safetyNarrative?: string;
  fieldActivities?: FieldActivityId[];
  truckConditions?: TruckConditionId[];
  truckNotes?: string;
  crewCounts?: FieldCrewCount[];
  photos?: OfflineDailyReportPhoto[];
  /** Optional zones-first twin fuel — omit/skip when unset. */
  spatialNodeId?: string | null;
  /** Optional plan sheet fuel for twin plan links. */
  planSheetId?: string | null;
  /** Zone catalog used to validate pick (offline skip if missing). */
  zones?: SpatialZoneOption[];
  planSheets?: PlanSheetOption[];
  asDraft?: boolean;
}

export function buildOfflineDailyReportPayload(
  form: MobileDailyReportFormSnapshot,
  id?: string
): OfflineDailyReport {
  if (!form.projectId) {
    throw new Error("projectId is required to queue a daily report");
  }

  const crewEntries = normalizeCrewCounts(form.crewCounts ?? []);
  const activities = form.fieldActivities ?? [];
  const truckConditions = form.truckConditions ?? [];
  const truckNotes = form.truckNotes?.trim() ?? "";

  // Prefer explicit narrative; otherwise build from field chips (super language)
  const workFromField = buildFieldWorkSummary({
    activities,
    truckConditions,
    truckNotes,
    crewCounts: crewEntries,
    workNarrative: form.workNarrative ?? "",
  });

  const title = `Daily Report - ${form.reportDate}`;
  const zoneDecision = pickSpatialContext(form.zones ?? [], form.spatialNodeId);
  const planDecision = pickPlanSheet(form.planSheets ?? [], form.planSheetId);
  const spatialNodeId =
    zoneDecision.kind === "apply" ? zoneDecision.spatialNodeId : undefined;
  const planSheetId =
    planDecision.kind === "apply" ? planDecision.planSheetId : undefined;
  return {
    id:
      id ??
      (typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `dr-${Date.now()}`),
    projectId: form.projectId,
    title,
    reportDate: form.reportDate,
    reportType: form.reportType,
    weatherSummary: form.weatherSummary || undefined,
    temperatureLow: form.temperatureLow || undefined,
    temperatureHigh: form.temperatureHigh || undefined,
    precipitation: form.precipitation || undefined,
    wind: form.wind || undefined,
    workNarrative: workFromField || form.workNarrative || undefined,
    delaysNarrative: form.delaysNarrative || undefined,
    safetyNarrative: form.safetyNarrative || undefined,
    fieldActivities: activities.length ? activities : undefined,
    truckConditions: truckConditions.length ? truckConditions : undefined,
    truckNotes: truckNotes || undefined,
    crewEntries: crewEntries.length ? crewEntries : undefined,
    photos: form.photos?.length ? form.photos : undefined,
    spatialNodeId,
    planSheetId,
    status: form.asDraft ? "Draft" : "Submitted",
    createdAt: new Date().toISOString(),
  };
}

/** Online API `data` object — maps form + field chips for PmDailyReport payload. */
export function buildDailyReportApiData(form: MobileDailyReportFormSnapshot): Record<string, unknown> {
  const crewEntries = normalizeCrewCounts(form.crewCounts ?? []);
  const activities = form.fieldActivities ?? [];
  const truckConditions = form.truckConditions ?? [];
  const truckNotes = form.truckNotes?.trim() ?? "";
  const workNarrative = buildFieldWorkSummary({
    activities,
    truckConditions,
    truckNotes,
    crewCounts: crewEntries,
    workNarrative: form.workNarrative ?? "",
  });

  const base: Record<string, unknown> = {
    ReportDate: form.reportDate,
    ReportType: form.reportType,
    WeatherSummary: form.weatherSummary || null,
    TemperatureLow: form.temperatureLow ? Number(form.temperatureLow) : null,
    TemperatureHigh: form.temperatureHigh ? Number(form.temperatureHigh) : null,
    Precipitation: form.precipitation || null,
    Wind: form.wind || null,
    WorkNarrative: workNarrative || form.workNarrative || null,
    DelaysNarrative: form.delaysNarrative || null,
    SafetyNarrative: form.safetyNarrative || null,
    FieldActivities: activities.length ? activities : null,
    TruckConditions: truckConditions.length ? truckConditions : null,
    TruckNotes: truckNotes || null,
    CrewEntries: crewEntries.length ? crewEntries : null,
  };

  const zoneDecision = pickSpatialContext(form.zones ?? [], form.spatialNodeId);
  const planDecision = pickPlanSheet(form.planSheets ?? [], form.planSheetId);
  return applyTwinFuelToReportData(base, zoneDecision, planDecision);
}

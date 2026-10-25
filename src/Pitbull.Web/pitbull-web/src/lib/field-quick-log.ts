/**
 * Quick field log + last project/sheet defaults (3.1.6–3.1.7).
 * Posts through the same daily-report offline/online path — no parallel API.
 */

import type { MobileDailyReportFormSnapshot } from "./daily-report-offline";
import { buildOfflineDailyReportPayload } from "./daily-report-offline";

export const FIELD_LAST_DEFAULTS_KEY = "pitbull.field.lastDefaults.v1";
export const QUICK_LOG_MODE = "quick";

export interface FieldLastDefaults {
  projectId?: string;
  planSheetId?: string;
  updatedAt?: string;
}

export function parseFieldLastDefaults(raw: string | null): FieldLastDefaults {
  if (!raw) return {};
  try {
    const o = JSON.parse(raw) as FieldLastDefaults;
    return {
      projectId: typeof o.projectId === "string" ? o.projectId : undefined,
      planSheetId: typeof o.planSheetId === "string" ? o.planSheetId : undefined,
      updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : undefined,
    };
  } catch {
    return {};
  }
}

export function loadFieldLastDefaults(
  storage?: Pick<Storage, "getItem"> | null
): FieldLastDefaults {
  try {
    const s = storage ?? (typeof localStorage !== "undefined" ? localStorage : null);
    if (!s) return {};
    return parseFieldLastDefaults(s.getItem(FIELD_LAST_DEFAULTS_KEY));
  } catch {
    return {};
  }
}

export function saveFieldLastDefaults(
  defaults: FieldLastDefaults,
  storage?: Pick<Storage, "setItem"> | null
): void {
  try {
    const s = storage ?? (typeof localStorage !== "undefined" ? localStorage : null);
    if (!s) return;
    const payload: FieldLastDefaults = {
      projectId: defaults.projectId || undefined,
      planSheetId: defaults.planSheetId || undefined,
      updatedAt: new Date().toISOString(),
    };
    s.setItem(FIELD_LAST_DEFAULTS_KEY, JSON.stringify(payload));
  } catch {
    /* private mode / SSR */
  }
}

export function isQuickLogMode(
  searchParams: { get(name: string): string | null } | null | undefined
): boolean {
  if (!searchParams) return false;
  const mode = (searchParams.get("mode") ?? "").toLowerCase();
  return mode === QUICK_LOG_MODE || mode === "quicklog";
}

/**
 * Initial wizard step for field report. Must be a real MobileReportStep
 * (Project | Field | Photos | Review) — never invent "Work".
 * Quick log lands on Field so work narrative + activities are immediately reachable.
 */
export function initialFieldReportStep(
  quickLog: boolean
): "Project" | "Field" | "Photos" | "Review" {
  return quickLog ? "Field" : "Project";
}

export function buildQuickLogHref(projectId?: string): string {
  const q = new URLSearchParams();
  q.set("mode", QUICK_LOG_MODE);
  if (projectId) q.set("projectId", projectId);
  return `/daily-reports/mobile?${q.toString()}`;
}

export interface QuickLogInput {
  projectId: string;
  reportDate?: string;
  workNarrative: string;
  planSheetId?: string | null;
  photos?: MobileDailyReportFormSnapshot["photos"];
  asDraft?: boolean;
}

/**
 * Snapshot for the shared offline/online daily-report builders.
 * Minimal fields only — weather/crew optional for full wizard.
 */
export function buildQuickLogFormSnapshot(
  input: QuickLogInput
): MobileDailyReportFormSnapshot {
  if (!input.projectId?.trim()) {
    throw new Error("projectId is required for quick log");
  }
  const work = (input.workNarrative ?? "").trim();
  if (!work && !(input.photos && input.photos.length > 0)) {
    throw new Error("work narrative or photos required for quick log");
  }
  const planSheetId = input.planSheetId?.trim() || undefined;
  // Catalog entry so pickPlanSheet applies PlanSheetId on the real offline path
  const planSheets = planSheetId
    ? [
        {
          id: planSheetId,
          drawingNumber: planSheetId,
          title: planSheetId,
        },
      ]
    : undefined;

  return {
    projectId: input.projectId.trim(),
    reportDate: input.reportDate || new Date().toISOString().slice(0, 10),
    reportType: "Foreman",
    workNarrative: work || "Field quick log",
    planSheetId,
    planSheets,
    photos: input.photos,
    asDraft: input.asDraft ?? false,
  };
}

/** Drive the real offline payload builder (same path as full wizard). */
export function buildQuickLogOfflinePayload(input: QuickLogInput) {
  return buildOfflineDailyReportPayload(buildQuickLogFormSnapshot(input));
}

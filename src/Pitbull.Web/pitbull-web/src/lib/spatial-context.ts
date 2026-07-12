/**
 * Pure helpers for zones-first spatial context on field capture.
 * Zone is optional unless company RequireSpatialOnProgress is on and zones exist.
 */

export interface SpatialZoneOption {
  id: string;
  code: string;
  name: string;
  pathLabel: string;
}

export type SpatialContextDecision =
  | { kind: "skip" }
  | { kind: "apply"; spatialNodeId: string; zone: SpatialZoneOption };

/** Normalize API / form values into a decision. Empty / invalid → skip. */
export function pickSpatialContext(
  zones: SpatialZoneOption[],
  selectedId: string | null | undefined
): SpatialContextDecision {
  const id = typeof selectedId === "string" ? selectedId.trim() : "";
  if (!id) return { kind: "skip" };
  const zone = zones.find((z) => z.id === id);
  if (!zone) return { kind: "skip" };
  return { kind: "apply", spatialNodeId: zone.id, zone };
}

/** Merge optional SpatialNodeId into daily-report API data without mutating input. */
export function applySpatialContextToReportData(
  data: Record<string, unknown>,
  decision: SpatialContextDecision
): Record<string, unknown> {
  if (decision.kind === "skip") {
    // Explicitly omit — do not send null unless caller already set it
    const { SpatialNodeId: _drop, ...rest } = data;
    return rest;
  }
  return { ...data, SpatialNodeId: decision.spatialNodeId };
}

/**
 * Whether company policy asks for a spatial zone on progress submits.
 * Only meaningful when the project has zone options loaded.
 */
export function isSpatialZoneRequired(
  requireSpatialOnProgress: boolean,
  zonesAvailable: boolean
): boolean {
  return requireSpatialOnProgress === true && zonesAvailable === true;
}

/**
 * Block non-draft submit (online or offline queue) when zone is required and missing.
 * Drafts remain free to save without a zone.
 * Demo users may skip (honest demo path — production still enforces).
 */
export function canSubmitWithSpatialPolicy(opts: {
  requireSpatialOnProgress: boolean;
  zones: SpatialZoneOption[];
  decision: SpatialContextDecision;
  asDraft: boolean;
  /** JWT isDemoUser / demo persona — skip enforcement for demos */
  isDemoUser?: boolean;
}): { ok: true } | { ok: false; message: string } {
  if (opts.asDraft) return { ok: true };
  if (opts.isDemoUser) return { ok: true };
  if (!isSpatialZoneRequired(opts.requireSpatialOnProgress, opts.zones.length > 0)) {
    return { ok: true };
  }
  if (opts.decision.kind === "apply") return { ok: true };
  return {
    ok: false,
    message:
      "Select a site zone before submitting. Company settings require a spatial zone on progress reports when zones exist for this job.",
  };
}

/** @deprecated Prefer canSubmitWithSpatialPolicy — kept for existing imports. */
export function isSpatialContextOptionalForSubmit(
  decision: SpatialContextDecision,
  requireSpatialOnProgress = false,
  zonesAvailable = false
): boolean {
  if (!isSpatialZoneRequired(requireSpatialOnProgress, zonesAvailable)) return true;
  return decision.kind === "apply";
}

export function formatZoneLabel(
  zone: SpatialZoneOption | null | undefined,
  required = false
): string {
  if (!zone) return required ? "No zone (required)" : "No zone (optional)";
  const path = zone.pathLabel?.trim();
  if (path) return path;
  return `${zone.code} — ${zone.name}`.trim();
}

/** Build zone options from API-shaped payloads (camelCase or PascalCase). */
export function normalizeZoneOptions(raw: unknown): SpatialZoneOption[] {
  if (!Array.isArray(raw)) return [];
  const out: SpatialZoneOption[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const id = String(o.id ?? o.Id ?? "").trim();
    if (!id) continue;
    out.push({
      id,
      code: String(o.code ?? o.Code ?? ""),
      name: String(o.name ?? o.Name ?? ""),
      pathLabel: String(o.pathLabel ?? o.PathLabel ?? ""),
    });
  }
  return out;
}

export interface PlanSheetOption {
  id: string;
  drawingNumber: string;
  title: string;
}

export type PlanSheetDecision =
  | { kind: "skip" }
  | { kind: "apply"; planSheetId: string; sheet: PlanSheetOption };

export function pickPlanSheet(
  sheets: PlanSheetOption[],
  selectedId: string | null | undefined
): PlanSheetDecision {
  const id = typeof selectedId === "string" ? selectedId.trim() : "";
  if (!id) return { kind: "skip" };
  const sheet = sheets.find((s) => s.id === id);
  if (!sheet) return { kind: "skip" };
  return { kind: "apply", planSheetId: sheet.id, sheet };
}

/** Attach optional zone + plan sheet to report data without blocking skip. */
export function applyTwinFuelToReportData(
  data: Record<string, unknown>,
  zone: SpatialContextDecision,
  plan: PlanSheetDecision
): Record<string, unknown> {
  const next = applySpatialContextToReportData(data, zone);
  if (plan.kind === "skip") {
    const { PlanSheetId: _drop, ...rest } = next;
    return rest;
  }
  return { ...next, PlanSheetId: plan.planSheetId };
}

/** Local remember last zone for a project (field convenience; not a KPI). */
const LAST_ZONE_KEY = "pitbull-last-zone-by-project";

export function rememberLastZone(projectId: string, zoneId: string | null): void {
  if (typeof localStorage === "undefined") return;
  try {
    const raw = localStorage.getItem(LAST_ZONE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    if (!zoneId) delete map[projectId];
    else map[projectId] = zoneId;
    localStorage.setItem(LAST_ZONE_KEY, JSON.stringify(map));
  } catch {
    // ignore quota
  }
}

export function recallLastZone(projectId: string): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(LAST_ZONE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, string>;
    return map[projectId] ?? null;
  } catch {
    return null;
  }
}

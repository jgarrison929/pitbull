/**
 * Pure helpers for optional zones-first spatial context on field capture.
 * Skip is always safe — never block offline submit when zone is unset.
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

/** True when form may submit offline/online regardless of zone selection. */
export function isSpatialContextOptionalForSubmit(
  decision: SpatialContextDecision
): boolean {
  // Zone is always optional for capture fuel
  void decision;
  return true;
}

export function formatZoneLabel(zone: SpatialZoneOption | null | undefined): string {
  if (!zone) return "No zone (optional)";
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

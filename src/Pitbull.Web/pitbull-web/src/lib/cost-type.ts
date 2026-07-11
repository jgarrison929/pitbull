/**
 * Job-cost cost class labels — must stay in sync with Pitbull.Core.Domain.CostType
 * and CostTypeLabels.DisplayName. Integer values are API-stable; never renumber.
 */

export enum CostType {
  Labor = 1,
  Material = 2,
  Equipment = 3,
  /** Legacy umbrella; prefer SubLabor / SubMaterial / SubThirdParty for new codes */
  Subcontract = 4,
  Other = 5,
  Overhead = 6,
  SubLabor = 7,
  SubMaterial = 8,
  SubThirdParty = 9,
}

/** Super-facing labels (match API CostTypeName). */
export const COST_TYPE_LABELS: Record<CostType, string> = {
  [CostType.Labor]: "Labor",
  [CostType.Material]: "Material",
  [CostType.Equipment]: "Equipment",
  [CostType.Subcontract]: "Sub (general)",
  [CostType.Other]: "Other",
  [CostType.Overhead]: "Overhead",
  [CostType.SubLabor]: "Sub Labor",
  [CostType.SubMaterial]: "Sub Material",
  [CostType.SubThirdParty]: "Sub Third Party",
};

/** Stable order for filters and create forms. */
export const COST_TYPE_OPTIONS: CostType[] = [
  CostType.Labor,
  CostType.Material,
  CostType.Equipment,
  CostType.SubLabor,
  CostType.SubMaterial,
  CostType.SubThirdParty,
  CostType.Overhead,
  CostType.Subcontract,
  CostType.Other,
];

export function costTypeLabel(type: CostType | number | string | null | undefined): string {
  const n = typeof type === "string" ? Number.parseInt(type, 10) : type;
  if (n == null || Number.isNaN(n as number)) return "Unknown";
  return COST_TYPE_LABELS[n as CostType] ?? `Type ${n}`;
}

export function isSubRelatedCostType(type: CostType | number): boolean {
  return (
    type === CostType.Subcontract ||
    type === CostType.SubLabor ||
    type === CostType.SubMaterial ||
    type === CostType.SubThirdParty
  );
}

/** Self-perform labor codes used by crew/time entry pickers. */
export function isSelfPerformLabor(type: CostType | number): boolean {
  return type === CostType.Labor;
}

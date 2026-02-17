import api from "@/lib/api";

export type LaborGroupBy = "employee" | "costCode" | "phase";

export interface LaborCostReportRow {
  groupKey: string;
  groupLabel: string;
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  totalCost: number;
}

export interface LaborCostSummary {
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  totalCost: number;
}

export interface LaborCostSubtotal {
  label: string;
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  totalCost: number;
}

export interface LaborCostReportResponse {
  from: string;
  to: string;
  groupBy: LaborGroupBy;
  projectId: string | null;
  rows: LaborCostReportRow[];
  totals: LaborCostSummary;
  subtotals: LaborCostSubtotal[];
}

export interface ProjectProfitabilityRow {
  projectId: string;
  projectNumber: string;
  projectName: string;
  budget: number;
  revenue: number;
  laborCost: number;
  equipmentCost: number;
  actualCost: number;
  profit: number;
  profitMarginPercent: number;
}

export interface ProjectProfitabilityTotals {
  budget: number;
  revenue: number;
  laborCost: number;
  equipmentCost: number;
  actualCost: number;
  profit: number;
  profitMarginPercent: number;
}

export interface ProjectProfitabilityReportResponse {
  from: string;
  to: string;
  rows: ProjectProfitabilityRow[];
  totals: ProjectProfitabilityTotals;
}

export interface EquipmentUtilizationRow {
  equipmentId: string;
  equipmentCode: string;
  equipmentName: string;
  equipmentType: string;
  totalHoursUsed: number;
  daysAssigned: number;
  utilizationPercent: number;
  cost: number;
}

export interface EquipmentUtilizationTotals {
  totalHoursUsed: number;
  totalDaysAssigned: number;
  totalCost: number;
  averageUtilizationPercent: number;
}

export interface EquipmentUtilizationReportResponse {
  from: string;
  to: string;
  workDays: number;
  rows: EquipmentUtilizationRow[];
  totals: EquipmentUtilizationTotals;
}

export interface WeeklySummaryDay {
  label: string;
  date: string;
}

export interface WeeklySummaryRow {
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  dayHours: number[];
  weeklyTotal: number;
}

export interface WeeklySummaryTotals {
  dayHours: number[];
  weeklyTotal: number;
}

export interface WeeklySummaryReportResponse {
  weekOf: string;
  weekStart: string;
  weekEnd: string;
  projectId: string | null;
  days: WeeklySummaryDay[];
  rows: WeeklySummaryRow[];
  totals: WeeklySummaryTotals;
}

export async function getLaborCostReport(params: {
  from: string;
  to: string;
  groupBy: LaborGroupBy;
  projectId?: string;
}) {
  const query = new URLSearchParams({
    from: params.from,
    to: params.to,
    groupBy: params.groupBy,
  });

  if (params.projectId) {
    query.set("projectId", params.projectId);
  }

  return api<LaborCostReportResponse>(`/api/reports/labor-cost?${query.toString()}`);
}

export async function getProjectProfitabilityReport(params: { from: string; to: string }) {
  const query = new URLSearchParams(params);
  return api<ProjectProfitabilityReportResponse>(`/api/reports/project-profitability?${query.toString()}`);
}

export async function getEquipmentUtilizationReport(params: { from: string; to: string }) {
  const query = new URLSearchParams(params);
  return api<EquipmentUtilizationReportResponse>(`/api/reports/equipment-utilization?${query.toString()}`);
}

export async function getWeeklySummaryReport(params: { weekOf: string; projectId?: string }) {
  const query = new URLSearchParams({ weekOf: params.weekOf });
  if (params.projectId) {
    query.set("projectId", params.projectId);
  }
  return api<WeeklySummaryReportResponse>(`/api/reports/weekly-summary?${query.toString()}`);
}

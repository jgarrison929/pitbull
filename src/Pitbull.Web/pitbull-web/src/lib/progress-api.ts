import api from "./api";
import type { PmEntityDto, PmPagedResult, PmActionResultDto } from "./pm-types";

// ─── Field Progress ───────────────────────────────────────────────────────────

export async function listFieldProgress(
  projectId: string,
  params?: { page?: number; pageSize?: number; startDate?: string; endDate?: string }
): Promise<PmPagedResult> {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.pageSize) q.set("pageSize", String(params.pageSize));
  if (params?.startDate) q.set("startDate", params.startDate);
  if (params?.endDate) q.set("endDate", params.endDate);
  const qs = q.toString();
  return api<PmPagedResult>(`/api/projects/${projectId}/field-progress${qs ? `?${qs}` : ""}`);
}

export async function getFieldProgressEntry(projectId: string, entryId: string): Promise<PmEntityDto> {
  return api<PmEntityDto>(`/api/projects/${projectId}/field-progress/${entryId}`);
}

export interface CreateFieldProgressRequest {
  CostCodeId: string;
  QuantityInstalled: number;
  TotalBudgetedQuantity: number;
  Date?: string;
  ScheduleActivityId?: string;
  UnitOfMeasure?: string;
  CrewSize?: number;
  HoursWorked?: number;
  WeatherCondition?: string;
  Notes?: string;
}

export async function createFieldProgressEntry(
  projectId: string,
  data: CreateFieldProgressRequest
): Promise<PmEntityDto> {
  return api<PmEntityDto>(`/api/projects/${projectId}/field-progress`, {
    method: "POST",
    body: { data },
  });
}

export async function updateFieldProgressEntry(
  projectId: string,
  entryId: string,
  data: Partial<CreateFieldProgressRequest>
): Promise<PmEntityDto> {
  return api<PmEntityDto>(`/api/projects/${projectId}/field-progress/${entryId}`, {
    method: "PUT",
    body: { data },
  });
}

export async function deleteFieldProgressEntry(projectId: string, entryId: string): Promise<void> {
  await api<void>(`/api/projects/${projectId}/field-progress/${entryId}`, { method: "DELETE" });
}

// ─── Cost Code Activity Mappings ──────────────────────────────────────────────

export async function listCostCodeMappings(
  projectId: string,
  params?: { page?: number; pageSize?: number }
): Promise<PmPagedResult> {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.pageSize) q.set("pageSize", String(params.pageSize));
  const qs = q.toString();
  return api<PmPagedResult>(`/api/projects/${projectId}/cost-code-activity-mappings${qs ? `?${qs}` : ""}`);
}

export async function createCostCodeMapping(
  projectId: string,
  data: { CostCodeId: string; ScheduleActivityId: string; WeightFactor?: number }
): Promise<PmEntityDto> {
  return api<PmEntityDto>(`/api/projects/${projectId}/cost-code-activity-mappings`, {
    method: "POST",
    body: { data },
  });
}

export async function updateCostCodeMapping(
  projectId: string,
  mappingId: string,
  data: { WeightFactor: number }
): Promise<PmEntityDto> {
  return api<PmEntityDto>(`/api/projects/${projectId}/cost-code-activity-mappings/${mappingId}`, {
    method: "PUT",
    body: { data },
  });
}

export async function deleteCostCodeMapping(projectId: string, mappingId: string): Promise<void> {
  await api<void>(`/api/projects/${projectId}/cost-code-activity-mappings/${mappingId}`, {
    method: "DELETE",
  });
}

// ─── Earned Value ─────────────────────────────────────────────────────────────

export async function calculateEarnedValue(
  projectId: string,
  costCodeId: string,
  date: string
): Promise<PmEntityDto> {
  return api<PmEntityDto>(
    `/api/projects/${projectId}/earned-value/calculate?costCodeId=${costCodeId}&date=${date}`,
    { method: "POST", body: {} }
  );
}

export async function recalculateEarnedValue(
  projectId: string,
  date: string
): Promise<PmActionResultDto> {
  return api<PmActionResultDto>(
    `/api/projects/${projectId}/earned-value/recalculate?date=${date}`,
    { method: "POST", body: {} }
  );
}

export async function getEarnedValueSummary(
  projectId: string,
  asOfDate: string
): Promise<PmActionResultDto> {
  return api<PmActionResultDto>(
    `/api/projects/${projectId}/earned-value/summary?asOfDate=${asOfDate}`
  );
}

export async function getEarnedValueSnapshots(
  projectId: string,
  params?: { page?: number; pageSize?: number }
): Promise<PmPagedResult> {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.pageSize) q.set("pageSize", String(params.pageSize));
  const qs = q.toString();
  return api<PmPagedResult>(`/api/projects/${projectId}/earned-value/snapshots${qs ? `?${qs}` : ""}`);
}

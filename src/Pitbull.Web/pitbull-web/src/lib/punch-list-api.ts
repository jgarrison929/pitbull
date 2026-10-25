import api from "./api";
import type { PmEntityDto, PmActionResultDto, PmPagedResult, PmUpsertRequest } from "./pm-types";

export interface PunchListListParams {
  status?: string;
  category?: string;
  priority?: string;
  page?: number;
  pageSize?: number;
}

export async function listPunchListItems(
  projectId: string,
  params?: PunchListListParams
): Promise<PmPagedResult> {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  if (params?.category) search.set("category", params.category);
  if (params?.priority) search.set("priority", params.priority);
  search.set("page", String(params?.page ?? 1));
  search.set("pageSize", String(params?.pageSize ?? 500));
  return api<PmPagedResult>(`/api/projects/${projectId}/punch-list?${search.toString()}`);
}

export async function getPunchListItem(
  projectId: string,
  itemId: string
): Promise<PmEntityDto> {
  return api<PmEntityDto>(`/api/projects/${projectId}/punch-list/${itemId}`);
}

export async function createPunchListItem(
  projectId: string,
  request: PmUpsertRequest
): Promise<PmEntityDto> {
  return api<PmEntityDto>(`/api/projects/${projectId}/punch-list`, {
    method: "POST",
    body: request,
  });
}

export async function updatePunchListItem(
  projectId: string,
  itemId: string,
  request: PmUpsertRequest
): Promise<PmEntityDto> {
  return api<PmEntityDto>(`/api/projects/${projectId}/punch-list/${itemId}`, {
    method: "PUT",
    body: request,
  });
}

export async function deletePunchListItem(
  projectId: string,
  itemId: string
): Promise<void> {
  return api<void>(`/api/projects/${projectId}/punch-list/${itemId}`, {
    method: "DELETE",
  });
}

export async function closePunchListItem(
  projectId: string,
  itemId: string
): Promise<PmActionResultDto> {
  return api<PmActionResultDto>(`/api/projects/${projectId}/punch-list/${itemId}/close`, {
    method: "POST",
  });
}

export async function getPunchListSummary(
  projectId: string
): Promise<PmActionResultDto> {
  return api<PmActionResultDto>(`/api/projects/${projectId}/punch-list/summary`);
}

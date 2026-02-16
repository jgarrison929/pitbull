import type { PagedResult } from "@/lib/types";

export interface PmEntityDto {
  id: string;
  projectId?: string | null;
  name?: string | null;
  title?: string | null;
  status?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  data?: unknown;
}

export interface PmActionResultDto {
  success: boolean;
  message: string;
  id?: string | null;
  data?: unknown;
}

export interface PmListQuery {
  page?: number;
  pageSize?: number;
  status?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
}

export interface PmUpsertRequest {
  name?: string;
  title?: string;
  description?: string;
  status?: string;
  referenceId?: string;
  dueDate?: string;
  data?: Record<string, unknown>;
}

export type PmPagedResult = PagedResult<PmEntityDto>;

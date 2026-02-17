import api from "./api";
import type {
  PayPeriod,
  PayPeriodConfiguration,
  PayPeriodListResult,
  GeneratePayPeriodsResult,
  CreatePayPeriodRequest,
  UpdatePayPeriodRequest,
  PayPeriodSummary,
  UpdatePayPeriodConfigurationRequest,
  GeneratePayPeriodsRequest,
  PayPeriodStatus,
} from "@/types/pay-period.types";

/**
 * List pay periods with optional filtering
 */
export async function listPayPeriods(params?: {
  status?: PayPeriodStatus;
  startDateFrom?: string;
  startDateTo?: string;
  page?: number;
  pageSize?: number;
}): Promise<PayPeriodListResult> {
  const searchParams = new URLSearchParams();
  if (params?.status !== undefined) searchParams.set("status", String(params.status));
  if (params?.startDateFrom) searchParams.set("startDateFrom", params.startDateFrom);
  if (params?.startDateTo) searchParams.set("startDateTo", params.startDateTo);
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.pageSize) searchParams.set("pageSize", String(params.pageSize));

  const query = searchParams.toString();
  return api<PayPeriodListResult>(`/api/pay-periods${query ? `?${query}` : ""}`);
}

/**
 * Get the current (or specified date's) pay period
 */
export async function getCurrentPayPeriod(date?: string): Promise<PayPeriod> {
  const query = date ? `?date=${date}` : "";
  return api<PayPeriod>(`/api/pay-periods/current${query}`);
}

export async function createPayPeriod(request: CreatePayPeriodRequest): Promise<PayPeriod> {
  return api<PayPeriod>("/api/pay-periods", {
    method: "POST",
    body: request,
  });
}

export async function updatePayPeriod(id: string, request: UpdatePayPeriodRequest): Promise<PayPeriod> {
  return api<PayPeriod>(`/api/pay-periods/${id}`, {
    method: "PUT",
    body: request,
  });
}

/**
 * Lock a pay period
 */
export async function lockPayPeriod(id: string): Promise<PayPeriod> {
  return api<PayPeriod>(`/api/pay-periods/${id}/lock`, {
    method: "POST",
    body: {},
  });
}

/**
 * Unlock a pay period
 */
export async function unlockPayPeriod(id: string): Promise<PayPeriod> {
  return api<PayPeriod>(`/api/pay-periods/${id}/unlock`, {
    method: "POST",
    body: {},
  });
}

export async function closePayPeriod(id: string): Promise<PayPeriod> {
  return api<PayPeriod>(`/api/pay-periods/${id}/close`, {
    method: "POST",
    body: {},
  });
}

export async function getPayPeriodSummary(id: string): Promise<PayPeriodSummary> {
  return api<PayPeriodSummary>(`/api/pay-periods/${id}/summary`);
}

/**
 * Get the tenant's pay period configuration
 */
export async function getPayPeriodConfiguration(): Promise<PayPeriodConfiguration> {
  return api<PayPeriodConfiguration>("/api/pay-periods/configuration");
}

/**
 * Update the tenant's pay period configuration
 */
export async function updatePayPeriodConfiguration(
  request: UpdatePayPeriodConfigurationRequest
): Promise<PayPeriodConfiguration> {
  return api<PayPeriodConfiguration>("/api/pay-periods/configuration", {
    method: "PUT",
    body: request,
  });
}

/**
 * Generate pay periods based on configuration
 */
export async function generatePayPeriods(
  request?: GeneratePayPeriodsRequest
): Promise<GeneratePayPeriodsResult> {
  return api<GeneratePayPeriodsResult>("/api/pay-periods/generate", {
    method: "POST",
    body: request || {},
  });
}

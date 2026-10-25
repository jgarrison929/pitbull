import api from "@/lib/api";
import type {
  Company,
  CompanyAccessible,
  CreateCompanyCommand,
  UpdateCompanyCommand,
  CompanyUserAccess,
  GrantCompanyAccessCommand,
} from "@/lib/types";

// ============================================
// Company Switching & User-facing APIs
// ============================================

/**
 * Get the list of companies the current user can access.
 */
export async function getAccessibleCompanies(): Promise<CompanyAccessible[]> {
  return api<CompanyAccessible[]>("/api/companies/accessible");
}

/**
 * Get the currently active company details.
 */
export async function getActiveCompany(): Promise<Company> {
  return api<Company>("/api/companies/active");
}

/**
 * Switch the active company. Returns a new JWT with the updated company_id claim.
 */
export async function switchCompany(companyId: string): Promise<{ token: string }> {
  return api<{ token: string }>(`/api/companies/switch/${companyId}`, {
    method: "POST",
  });
}

// ============================================
// Admin Company Management APIs
// ============================================

/**
 * List all companies in the tenant (admin only).
 */
export async function listCompanies(): Promise<Company[]> {
  return api<Company[]>("/api/admin/companies");
}

/**
 * Get a single company by ID (admin only).
 */
export async function getCompany(id: string): Promise<Company> {
  return api<Company>(`/api/admin/companies/${id}`);
}

/**
 * Create a new company (admin only).
 */
export async function createCompany(data: CreateCompanyCommand): Promise<Company> {
  return api<Company>("/api/admin/companies", {
    method: "POST",
    body: data,
  });
}

/**
 * Update a company (admin only).
 */
export async function updateCompany(id: string, data: UpdateCompanyCommand): Promise<Company> {
  return api<Company>(`/api/admin/companies/${id}`, {
    method: "PUT",
    body: data,
  });
}

/**
 * Deactivate a company (admin only).
 */
export async function deactivateCompany(id: string): Promise<void> {
  return api<void>(`/api/admin/companies/${id}`, {
    method: "DELETE",
  });
}

// ============================================
// Admin Company User Access APIs
// ============================================

/**
 * List users with access to a company (admin only).
 */
export async function listCompanyUsers(companyId: string): Promise<CompanyUserAccess[]> {
  return api<CompanyUserAccess[]>(`/api/admin/companies/${companyId}/users`);
}

/**
 * Grant a user access to a company (admin only).
 */
export async function grantCompanyAccess(
  companyId: string,
  data: GrantCompanyAccessCommand
): Promise<void> {
  return api<void>(`/api/admin/companies/${companyId}/users`, {
    method: "POST",
    body: data,
  });
}

/**
 * Revoke a user's access to a company (admin only).
 */
export async function revokeCompanyAccess(
  companyId: string,
  userId: string
): Promise<void> {
  return api<void>(`/api/admin/companies/${companyId}/users/${userId}`, {
    method: "DELETE",
  });
}

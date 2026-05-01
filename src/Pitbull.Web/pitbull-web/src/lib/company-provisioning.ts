import api from "@/lib/api";

// ============================================
// Types
// ============================================

export interface CoaTemplateInfo {
  key: string;
  displayName: string;
  description: string;
}

export interface CompanyProvisioningRequest {
  code: string;
  name: string;
  shortName?: string;
  taxId?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  phone?: string;
  email?: string;
  website?: string;
  industryType?: string;
  currency?: string;
  timezone?: string;
  dateFormat?: string;
  fiscalYearStartMonth?: number;
  sortOrder?: number;
  coaTemplateKey?: string;
  fiscalYearStart?: string; // ISO date string
  periodsToCreate?: number;
  adminUserId?: string;
}

export interface CompanyProvisioningResult {
  companyId: string;
  companyCode: string;
  companyName: string;
  coaTemplate: string;
  accountsCreated: number;
  periodsCreated: number;
  userAccessGranted: number;
  summary: string;
}

// ============================================
// API Functions
// ============================================

/**
 * Get available chart of accounts templates.
 */
export async function getCoaTemplates(): Promise<CoaTemplateInfo[]> {
  return api<CoaTemplateInfo[]>("/api/admin/company-provisioning/templates");
}

/**
 * Provision a new company with COA template and accounting periods.
 */
export async function provisionCompany(
  data: CompanyProvisioningRequest
): Promise<CompanyProvisioningResult> {
  return api<CompanyProvisioningResult>("/api/admin/company-provisioning", {
    method: "POST",
    body: data,
  });
}

// ─── Employee Onboarding Types ─────────────────────────────
// Matches backend DTOs from Pitbull.TimeTracking.Features.EmployeeOnboarding

export enum OnboardingStatus {
  Draft = "Draft",
  InProgress = "InProgress",
  PendingApproval = "PendingApproval",
  Approved = "Approved",
  Rejected = "Rejected",
  Completed = "Completed",
}

export enum ContractorType {
  W2Employee = "W2Employee",
  Contractor1099 = "Contractor1099",
  SubContractor = "SubContractor",
  TempAgency = "TempAgency",
}

export enum W4FilingStatus {
  Single = "Single",
  MarriedFilingJointly = "MarriedFilingJointly",
  HeadOfHousehold = "HeadOfHousehold",
}

export enum I9Status {
  NotStarted = "NotStarted",
  Section1Complete = "Section1Complete",
  Section2Complete = "Section2Complete",
  Verified = "Verified",
  Reverified = "Reverified",
}

export enum CertificationVerificationStatus {
  Pending = "Pending",
  Verified = "Verified",
  Expired = "Expired",
  Rejected = "Rejected",
}

// ─── DTOs ──────────────────────────────────────────────────

export interface OnboardingSubmissionDto {
  id?: string;
  status?: OnboardingStatus;

  // Step 1 – Personal Info
  firstName: string;
  lastName: string;
  middleName?: string;
  preferredName?: string;
  email: string;
  phone: string;
  dateOfBirth?: string;
  ssn?: string;

  // Step 2 – Employment Details
  employeeNumber?: string;
  contractorType: ContractorType;
  classification: number;
  title?: string;
  department?: string;
  hireDate: string;
  startDate: string;
  supervisorId?: string;
  homeCompanyId?: string;
  baseHourlyRate: number;

  // Step 3 – Emergency Contact
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelationship: string;

  // Step 4 – Tax & Compliance
  w4FilingStatus: W4FilingStatus;
  w4AdditionalWithholding?: number;
  w4Exempt: boolean;
  i9Status: I9Status;
  i9DocumentTypeA?: string;
  i9DocumentTypeB?: string;
  i9DocumentTypeC?: string;
  i9Section1Date?: string;
  i9Section2Date?: string;
  i9VerifiedBy?: string;
  certifiedPayrollRequired: boolean;
  davisBaconApplicable: boolean;

  // Step 5 – Certifications
  certifications: OnboardingCertificationDto[];

  // Step 6 – Review (no extra fields, uses all above)

  notes?: string;
}

export interface OnboardingCertificationDto {
  certificationTypeId: string;
  certificationName: string;
  issuedDate?: string;
  expirationDate?: string;
  certificateNumber?: string;
  verificationStatus: CertificationVerificationStatus;
}

export interface OnboardingListItemDto {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: OnboardingStatus;
  contractorType: ContractorType;
  hireDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface OnboardingSettingsDto {
  enabled: boolean;
  requireApprovalWorkflow: boolean;
  autoCreateEmployeeOnSubmit: boolean;
  allowBulkImportCreate: boolean;
  defaultContractorType: ContractorType;
  requireOsha10: boolean;
  requireOsha30: boolean;
  requireEmergencyContact: boolean;
  requireTaxCompliance: boolean;
}

export interface ImportResultDto {
  totalRows: number;
  successCount: number;
  failureCount: number;
  errors: ImportRowError[];
}

export interface ImportRowError {
  row: number;
  field: string;
  message: string;
}

// ─── I-9 Federal Document Types ────────────────────────────

export type I9DocumentList = "A" | "B" | "C";

export interface I9DocumentType {
  value: string;
  label: string;
  list: I9DocumentList;
}

/**
 * Federal I-9 acceptable documents.
 * List A: Proves both identity AND work authorization (only one needed).
 * List B: Proves identity only (must combine with a List C document).
 * List C: Proves work authorization only (must combine with a List B document).
 */
export const I9_DOCUMENT_TYPES: I9DocumentType[] = [
  // List A -- Identity & Work Authorization
  { value: "USPassport", label: "U.S. Passport", list: "A" },
  { value: "USPassportCard", label: "U.S. Passport Card", list: "A" },
  { value: "PermanentResidentCard", label: "Permanent Resident Card (Form I-551)", list: "A" },
  { value: "ForeignPassportI94", label: "Foreign Passport with I-94", list: "A" },
  { value: "EAD", label: "Employment Authorization Document (EAD)", list: "A" },
  { value: "ForeignPassportI551", label: "Foreign Passport with I-551 Stamp", list: "A" },
  // List B -- Identity Only
  { value: "DriversLicense", label: "Driver's License", list: "B" },
  { value: "StateID", label: "State-Issued ID Card", list: "B" },
  { value: "SchoolID", label: "School ID with Photograph", list: "B" },
  { value: "VoterRegistration", label: "Voter Registration Card", list: "B" },
  { value: "MilitaryID", label: "U.S. Military Card", list: "B" },
  { value: "MilitaryDraft", label: "Military Draft Record", list: "B" },
  { value: "NativeAmericanTribalDoc", label: "Native American Tribal Document", list: "B" },
  { value: "CanadianDL", label: "Canadian Driver's License", list: "B" },
  // List C -- Work Authorization Only
  { value: "SSCard", label: "Social Security Card (unrestricted)", list: "C" },
  { value: "BirthCertificate", label: "U.S. Birth Certificate", list: "C" },
  { value: "BirthAbroadCert", label: "Certificate of Birth Abroad (FS-545/DS-1350)", list: "C" },
  { value: "CitizenshipCert", label: "Certificate of U.S. Citizenship (N-560/N-561)", list: "C" },
  { value: "NaturalizationCert", label: "Certificate of Naturalization (N-550/N-570)", list: "C" },
  { value: "NativeAmericanTribalDocC", label: "Native American Tribal Document (List C)", list: "C" },
  { value: "EADListC", label: "Employment Authorization (DHS)", list: "C" },
];

// ─── Certification Expiration Rules ────────────────────────

/** Certification types that never expire (awareness/training completions). */
export const CERTS_NO_EXPIRATION: ReadonlySet<string> = new Set([
  "OSHA10", "OSHA30", "AsbestosAwareness", "LeadAwareness", "SilicaAwareness",
  "SteelErection", "SWPPP",
]);

/** Certification types that require a valid expiration date (licenses/credentials). */
export const CERTS_REQUIRE_EXPIRATION: ReadonlySet<string> = new Set([
  "CDL_A", "CDL_B", "CDL_C", "WeldStructural", "WeldPipe", "WeldSpecialty",
  "CraneMobile", "CraneTower", "CraneOverhead", "FirstAid", "CPR", "AED",
  "Forklift", "AerialLift", "Hazmat40", "HazmatRefresher",
  "MSHANewMiner", "MSHARefresher", "NFPA70E",
]);

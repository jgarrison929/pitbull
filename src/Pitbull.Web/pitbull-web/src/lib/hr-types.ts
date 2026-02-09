// HR Module Types
// These types match the Pitbull.HR backend DTOs

// ============ Enums ============

/**
 * Current employment status of an employee.
 */
export enum EmploymentStatus {
  Active = 1,
  Inactive = 2,
  Terminated = 3,
  Pending = 4,
  OnCall = 5,
}

/**
 * Worker classification: Field vs Office.
 */
export enum WorkerType {
  Field = 1,
  Office = 2,
  Hybrid = 3,
}

/**
 * FLSA exempt/non-exempt classification.
 */
export enum FLSAStatus {
  NonExempt = 1,
  Exempt = 2,
}

/**
 * Full-time vs part-time classification.
 */
export enum EmploymentType {
  FullTime = 1,
  PartTime = 2,
  Seasonal = 3,
  Temporary = 4,
}

/**
 * Pay frequency for payroll processing.
 */
export enum PayFrequency {
  Weekly = 1,
  BiWeekly = 2,
  SemiMonthly = 3,
  Monthly = 4,
}

/**
 * Default pay type for the employee.
 */
export enum PayType {
  Hourly = 1,
  Salary = 2,
}

/**
 * Payment method preference.
 */
export enum PaymentMethod {
  DirectDeposit = 1,
  Check = 2,
  PayCard = 3,
}

/**
 * I-9 verification status.
 */
export enum I9Status {
  NotStarted = 0,
  Section1Complete = 1,
  Section2Complete = 2,
  Verified = 3,
  ReverificationNeeded = 4,
}

/**
 * E-Verify case status.
 */
export enum EVerifyStatus {
  NotSubmitted = 0,
  Pending = 1,
  EmploymentAuthorized = 2,
  TentativeNonconfirmation = 3,
  CaseInContinuance = 4,
  FinalNonconfirmation = 5,
  ClosedCaseInvalidated = 6,
}

/**
 * Background check status.
 */
export enum BackgroundCheckStatus {
  NotRequired = 0,
  Pending = 1,
  InProgress = 2,
  Cleared = 3,
  Failed = 4,
  ConditionalClear = 5,
}

/**
 * Drug test status.
 */
export enum DrugTestStatus {
  NotRequired = 0,
  Scheduled = 1,
  Pending = 2,
  Passed = 3,
  Failed = 4,
}

/**
 * Sort options for employee list.
 */
export enum ListEmployeesSortBy {
  LastName = 0,
  FirstName = 1,
  EmployeeNumber = 2,
  HireDate = 3,
  Status = 4,
}

// ============ DTOs ============

/**
 * Address DTO for employee addresses.
 */
export interface HRAddressDto {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  country?: string | null;
}

/**
 * Lightweight DTO for employee list views.
 */
export interface HREmployeeListDto {
  id: string;
  employeeNumber: string;
  fullName: string;
  status: EmploymentStatus;
  workerType: WorkerType;
  jobTitle?: string | null;
  tradeCode?: string | null;
  originalHireDate: string; // DateOnly -> string
  createdAt: string;
}

/**
 * Detailed DTO for single employee views.
 */
export interface HREmployeeDto {
  id: string;
  employeeNumber: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  preferredName?: string | null;
  suffix?: string | null;
  fullName: string;
  dateOfBirth: string; // DateOnly -> string
  ssnLast4: string;
  email?: string | null;
  personalEmail?: string | null;
  phone?: string | null;
  secondaryPhone?: string | null;
  address?: HRAddressDto | null;
  status: EmploymentStatus;
  originalHireDate: string;
  mostRecentHireDate: string;
  terminationDate?: string | null;
  eligibleForRehire: boolean;
  workerType: WorkerType;
  flsaStatus: FLSAStatus;
  employmentType: EmploymentType;
  jobTitle?: string | null;
  tradeCode?: string | null;
  workersCompClassCode?: string | null;
  departmentId?: string | null;
  supervisorId?: string | null;
  homeState?: string | null;
  suiState?: string | null;
  payFrequency: PayFrequency;
  defaultPayType: PayType;
  defaultHourlyRate?: number | null;
  paymentMethod: PaymentMethod;
  isUnionMember: boolean;
  i9Status: I9Status;
  eVerifyStatus?: EVerifyStatus | null;
  backgroundCheckStatus?: BackgroundCheckStatus | null;
  drugTestStatus?: DrugTestStatus | null;
  appUserId?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

/**
 * Command to create a new employee.
 */
export interface CreateHREmployeeCommand {
  // Identity (required)
  employeeNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  ssnEncrypted: string;
  ssnLast4: string;
  
  // Identity (optional)
  middleName?: string;
  preferredName?: string;
  suffix?: string;
  
  // Contact
  email?: string;
  personalEmail?: string;
  phone?: string;
  secondaryPhone?: string;
  
  // Address
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  
  // Employment
  hireDate?: string;
  workerType?: WorkerType;
  flsaStatus?: FLSAStatus;
  employmentType?: EmploymentType;
  
  // Classification
  jobTitle?: string;
  tradeCode?: string;
  workersCompClassCode?: string;
  departmentId?: string;
  supervisorId?: string;
  
  // Tax
  homeState?: string;
  suiState?: string;
  
  // Payroll
  payFrequency?: PayFrequency;
  defaultPayType?: PayType;
  defaultHourlyRate?: number;
  paymentMethod?: PaymentMethod;
  
  // Union
  isUnionMember?: boolean;
  
  // Notes
  notes?: string;
}

/**
 * Command to update an existing employee.
 */
export interface UpdateHREmployeeCommand {
  id: string;
  
  // Identity
  firstName: string;
  lastName: string;
  middleName?: string;
  preferredName?: string;
  suffix?: string;
  
  // Contact
  email?: string;
  personalEmail?: string;
  phone?: string;
  secondaryPhone?: string;
  
  // Address
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  
  // Classification
  workerType?: WorkerType;
  flsaStatus?: FLSAStatus;
  employmentType?: EmploymentType;
  jobTitle?: string;
  tradeCode?: string;
  workersCompClassCode?: string;
  departmentId?: string;
  supervisorId?: string;
  
  // Tax
  homeState?: string;
  suiState?: string;
  
  // Payroll
  payFrequency?: PayFrequency;
  defaultPayType?: PayType;
  defaultHourlyRate?: number;
  paymentMethod?: PaymentMethod;
  
  // Union
  isUnionMember?: boolean;
  
  // Notes
  notes?: string;
}

/**
 * Paginated result for HR employees list.
 */
export interface HREmployeeListResult {
  items: HREmployeeListDto[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

// ============ Display Helpers ============

export const employmentStatusLabels: Record<EmploymentStatus, string> = {
  [EmploymentStatus.Active]: "Active",
  [EmploymentStatus.Inactive]: "Inactive",
  [EmploymentStatus.Terminated]: "Terminated",
  [EmploymentStatus.Pending]: "Pending",
  [EmploymentStatus.OnCall]: "On Call",
};

export const employmentStatusColors: Record<EmploymentStatus, string> = {
  [EmploymentStatus.Active]: "bg-green-100 text-green-800",
  [EmploymentStatus.Inactive]: "bg-yellow-100 text-yellow-800",
  [EmploymentStatus.Terminated]: "bg-red-100 text-red-800",
  [EmploymentStatus.Pending]: "bg-blue-100 text-blue-800",
  [EmploymentStatus.OnCall]: "bg-purple-100 text-purple-800",
};

export const workerTypeLabels: Record<WorkerType, string> = {
  [WorkerType.Field]: "Field",
  [WorkerType.Office]: "Office",
  [WorkerType.Hybrid]: "Hybrid",
};

export const workerTypeColors: Record<WorkerType, string> = {
  [WorkerType.Field]: "bg-orange-100 text-orange-800",
  [WorkerType.Office]: "bg-blue-100 text-blue-800",
  [WorkerType.Hybrid]: "bg-indigo-100 text-indigo-800",
};

export const flsaStatusLabels: Record<FLSAStatus, string> = {
  [FLSAStatus.NonExempt]: "Non-Exempt",
  [FLSAStatus.Exempt]: "Exempt",
};

export const employmentTypeLabels: Record<EmploymentType, string> = {
  [EmploymentType.FullTime]: "Full-Time",
  [EmploymentType.PartTime]: "Part-Time",
  [EmploymentType.Seasonal]: "Seasonal",
  [EmploymentType.Temporary]: "Temporary",
};

export const payFrequencyLabels: Record<PayFrequency, string> = {
  [PayFrequency.Weekly]: "Weekly",
  [PayFrequency.BiWeekly]: "Bi-Weekly",
  [PayFrequency.SemiMonthly]: "Semi-Monthly",
  [PayFrequency.Monthly]: "Monthly",
};

export const payTypeLabels: Record<PayType, string> = {
  [PayType.Hourly]: "Hourly",
  [PayType.Salary]: "Salary",
};

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  [PaymentMethod.DirectDeposit]: "Direct Deposit",
  [PaymentMethod.Check]: "Check",
  [PaymentMethod.PayCard]: "Pay Card",
};

export const i9StatusLabels: Record<I9Status, string> = {
  [I9Status.NotStarted]: "Not Started",
  [I9Status.Section1Complete]: "Section 1 Complete",
  [I9Status.Section2Complete]: "Section 2 Complete",
  [I9Status.Verified]: "Verified",
  [I9Status.ReverificationNeeded]: "Reverification Needed",
};

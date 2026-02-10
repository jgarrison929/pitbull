// NOTE: API serializes enums as numbers (System.Text.Json default).
// Keep these as numeric enums to match the backend.
export enum ProjectStatus {
  Bidding = 0,
  PreConstruction = 1,
  Active = 2,
  Completed = 3,
  Closed = 4,
  OnHold = 5,
}

export enum ProjectType {
  Commercial = 0,
  Residential = 1,
  Industrial = 2,
  Infrastructure = 3,
  Renovation = 4,
  TenantImprovement = 5,
  Other = 6,
}

export type BidStatus =
  | "Draft"
  | "InProgress"
  | "Submitted"
  | "Won"
  | "Lost"
  | "NoDecision"
  | "Withdrawn";

export type BidItemCategory =
  | "General"
  | "Sitework"
  | "Concrete"
  | "Masonry"
  | "Metals"
  | "WoodPlastics"
  | "ThermalMoisture"
  | "DoorsWindows"
  | "Finishes"
  | "Specialties"
  | "Equipment"
  | "Furnishings"
  | "SpecialConstruction"
  | "Conveying"
  | "Mechanical"
  | "Electrical"
  | "Other";

export interface Project {
  id: string;
  name: string;
  number: string;
  description?: string | null;
  status: ProjectStatus;
  type: ProjectType;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  clientName?: string | null;
  clientContact?: string | null;
  clientEmail?: string | null;
  clientPhone?: string | null;
  startDate?: string | null;
  estimatedCompletionDate?: string | null;
  actualCompletionDate?: string | null;
  contractAmount: number;
  projectManagerId?: string | null;
  superintendentId?: string | null;
  sourceBidId?: string | null;
  createdAt: string;
}

export interface Bid {
  id: string;
  bidNumber: string;
  name: string;
  description: string;
  status: BidStatus;
  clientName: string;
  estimatedValue: number;
  bidDate: string | null;
  dueDate: string | null;
  notes: string;
  bidItems: BidItem[];
}

export interface BidItem {
  id: string;
  description: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  category: BidItemCategory;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface CreateProjectCommand {
  name: string;
  number: string;
  description?: string;
  type: ProjectType;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  clientName?: string;
  clientContact?: string;
  clientEmail?: string;
  clientPhone?: string;
  startDate?: string;
  estimatedCompletionDate?: string;
  contractAmount: number;
  projectManagerId?: string;
  superintendentId?: string;
  sourceBidId?: string;
}

export interface UpdateProjectCommand {
  id: string;
  name: string;
  number: string;
  description?: string;
  status: ProjectStatus;
  type: ProjectType;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  clientName?: string;
  clientContact?: string;
  clientEmail?: string;
  clientPhone?: string;
  startDate?: string;
  estimatedCompletionDate?: string;
  actualCompletionDate?: string;
  contractAmount: number;
  projectManagerId?: string;
  superintendentId?: string;
}

export interface CreateBidCommand {
  bidNumber: string;
  name: string;
  description?: string;
  status: BidStatus;
  clientName?: string;
  estimatedValue?: number;
  bidDate?: string;
  dueDate?: string;
  notes?: string;
}

export interface UpdateBidCommand {
  name?: string;
  description?: string;
  status?: BidStatus;
  clientName?: string;
  estimatedValue?: number;
  bidDate?: string;
  dueDate?: string;
  notes?: string;
}

export interface DashboardStats {
  projectCount: number;
  bidCount: number;
  totalProjectValue: number;
  totalBidValue: number;
  pendingChangeOrders: number;
  lastActivityDate: string;
  employeeCount: number;
  pendingTimeApprovals: number;
  recentActivity: RecentActivityItem[];
}

export interface RecentActivityItem {
  id: string;
  type: "project" | "bid" | "employee" | "timeentry";
  title: string;
  description: string;
  timestamp: string;
  icon?: string;
}

// Time Tracking Types
export enum TimeEntryStatus {
  Submitted = 0,
  Approved = 1,
  Rejected = 2,
  Draft = 3,
}

export enum EmployeeClassification {
  Hourly = 0,
  Salaried = 1,
  Contractor = 2,
  Apprentice = 3,
  Supervisor = 4,
}

export interface Employee {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  title?: string | null;
  classification: EmployeeClassification;
  baseHourlyRate: number;
  isActive: boolean;
  hireDate?: string | null;
  terminationDate?: string | null;
  supervisorId?: string | null;
  supervisorName?: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

export interface TimeEntry {
  id: string;
  date: string;
  employeeId: string;
  employeeName: string;
  projectId: string;
  projectName: string;
  projectNumber: string;
  costCodeId: string;
  costCodeDescription: string;
  regularHours: number;
  overtimeHours: number;
  doubletimeHours: number;
  totalHours: number;
  description?: string | null;
  status: TimeEntryStatus;
  approvedById?: string | null;
  approvedByName?: string | null;
  approvedAt?: string | null;
  approvalComments?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

export interface CostCode {
  id: string;
  code: string;
  description: string;
  division?: string | null;
  costType: CostType;
  isActive: boolean;
}

export enum CostType {
  Labor = 1,
  Material = 2,
  Equipment = 3,
  Subcontract = 4,
  Other = 5,
}

export interface CreateTimeEntryCommand {
  date: string;
  employeeId: string;
  projectId: string;
  costCodeId: string;
  regularHours: number;
  overtimeHours?: number;
  doubletimeHours?: number;
  description?: string;
}

export interface ListEmployeesResult {
  items: Employee[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ListTimeEntriesResult {
  items: TimeEntry[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CreateEmployeeCommand {
  firstName: string;
  lastName: string;
  employeeNumber?: string;  // Optional - auto-generated if not provided
  email?: string;
  phone?: string;
  title?: string;
  classification: EmployeeClassification;
  baseHourlyRate?: number;
  hireDate?: string;
  supervisorId?: string;
  notes?: string;
}

// Project Assignment Types
export interface ProjectAssignment {
  id: string;
  employeeId: string;
  employeeName: string;
  projectId: string;
  projectName: string;
  projectNumber: string;
  role: string;
  startDate: string;
  endDate?: string | null;
  isActive: boolean;
  hoursPerWeek?: number | null;
  notes?: string | null;
}

export interface UpdateEmployeeCommand {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  title?: string;
  classification: EmployeeClassification;
  baseHourlyRate?: number;
  hireDate?: string;
  terminationDate?: string;
  supervisorId?: string;
  isActive?: boolean;
  notes?: string;
}

// User Management Types
export interface AppUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  status: string;
  type: string;
  roles: string[];
  createdAt: string;
  lastLoginAt?: string | null;
}

export interface ListUsersResult {
  items: AppUser[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface RoleInfo {
  name: string;
  description: string;
}

// System Roles
export const SystemRoles = {
  Admin: "Admin",
  Manager: "Manager",
  Supervisor: "Supervisor",
  User: "User",
} as const;

export type SystemRole = (typeof SystemRoles)[keyof typeof SystemRoles];

// ============================================
// Admin API Types
// ============================================

// Admin User Management
export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  status: UserStatus;
  roles: string[];
  createdAt: string;
  lastLoginAt: string | null;
}

export type UserStatus = "Active" | "Inactive" | "Locked" | "Invited";

export interface AdminListUsersResult {
  items: AdminUser[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface AdminUpdateUserCommand {
  firstName?: string;
  lastName?: string;
  roles?: string[];
  status?: UserStatus;
}

// Audit Logs
export interface AuditLog {
  id: string;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  description: string;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  timestamp: string;
}

export interface AuditLogListResult {
  items: AuditLog[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface AuditLogFilters {
  userId?: string;
  action?: string;
  resourceType?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

// Company Settings
export interface CompanySettings {
  id: string;
  name: string;
  legalName: string | null;
  taxId: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  logoUrl: string | null;
  defaultRetainagePercent: number;
  fiscalYearStartMonth: number;
  timeZone: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface UpdateCompanySettingsCommand {
  name?: string;
  legalName?: string | null;
  taxId?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  defaultRetainagePercent?: number;
  fiscalYearStartMonth?: number;
  timeZone?: string | null;
}

// AI Insights Types
export interface AiProjectSummary {
  success: boolean;
  error?: string | null;
  summary?: string | null;
  healthScore: number;
  healthStatus?: string | null;
  highlights: string[];
  concerns: string[];
  recommendations: string[];
  metrics?: ProjectMetrics | null;
  generatedAt: string;
}

export interface ProjectMetrics {
  totalHoursLogged: number;
  totalLaborCost: number;
  totalTimeEntries: number;
  pendingApprovals: number;
  assignedEmployees: number;
  daysUntilDeadline: number;
  budgetUtilization?: number | null;
  dailyAverageHours?: number | null;
}

// Contracts Module Types
export enum SubcontractStatus {
  Draft = 0,
  PendingApproval = 1,
  Issued = 2,
  Executed = 3,
  InProgress = 4,
  Complete = 5,
  ClosedOut = 6,
  Terminated = 7,
  OnHold = 8,
}

export enum ChangeOrderStatus {
  Pending = 0,
  UnderReview = 1,
  Approved = 2,
  Rejected = 3,
  Withdrawn = 4,
  Void = 5,
}

export enum PaymentApplicationStatus {
  Draft = 0,
  Submitted = 1,
  UnderReview = 2,
  Approved = 3,
  PartiallyApproved = 4,
  Rejected = 5,
  Paid = 6,
  Void = 7,
}

export interface Subcontract {
  id: string;
  projectId: string;
  projectName?: string | null;
  projectNumber?: string | null;
  subcontractNumber: string;
  subcontractorName: string;
  subcontractorContact?: string | null;
  subcontractorEmail?: string | null;
  subcontractorPhone?: string | null;
  subcontractorAddress?: string | null;
  scopeOfWork: string;
  tradeCode?: string | null;
  originalValue: number;
  currentValue: number;
  billedToDate: number;
  paidToDate: number;
  retainagePercent: number;
  retainageHeld: number;
  executionDate?: string | null;
  startDate?: string | null;
  completionDate?: string | null;
  actualCompletionDate?: string | null;
  status: SubcontractStatus;
  insuranceExpirationDate?: string | null;
  insuranceCurrent: boolean;
  licenseNumber?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

export interface ChangeOrder {
  id: string;
  subcontractId: string;
  subcontractNumber?: string | null;
  subcontractorName?: string | null;
  changeOrderNumber: string;
  title: string;
  description: string;
  reason?: string | null;
  amount: number;
  daysExtension?: number | null;
  status: ChangeOrderStatus;
  submittedDate?: string | null;
  approvedDate?: string | null;
  rejectedDate?: string | null;
  approvedBy?: string | null;
  rejectedBy?: string | null;
  rejectionReason?: string | null;
  referenceNumber?: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

export interface PaymentApplication {
  id: string;
  subcontractId: string;
  subcontractNumber?: string | null;
  subcontractorName?: string | null;
  applicationNumber: number;
  periodStart: string;
  periodEnd: string;
  scheduledValue: number;
  workCompletedPrevious: number;
  workCompletedThisPeriod: number;
  workCompletedToDate: number;
  storedMaterials: number;
  totalCompletedAndStored: number;
  retainagePercent: number;
  retainageThisPeriod: number;
  retainagePrevious: number;
  totalRetainage: number;
  totalEarnedLessRetainage: number;
  lessPreviousCertificates: number;
  currentPaymentDue: number;
  status: PaymentApplicationStatus;
  submittedDate?: string | null;
  reviewedDate?: string | null;
  approvedDate?: string | null;
  paidDate?: string | null;
  approvedBy?: string | null;
  approvedAmount?: number | null;
  invoiceNumber?: string | null;
  checkNumber?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

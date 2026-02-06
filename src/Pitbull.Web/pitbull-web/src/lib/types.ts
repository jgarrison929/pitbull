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
  employeeNumber: string;
  firstName: string;
  lastName: string;
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

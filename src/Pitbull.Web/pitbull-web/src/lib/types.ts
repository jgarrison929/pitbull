// Frontend types aligned with the ASP.NET Core API contract.
// NOTE: The API uses System.Text.Json default enum handling (numeric enums).

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
  description: string | null;
  status: ProjectStatus;
  type: ProjectType;

  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;

  clientName: string | null;
  clientContact: string | null;
  clientEmail: string | null;
  clientPhone: string | null;

  startDate: string | null;
  estimatedCompletionDate: string | null;
  actualCompletionDate: string | null;

  contractAmount: number;

  projectManagerId: string | null;
  superintendentId: string | null;
  sourceBidId: string | null;

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

// Matches src/Modules/Pitbull.Projects/Features/CreateProject/CreateProjectCommand.cs
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
  // Not yet aligned to an API contract (backend UpdateProject feature may differ).
  // Kept for existing UI usage.
  name?: string;
  description?: string;
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

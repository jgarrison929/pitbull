export type ProjectStatus =
  | "Preconstruction"
  | "Active"
  | "OnHold"
  | "Complete"
  | "Closed";

export type ProjectType =
  | "NewConstruction"
  | "Renovation"
  | "TenantImprovement"
  | "Restoration"
  | "Infrastructure"
  | "Other";

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
  projectNumber: string;
  name: string;
  description: string;
  status: ProjectStatus;
  type: ProjectType;
  address: string;
  clientName: string;
  estimatedValue: number;
  startDate: string | null;
  endDate: string | null;
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

export interface PaginatedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CreateProjectCommand {
  projectNumber: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  type: ProjectType;
  address?: string;
  clientName?: string;
  estimatedValue?: number;
  startDate?: string;
  endDate?: string;
}

export interface UpdateProjectCommand {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  type?: ProjectType;
  address?: string;
  clientName?: string;
  estimatedValue?: number;
  startDate?: string;
  endDate?: string;
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

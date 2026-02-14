// Types for the Crew Batch Entry feature

import { CostCode } from "@/lib/types";

// API Response Types
export interface MyCrewResult {
  supervisorId: string;
  supervisorName: string;
  crewCount: number;
  crewMembers: CrewMemberDto[];
}

export interface CrewMemberDto {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  fullName: string;
  title: string | null;
  classification: number;
  baseHourlyRate: number;
  isActive: boolean;
  assignedProjects: CrewMemberProjectDto[];
}

export interface CrewMemberProjectDto {
  projectId: string;
  projectNumber: string;
  projectName: string;
  isActive: boolean;
}

export interface YesterdayCrewEntriesResult {
  entriesDate: string;
  employeeCount: number;
  entryCount: number;
  totalHours: number;
  employeeEntries: YesterdayCrewEmployeeEntries[];
}

export interface YesterdayCrewEmployeeEntries {
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  entries: YesterdayTimeEntryDto[];
}

export interface YesterdayTimeEntryDto {
  projectId: string;
  projectName: string;
  projectNumber: string;
  costCodeId: string;
  costCodeCode: string;
  costCodeDescription: string;
  regularHours: number;
  overtimeHours: number;
  doubletimeHours: number;
  totalHours: number;
  description: string | null;
}

// Batch Create Types
export interface BatchCreateTimeEntriesRequest {
  entries: BatchTimeEntryItemRequest[];
  allowPartialSuccess?: boolean;
}

export interface BatchTimeEntryItemRequest {
  date: string;
  employeeId: string;
  projectId: string;
  costCodeId: string;
  regularHours: number;
  overtimeHours?: number;
  doubletimeHours?: number;
  description?: string;
}

export interface BatchCreateTimeEntriesResult {
  totalSubmitted: number;
  successCount: number;
  failureCount: number;
  results: BatchEntryResult[];
}

export interface BatchEntryResult {
  index: number;
  timeEntryId: string | null;
  employeeId: string;
  employeeName: string;
  success: boolean;
  error: string | null;
  errorCode: string | null;
}

// Form State Types
export interface CrewEntryFormData {
  date: string;
  projectId: string;
  entries: CrewMemberEntryData[];
}

export interface CrewMemberEntryData {
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  costCodeId: string;
  regularHours: string;
  overtimeHours: string;
  doubletimeHours: string;
  description: string;
  error?: string;
  isValid?: boolean;
}

export interface CrewEntryValidationErrors {
  date?: string;
  projectId?: string;
  global?: string;
}

// Hook Return Types
export interface UseCrewEntryDataReturn {
  crew: CrewMemberDto[];
  projects: CrewMemberProjectDto[];
  costCodes: CostCode[];
  isLoading: boolean;
  error: string | null;
  supervisorId: string | null;
  loadCrew: (supervisorId: string) => Promise<void>;
}

export interface UseCrewEntryFormReturn {
  formData: CrewEntryFormData;
  errors: CrewEntryValidationErrors;
  isSubmitting: boolean;
  isDirty: boolean;
  updateDate: (date: string) => void;
  updateProject: (projectId: string) => void;
  updateEntry: (employeeId: string, field: keyof CrewMemberEntryData, value: string) => void;
  copyYesterday: () => Promise<void>;
  submit: () => Promise<BatchCreateTimeEntriesResult | null>;
  reset: () => void;
  getTotalHours: () => number;
  getEntryCount: () => number;
}

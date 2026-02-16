// Types for the Crew Batch Entry feature

import { CostCode, Equipment } from "@/lib/types";

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
  isDraft?: boolean;
  submittedById?: string;
}

export interface BatchTimeEntryItemRequest {
  timeEntryId?: string;
  date: string;
  employeeId: string;
  projectId: string;
  costCodeId?: string;
  regularHours: number;
  overtimeHours?: number;
  doubletimeHours?: number;
  description?: string;
  phaseId?: string;
  equipmentId?: string;
  equipmentHours?: number;
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

// Bulk Submit Types
export interface BulkSubmitTimeEntriesRequest {
  timeEntryIds: string[];
  submittedById: string;
}

export interface BulkSubmitTimeEntriesResult {
  totalRequested: number;
  successCount: number;
  failureCount: number;
  results: BulkSubmitEntryResult[];
}

export interface BulkSubmitEntryResult {
  timeEntryId: string;
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
  timeEntryId?: string;
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  costCodeId: string;
  phaseId: string;
  equipmentId: string;
  equipmentHours: string;
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

// ============================================
// Weekly Mode Types
// ============================================

/** Days of the week for weekly grid columns */
export type DayOfWeek = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export const DAYS_OF_WEEK: DayOfWeek[] = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
];

export const DAY_LABELS: Record<DayOfWeek, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

/** Weekly detailed mode: hours per day for one employee */
export interface WeeklyDayHours {
  mon: string;
  tue: string;
  wed: string;
  thu: string;
  fri: string;
  sat: string;
  sun: string;
}

/** One row in the weekly detailed grid */
export interface WeeklyDetailedEntryData {
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  costCodeId: string;
  phaseId: string;
  equipmentId: string;
  equipmentHours: string;
  dailyHours: WeeklyDayHours;
  description: string;
  error?: string;
  isValid?: boolean;
}

/** One row in the weekly simple grid (Reg/OT/DT totals only) */
export interface WeeklySimpleEntryData {
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  costCodeId: string;
  phaseId: string;
  equipmentId: string;
  equipmentHours: string;
  regularHours: string;
  overtimeHours: string;
  doubletimeHours: string;
  description: string;
  error?: string;
  isValid?: boolean;
}

/** Form data for the weekly detailed mode */
export interface WeeklyDetailedFormData {
  weekEndingDate: string;
  projectId: string;
  entries: WeeklyDetailedEntryData[];
}

/** Form data for the weekly simple mode */
export interface WeeklySimpleFormData {
  weekEndingDate: string;
  projectId: string;
  entries: WeeklySimpleEntryData[];
}

// Hook Return Types
export interface UseCrewEntryDataReturn {
  crew: CrewMemberDto[];
  projects: CrewMemberProjectDto[];
  costCodes: CostCode[];
  equipmentList: Equipment[];
  isLoading: boolean;
  error: string | null;
  supervisorId: string | null;
  loadCrew: (supervisorId?: string) => Promise<void>;
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
  saveDraft: () => Promise<BatchCreateTimeEntriesResult | null>;
  loadDrafts: (entries: Array<{
    timeEntryId?: string;
    employeeId: string;
    regularHours: number;
    overtimeHours: number;
    doubletimeHours: number;
    costCodeId: string;
    description: string | null;
    phaseId: string | null;
    equipmentId: string | null;
    equipmentHours: number;
  }>) => void;
  reset: () => void;
  getTotalHours: () => number;
  getEntryCount: () => number;
}

export interface UseWeeklyDetailedFormReturn {
  formData: WeeklyDetailedFormData;
  errors: CrewEntryValidationErrors;
  isSubmitting: boolean;
  isDirty: boolean;
  updateWeekEndingDate: (date: string) => void;
  updateProject: (projectId: string) => void;
  updateDayHours: (employeeId: string, day: DayOfWeek, value: string) => void;
  updateEntryField: (employeeId: string, field: string, value: string) => void;
  copyLastWeek: () => Promise<void>;
  submit: () => Promise<BatchCreateTimeEntriesResult | null>;
  saveDraft: () => Promise<BatchCreateTimeEntriesResult | null>;
  reset: () => void;
  getTotalHours: () => number;
  getEntryCount: () => number;
  getEmployeeDayTotal: (employeeId: string) => number;
  getEmployeeWeekTotal: (employeeId: string) => number;
  getDayColumnTotal: (day: DayOfWeek) => number;
  getGrandTotal: () => number;
}

export interface UseWeeklySimpleFormReturn {
  formData: WeeklySimpleFormData;
  errors: CrewEntryValidationErrors;
  isSubmitting: boolean;
  isDirty: boolean;
  updateWeekEndingDate: (date: string) => void;
  updateProject: (projectId: string) => void;
  updateEntry: (employeeId: string, field: keyof WeeklySimpleEntryData, value: string) => void;
  copyLastWeek: () => Promise<void>;
  submit: () => Promise<BatchCreateTimeEntriesResult | null>;
  saveDraft: () => Promise<BatchCreateTimeEntriesResult | null>;
  reset: () => void;
  getTotalHours: () => number;
  getEntryCount: () => number;
}

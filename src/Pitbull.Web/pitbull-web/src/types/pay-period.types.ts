// Pay Period Types

export enum PayPeriodStatus {
  Open = 0,
  Locked = 1,
  Closed = 2,
}

export enum PayPeriodType {
  Weekly = 0,
  BiWeekly = 1,
  SemiMonthly = 2,
  Monthly = 3,
}

export interface PayPeriod {
  id: string;
  tenantId?: string;
  startDate: string;
  endDate: string;
  status: PayPeriodStatus;
  name: string;
  statusName: string;
  isLocked: boolean;
  lockedAt?: string | null;
  lockedById?: string | null;
  lockedByName?: string | null;
  payrollExportMarkedAt?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  label: string;
  dayCount: number;
}

export interface PayPeriodConfiguration {
  id: string;
  type: PayPeriodType;
  typeName: string;
  weekStartDay: number;
  weekStartDayName: string;
  semiMonthlyFirstDay: number;
  semiMonthlySecondDay: number;
  autoLockEnabled: boolean;
  autoLockDaysAfterEnd: number;
  periodsToGenerateAhead: number;
  biWeeklyReferenceDate?: string | null;
  enforcementEnabled: boolean;
}

export interface PayPeriodListResult {
  items: PayPeriod[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface GeneratePayPeriodsResult {
  periodsCreated: number;
  periodsSkipped: number;
  createdPeriods: PayPeriod[];
}

// Request types
export interface CreatePayPeriodRequest {
  startDate: string;
  endDate: string;
}

export interface UpdatePayPeriodRequest {
  startDate: string;
  endDate: string;
}

export interface PayPeriodStatusBreakdown {
  status: number;
  entryCount: number;
  totalHours: number;
}

export interface PayPeriodSummary {
  payPeriodId: string;
  payPeriodName: string;
  startDate: string;
  endDate: string;
  totalHours: number;
  employeeCount: number;
  entryCount: number;
  byStatus: PayPeriodStatusBreakdown[];
}

export interface UpdatePayPeriodConfigurationRequest {
  type: PayPeriodType;
  weekStartDay: number;
  semiMonthlyFirstDay: number;
  semiMonthlySecondDay: number;
  autoLockEnabled: boolean;
  autoLockDaysAfterEnd: number;
  periodsToGenerateAhead: number;
  biWeeklyReferenceDate?: string | null;
  enforcementEnabled: boolean;
}

export interface GeneratePayPeriodsRequest {
  fromDate?: string | null;
  periodsToGenerate?: number | null;
}

// Helper functions
export function getStatusColor(status: PayPeriodStatus): string {
  switch (status) {
    case PayPeriodStatus.Open:
      return "bg-green-100 text-green-800";
    case PayPeriodStatus.Locked:
      return "bg-amber-100 text-amber-800";
    case PayPeriodStatus.Closed:
      return "bg-gray-200 text-gray-700";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export function getStatusLabel(status: PayPeriodStatus): string {
  switch (status) {
    case PayPeriodStatus.Open:
      return "Open";
    case PayPeriodStatus.Locked:
      return "Locked";
    case PayPeriodStatus.Closed:
      return "Closed";
    default:
      return "Unknown";
  }
}

export function getPeriodTypeLabel(type: PayPeriodType): string {
  switch (type) {
    case PayPeriodType.Weekly:
      return "Weekly";
    case PayPeriodType.BiWeekly:
      return "Bi-Weekly";
    case PayPeriodType.SemiMonthly:
      return "Semi-Monthly";
    case PayPeriodType.Monthly:
      return "Monthly";
    default:
      return "Unknown";
  }
}

export function getDayOfWeekLabel(day: number): string {
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  return days[day] || "Unknown";
}

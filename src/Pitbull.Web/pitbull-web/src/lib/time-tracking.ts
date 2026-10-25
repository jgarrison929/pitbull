import { TimeEntryStatus, EmployeeClassification } from "@/lib/types";

export function timeEntryStatusLabel(status: TimeEntryStatus): string {
  switch (status) {
    case TimeEntryStatus.Draft:
      return "Draft";
    case TimeEntryStatus.Submitted:
      return "Submitted";
    case TimeEntryStatus.Approved:
      return "Approved";
    case TimeEntryStatus.Rejected:
      return "Rejected";
    default:
      return "Unknown";
  }
}

export function timeEntryStatusBadgeClass(status: TimeEntryStatus): string {
  switch (status) {
    case TimeEntryStatus.Draft:
      return "bg-neutral-100 text-neutral-600 hover:bg-neutral-100";
    case TimeEntryStatus.Submitted:
      return "bg-blue-100 text-blue-700 hover:bg-blue-100";
    case TimeEntryStatus.Approved:
      return "bg-green-100 text-green-700 hover:bg-green-100";
    case TimeEntryStatus.Rejected:
      return "bg-red-100 text-red-700 hover:bg-red-100";
    default:
      return "";
  }
}

export function employeeClassificationLabel(
  classification: EmployeeClassification
): string {
  switch (classification) {
    case EmployeeClassification.Hourly:
      return "Hourly";
    case EmployeeClassification.Salaried:
      return "Salaried";
    case EmployeeClassification.Contractor:
      return "Contractor";
    case EmployeeClassification.Apprentice:
      return "Apprentice";
    case EmployeeClassification.Supervisor:
      return "Supervisor";
    default:
      return "Unknown";
  }
}

export function formatHours(hours: number): string {
  return hours.toFixed(1);
}

export function formatDate(dateString: string): string {
  // Handle both "2026-02-05" and ISO date strings
  const date = new Date(dateString + (dateString.includes("T") ? "" : "T00:00:00"));
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function getTodayISO(): string {
  const today = new Date();
  return today.toISOString().split("T")[0]!;
}

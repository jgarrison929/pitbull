import { ProjectStatus, ProjectType } from "@/lib/types";

export function projectStatusLabel(status: ProjectStatus): string {
  switch (status) {
    case ProjectStatus.Bidding:
      return "Bidding";
    case ProjectStatus.PreConstruction:
      return "Pre-Construction";
    case ProjectStatus.Active:
      return "Active";
    case ProjectStatus.Completed:
      return "Completed";
    case ProjectStatus.Closed:
      return "Closed";
    case ProjectStatus.OnHold:
      return "On Hold";
    default:
      return "Unknown";
  }
}

export function projectStatusBadgeClass(status: ProjectStatus): string {
  switch (status) {
    case ProjectStatus.Active:
      return "bg-green-100 text-green-700 hover:bg-green-100";
    case ProjectStatus.OnHold:
      return "bg-yellow-100 text-yellow-700 hover:bg-yellow-100";
    case ProjectStatus.PreConstruction:
      return "bg-blue-100 text-blue-700 hover:bg-blue-100";
    case ProjectStatus.Bidding:
      return "bg-purple-100 text-purple-700 hover:bg-purple-100";
    case ProjectStatus.Completed:
      return "bg-neutral-100 text-neutral-600 hover:bg-neutral-100";
    case ProjectStatus.Closed:
      return "bg-neutral-200 text-neutral-500 hover:bg-neutral-200";
    default:
      return "";
  }
}

export function projectTypeLabel(type: ProjectType): string {
  switch (type) {
    case ProjectType.Commercial:
      return "Commercial";
    case ProjectType.Residential:
      return "Residential";
    case ProjectType.Industrial:
      return "Industrial";
    case ProjectType.Infrastructure:
      return "Infrastructure";
    case ProjectType.Renovation:
      return "Renovation";
    case ProjectType.TenantImprovement:
      return "Tenant Improvement";
    case ProjectType.Other:
      return "Other";
    default:
      return "Unknown";
  }
}

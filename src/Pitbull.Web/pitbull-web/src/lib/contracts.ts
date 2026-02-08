import {
  SubcontractStatus,
  ChangeOrderStatus,
  PaymentApplicationStatus,
} from "@/lib/types";

// Subcontract Status helpers
export function subcontractStatusLabel(status: SubcontractStatus): string {
  switch (status) {
    case SubcontractStatus.Draft:
      return "Draft";
    case SubcontractStatus.PendingApproval:
      return "Pending Approval";
    case SubcontractStatus.Issued:
      return "Issued";
    case SubcontractStatus.Executed:
      return "Executed";
    case SubcontractStatus.InProgress:
      return "In Progress";
    case SubcontractStatus.Complete:
      return "Complete";
    case SubcontractStatus.ClosedOut:
      return "Closed Out";
    case SubcontractStatus.Terminated:
      return "Terminated";
    case SubcontractStatus.OnHold:
      return "On Hold";
    default:
      return "Unknown";
  }
}

export function subcontractStatusBadgeClass(status: SubcontractStatus): string {
  switch (status) {
    case SubcontractStatus.Draft:
      return "bg-neutral-100 text-neutral-600 hover:bg-neutral-100";
    case SubcontractStatus.PendingApproval:
      return "bg-yellow-100 text-yellow-700 hover:bg-yellow-100";
    case SubcontractStatus.Issued:
      return "bg-blue-100 text-blue-700 hover:bg-blue-100";
    case SubcontractStatus.Executed:
      return "bg-purple-100 text-purple-700 hover:bg-purple-100";
    case SubcontractStatus.InProgress:
      return "bg-green-100 text-green-700 hover:bg-green-100";
    case SubcontractStatus.Complete:
      return "bg-teal-100 text-teal-700 hover:bg-teal-100";
    case SubcontractStatus.ClosedOut:
      return "bg-neutral-200 text-neutral-500 hover:bg-neutral-200";
    case SubcontractStatus.Terminated:
      return "bg-red-100 text-red-700 hover:bg-red-100";
    case SubcontractStatus.OnHold:
      return "bg-orange-100 text-orange-700 hover:bg-orange-100";
    default:
      return "";
  }
}

// Change Order Status helpers
export function changeOrderStatusLabel(status: ChangeOrderStatus): string {
  switch (status) {
    case ChangeOrderStatus.Pending:
      return "Pending";
    case ChangeOrderStatus.UnderReview:
      return "Under Review";
    case ChangeOrderStatus.Approved:
      return "Approved";
    case ChangeOrderStatus.Rejected:
      return "Rejected";
    case ChangeOrderStatus.Withdrawn:
      return "Withdrawn";
    case ChangeOrderStatus.Void:
      return "Void";
    default:
      return "Unknown";
  }
}

export function changeOrderStatusBadgeClass(status: ChangeOrderStatus): string {
  switch (status) {
    case ChangeOrderStatus.Pending:
      return "bg-yellow-100 text-yellow-700 hover:bg-yellow-100";
    case ChangeOrderStatus.UnderReview:
      return "bg-blue-100 text-blue-700 hover:bg-blue-100";
    case ChangeOrderStatus.Approved:
      return "bg-green-100 text-green-700 hover:bg-green-100";
    case ChangeOrderStatus.Rejected:
      return "bg-red-100 text-red-700 hover:bg-red-100";
    case ChangeOrderStatus.Withdrawn:
      return "bg-neutral-100 text-neutral-600 hover:bg-neutral-100";
    case ChangeOrderStatus.Void:
      return "bg-neutral-200 text-neutral-500 hover:bg-neutral-200";
    default:
      return "";
  }
}

// Payment Application Status helpers
export function paymentApplicationStatusLabel(
  status: PaymentApplicationStatus
): string {
  switch (status) {
    case PaymentApplicationStatus.Draft:
      return "Draft";
    case PaymentApplicationStatus.Submitted:
      return "Submitted";
    case PaymentApplicationStatus.UnderReview:
      return "Under Review";
    case PaymentApplicationStatus.Approved:
      return "Approved";
    case PaymentApplicationStatus.PartiallyApproved:
      return "Partially Approved";
    case PaymentApplicationStatus.Rejected:
      return "Rejected";
    case PaymentApplicationStatus.Paid:
      return "Paid";
    case PaymentApplicationStatus.Void:
      return "Void";
    default:
      return "Unknown";
  }
}

export function paymentApplicationStatusBadgeClass(
  status: PaymentApplicationStatus
): string {
  switch (status) {
    case PaymentApplicationStatus.Draft:
      return "bg-neutral-100 text-neutral-600 hover:bg-neutral-100";
    case PaymentApplicationStatus.Submitted:
      return "bg-blue-100 text-blue-700 hover:bg-blue-100";
    case PaymentApplicationStatus.UnderReview:
      return "bg-yellow-100 text-yellow-700 hover:bg-yellow-100";
    case PaymentApplicationStatus.Approved:
      return "bg-green-100 text-green-700 hover:bg-green-100";
    case PaymentApplicationStatus.PartiallyApproved:
      return "bg-amber-100 text-amber-700 hover:bg-amber-100";
    case PaymentApplicationStatus.Rejected:
      return "bg-red-100 text-red-700 hover:bg-red-100";
    case PaymentApplicationStatus.Paid:
      return "bg-teal-100 text-teal-700 hover:bg-teal-100";
    case PaymentApplicationStatus.Void:
      return "bg-neutral-200 text-neutral-500 hover:bg-neutral-200";
    default:
      return "";
  }
}

// Format helpers
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

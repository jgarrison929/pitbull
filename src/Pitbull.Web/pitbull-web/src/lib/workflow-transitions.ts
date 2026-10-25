import {
  BidStatus,
  ChangeOrderStatus,
  PaymentApplicationStatus,
  RfiStatus,
  TimeEntryStatus,
} from "./types";

/**
 * Frontend mirrors of backend *StatusTransitions classes.
 * Keep in sync with C# domain transition graphs.
 */

// ─── Bids ───────────────────────────────────────────────────

export const bidAllowedTransitions: Record<BidStatus, BidStatus[]> = {
  [BidStatus.Draft]: [BidStatus.Submitted, BidStatus.Cancelled],
  [BidStatus.Submitted]: [BidStatus.Won, BidStatus.Lost, BidStatus.NoResponse, BidStatus.Cancelled],
  [BidStatus.Won]: [],
  [BidStatus.Lost]: [],
  [BidStatus.NoResponse]: [],
  [BidStatus.Cancelled]: [],
  [BidStatus.Converted]: [],
};

export function getAllowedBidStatuses(from: BidStatus): BidStatus[] {
  const next = bidAllowedTransitions[from] ?? [];
  return [from, ...next];
}

export function getNextBidStatuses(from: BidStatus): BidStatus[] {
  return bidAllowedTransitions[from] ?? [];
}

// ─── RFIs ───────────────────────────────────────────────────

export const rfiAllowedTransitions: Record<RfiStatus, RfiStatus[]> = {
  [RfiStatus.Open]: [RfiStatus.Answered],
  [RfiStatus.Answered]: [RfiStatus.Closed, RfiStatus.Open],
  [RfiStatus.Closed]: [],
};

export function parseRfiStatus(status: RfiStatus | string | number): RfiStatus {
  if (typeof status === "number") return status;
  if (typeof status === "string") {
    if (status in RfiStatus) {
      return RfiStatus[status as keyof typeof RfiStatus];
    }
    const byLabel: Record<string, RfiStatus> = {
      Open: RfiStatus.Open,
      Answered: RfiStatus.Answered,
      Closed: RfiStatus.Closed,
    };
    if (status in byLabel) return byLabel[status]!;
  }
  return RfiStatus.Open;
}

export function getAllowedRfiStatuses(from: RfiStatus | string | number): RfiStatus[] {
  const parsed = parseRfiStatus(from);
  const next = rfiAllowedTransitions[parsed] ?? [];
  return [parsed, ...next];
}

export function getNextRfiStatuses(from: RfiStatus | string | number): RfiStatus[] {
  const parsed = parseRfiStatus(from);
  return rfiAllowedTransitions[parsed] ?? [];
}

export function rfiStatusLabel(status: RfiStatus): string {
  switch (status) {
    case RfiStatus.Open:
      return "Open";
    case RfiStatus.Answered:
      return "Answered";
    case RfiStatus.Closed:
      return "Closed";
    default:
      return "Unknown";
  }
}

// ─── Change orders ──────────────────────────────────────────

export const changeOrderAllowedTransitions: Record<ChangeOrderStatus, ChangeOrderStatus[]> = {
  [ChangeOrderStatus.Pending]: [
    ChangeOrderStatus.Pending,
    ChangeOrderStatus.UnderReview,
    ChangeOrderStatus.Rejected,
    ChangeOrderStatus.Withdrawn,
  ],
  [ChangeOrderStatus.UnderReview]: [
    ChangeOrderStatus.UnderReview,
    ChangeOrderStatus.Approved,
    ChangeOrderStatus.Rejected,
    ChangeOrderStatus.Withdrawn,
  ],
  [ChangeOrderStatus.Approved]: [ChangeOrderStatus.Approved, ChangeOrderStatus.Void],
  [ChangeOrderStatus.Rejected]: [ChangeOrderStatus.Rejected],
  [ChangeOrderStatus.Withdrawn]: [ChangeOrderStatus.Withdrawn],
  [ChangeOrderStatus.Void]: [ChangeOrderStatus.Void],
};

export function getAllowedChangeOrderStatuses(
  current: ChangeOrderStatus | null
): ChangeOrderStatus[] {
  if (current === null) return [ChangeOrderStatus.Pending];
  return changeOrderAllowedTransitions[current] ?? [current];
}

// ─── Submittals ─────────────────────────────────────────────

export const submittalAllowedTransitions: Record<string, string[]> = {
  Draft: ["Submitted"],
  Submitted: ["InReview"],
  InReview: ["Approved", "ApprovedAsNoted", "ReviseAndResubmit", "Rejected"],
  ReviseAndResubmit: ["Draft"],
  Rejected: ["Draft"],
  Approved: ["Closed"],
  ApprovedAsNoted: ["Closed"],
  Closed: [],
};

const SUBMITTAL_STATUS_ALIASES: Record<string, string> = {
  Draft: "Draft",
  Submitted: "Submitted",
  InReview: "InReview",
  "In Review": "InReview",
  Approved: "Approved",
  ApprovedAsNoted: "ApprovedAsNoted",
  "Approved as Noted": "ApprovedAsNoted",
  ReviseAndResubmit: "ReviseAndResubmit",
  "Revise & Resubmit": "ReviseAndResubmit",
  Rejected: "Rejected",
  Closed: "Closed",
};

export function parseSubmittalStatus(status: string | number | null | undefined): string {
  if (status === null || status === undefined || status === "") return "Draft";
  if (typeof status === "number") {
    const byIndex = [
      "Draft",
      "Submitted",
      "InReview",
      "Approved",
      "ApprovedAsNoted",
      "ReviseAndResubmit",
      "Rejected",
      "Closed",
    ];
    return byIndex[status] ?? "Draft";
  }
  if (status in SUBMITTAL_STATUS_ALIASES) return SUBMITTAL_STATUS_ALIASES[status]!;
  return status;
}

export function getAllowedSubmittalStatuses(from: string | null): string[] {
  if (from === null) return ["Draft"];
  const parsed = parseSubmittalStatus(from);
  const next = submittalAllowedTransitions[parsed] ?? [];
  return [parsed, ...next];
}

export function getNextSubmittalStatuses(from: string): string[] {
  return submittalAllowedTransitions[from] ?? [];
}

// ─── Time entries (2.21.8 — mirrors TimeEntryService.IsValidTransition) ──

/**
 * Keep in sync with C# TimeEntryService.IsValidTransition:
 * Draft→Submitted; Submitted→Approved|Rejected|Draft; Rejected→Draft|Submitted; Approved terminal.
 */
export const timeEntryAllowedTransitions: Record<TimeEntryStatus, TimeEntryStatus[]> = {
  [TimeEntryStatus.Draft]: [TimeEntryStatus.Submitted],
  [TimeEntryStatus.Submitted]: [
    TimeEntryStatus.Approved,
    TimeEntryStatus.Rejected,
    TimeEntryStatus.Draft,
  ],
  [TimeEntryStatus.Rejected]: [TimeEntryStatus.Draft, TimeEntryStatus.Submitted],
  [TimeEntryStatus.Approved]: [],
};

export function getNextTimeEntryStatuses(from: TimeEntryStatus): TimeEntryStatus[] {
  return timeEntryAllowedTransitions[from] ?? [];
}

export function canTransitionTimeEntry(
  from: TimeEntryStatus,
  to: TimeEntryStatus
): boolean {
  if (from === to) return true;
  return getNextTimeEntryStatuses(from).includes(to);
}

/** Mobile/desktop review only approves/rejects from Submitted. */
export function canReviewTimeEntryFromSubmitted(
  decision: "approve" | "reject"
): boolean {
  const to =
    decision === "approve" ? TimeEntryStatus.Approved : TimeEntryStatus.Rejected;
  return canTransitionTimeEntry(TimeEntryStatus.Submitted, to);
}

// ─── Daily reports ──────────────────────────────────────────

export const dailyReportAllowedTransitions: Record<string, string[]> = {
  Draft: ["Submitted"],
  Submitted: ["Approved"],
  Approved: ["Locked"],
  Locked: [],
};

export function getNextDailyReportStatuses(from: string): string[] {
  return dailyReportAllowedTransitions[from] ?? [];
}

// ─── Subcontract pay apps (AP) ──────────────────────────────

export const paymentApplicationAllowedTransitions: Record<PaymentApplicationStatus, PaymentApplicationStatus[]> = {
  [PaymentApplicationStatus.Draft]: [PaymentApplicationStatus.Submitted],
  [PaymentApplicationStatus.Submitted]: [PaymentApplicationStatus.Reviewed, PaymentApplicationStatus.Rejected],
  [PaymentApplicationStatus.Reviewed]: [PaymentApplicationStatus.Approved, PaymentApplicationStatus.Rejected],
  [PaymentApplicationStatus.Approved]: [PaymentApplicationStatus.Paid],
  [PaymentApplicationStatus.Rejected]: [PaymentApplicationStatus.Draft],
  [PaymentApplicationStatus.Paid]: [],
  [PaymentApplicationStatus.Void]: [],
};

export function getNextPaymentApplicationStatuses(from: PaymentApplicationStatus): PaymentApplicationStatus[] {
  return paymentApplicationAllowedTransitions[from] ?? [];
}

// ─── Vendor invoices (AP) ───────────────────────────────────

export const vendorInvoiceAllowedTransitions: Record<string, string[]> = {
  Pending: ["Matched", "PartiallyMatched", "Approved"],
  Matched: ["Approved"],
  PartiallyMatched: ["Approved"],
  Approved: ["Paid"],
  Paid: [],
};

export function getNextVendorInvoiceStatuses(from: string): string[] {
  return vendorInvoiceAllowedTransitions[from] ?? [];
}
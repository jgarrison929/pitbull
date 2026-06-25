import { BidStatus, ChangeOrderStatus, RfiStatus } from "./types";

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

export function getAllowedRfiStatuses(from: RfiStatus): RfiStatus[] {
  const next = rfiAllowedTransitions[from] ?? [];
  return [from, ...next];
}

export function getNextRfiStatuses(from: RfiStatus): RfiStatus[] {
  return rfiAllowedTransitions[from] ?? [];
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

export function getAllowedSubmittalStatuses(from: string | null): string[] {
  if (from === null) return ["Draft"];
  const next = submittalAllowedTransitions[from] ?? [];
  return [from, ...next];
}

export function getNextSubmittalStatuses(from: string): string[] {
  return submittalAllowedTransitions[from] ?? [];
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
/**
 * Help Center — Approvals workflow (2.21.9).
 * Time entries are the frozen mobile lifecycle (workflow-approvals-phase2.md).
 */

export const APPROVALS_HELP_SECTION_TITLE = "Approvals workflow";

export type ApprovalsHelpCard = {
  id: string;
  title: string;
  href: string;
  steps: string[];
};

export const approvalsHelpCards: ApprovalsHelpCard[] = [
  {
    id: "pm-pending-card",
    title: "See what needs approval",
    href: "/",
    steps: [
      "Sign in as PM or Manager.",
      "On home, open the Pending approvals card (live counts from `/api/approvals/pending`).",
      "Zero means the queue is empty — not a hidden badge.",
      "Use Mobile approve or Desktop queue for time entries.",
    ],
  },
  {
    id: "mobile-time-approve",
    title: "Approve time on a phone",
    href: "/time-tracking/approval/mobile",
    steps: [
      "Open `/time-tracking/approval/mobile` (or link from PM home).",
      "Review Submitted entries only (same rules as desktop).",
      "Tap Approve, or enter a reject reason and tap Reject.",
      "Approved entries are final — no reverse transition without a new correction path.",
    ],
  },
  {
    id: "desktop-review",
    title: "Desktop bulk review",
    href: "/time-tracking/approval",
    steps: [
      "Open Time Tracking → Approval.",
      "Filter by week/project if needed.",
      "Mark approve/reject and submit review (uses `/api/time-entries/review`).",
      "Change orders remain Phase 1 office flows — not the mobile expand lifecycle.",
    ],
  },
];

export const approvalsFaqItems: { question: string; answer: string }[] = [
  {
    question: "Which approvals work on mobile in Phase 2?",
    answer:
      "Time entries (Submitted → Approved/Rejected). Counts also show pending change orders for glance, but mobile approve/reject expands time entries only (spec freeze 2.21.3).",
  },
  {
    question: "Why is the pending count zero?",
    answer:
      "Live database query found no Submitted time entries (or pending COs). That is honest empty — not a broken badge.",
  },
];

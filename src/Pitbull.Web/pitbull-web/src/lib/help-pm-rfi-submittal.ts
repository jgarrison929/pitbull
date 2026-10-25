/**
 * Help Center cards for mobile RFI + Submittal (band 3.5 / 3.4.8).
 * Routes match real app pages; no offline claims beyond truth.
 */

export const PM_RFI_SUBMITTAL_HELP_SECTION_TITLE = "RFIs & Submittals on phone";

export type PmRfiSubmittalHelpCard = {
  id: string;
  title: string;
  steps: string[];
  href: string;
};

export const HELP_PM_RFI_SUBMITTAL_CARDS: PmRfiSubmittalHelpCard[] = [
  {
    id: "rfis-phone",
    title: "RFIs on phone",
    steps: [
      "Open RFIs and pick a job.",
      "List shows number, subject, status, and due/overdue — not a health score.",
      "Tap a row for question, answer, and confirm before status changes.",
    ],
    href: "/rfis",
  },
  {
    id: "submittals-phone",
    title: "Submittals on phone",
    steps: [
      "Open a project → Submittals.",
      "Phone list shows type, status, and due only — not register % complete.",
      "Open a row to see workflow glance from real status enums.",
    ],
    href: "/projects",
  },
];

export const pmRfiSubmittalFaqItems: { question: string; answer: string }[] = [
  {
    question: "What do RFI statuses mean?",
    answer:
      "Open = waiting on an answer. Answered = response recorded. Closed = done. Status only changes after you confirm.",
  },
  {
    question: "Is the submittal register % complete on phone?",
    answer:
      "No. Phone shows real item status and due dates only. We do not invent a register health percentage.",
  },
  {
    question: "Do RFIs work fully offline?",
    answer:
      "List and detail need a connection for live data. We do not claim a full offline RFI log unless a queue already exists.",
  },
];

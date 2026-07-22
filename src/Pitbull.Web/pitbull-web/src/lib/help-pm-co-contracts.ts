/**
 * Help Center cards for mobile change orders + contracts (band 3.6 / 3.5.8).
 * Routes match real app pages; no portfolio commercial health claims.
 */

export const PM_CO_CONTRACTS_HELP_SECTION_TITLE = "Change orders & contracts on phone";

export type PmCoContractsHelpCard = {
  id: string;
  title: string;
  steps: string[];
  href: string;
};

export const HELP_PM_CO_CONTRACTS_CARDS: PmCoContractsHelpCard[] = [
  {
    id: "change-orders-phone",
    title: "Change orders on phone",
    steps: [
      "Open Change Orders from the main nav.",
      "Phone list shows CO number, title, status, and amount — not a commercial health score.",
      "Empty means none for this filter — never “all clear.”",
    ],
    href: "/change-orders",
  },
  {
    id: "contracts-phone",
    title: "Contracts glance",
    steps: [
      "Open Contracts or a project’s commercial paper.",
      "Review subcontract and owner CO status on a real connection.",
      "SOV edit stays desktop — phone is glance and status only.",
    ],
    href: "/contracts",
  },
];

export const pmCoContractsFaqItems: { question: string; answer: string }[] = [
  {
    question: "Does an empty CO list mean the job is healthy?",
    answer:
      "No. Empty means no change orders match the filter. We do not invent a commercial health score.",
  },
  {
    question: "Can I edit SOV on phone?",
    answer:
      "No. Phone is status and amount glance. Full SOV edit remains desktop-first.",
  },
];

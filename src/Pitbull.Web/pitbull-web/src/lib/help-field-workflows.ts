/**
 * Help Center — Field & mobile workflows card data (2.12.7).
 * Pure data for page + unit tests; routes must match real app paths.
 */

export type FieldWorkflowCard = {
  id: string;
  title: string;
  href: string;
  /** Lucide icon name key used by the page (keeps this module free of React). */
  icon: "file-text" | "map-pin" | "wifi-off";
  steps: string[];
};

export const FIELD_WORKFLOWS_SECTION_TITLE = "Field & mobile workflows";

export const fieldWorkflowCards: FieldWorkflowCard[] = [
  {
    id: "daily-field-report",
    title: "Daily Field Report",
    href: "/daily-reports/mobile",
    icon: "file-text",
    steps: [
      "On a phone, open bottom nav Report (or go to Field report).",
      "Pick project and report date on the Project step.",
      "On Field, add work activity (and weather before submit).",
      "Skip or attach photos, then Review and Submit (online or offline queue).",
    ],
  },
  {
    id: "site-walk",
    title: "Site Walk",
    href: "/projects",
    icon: "map-pin",
    steps: [
      "Open Projects and select the job you are walking.",
      "From project navigation, open Site Walk (`/projects/{id}/site-walk`).",
      "Capture field notes and observations while on site.",
      "Return via project nav or bottom nav when finished.",
    ],
  },
  {
    id: "offline-pwa",
    title: "Offline / PWA",
    href: "/daily-reports/mobile",
    icon: "wifi-off",
    steps: [
      "Install Pitbull when the PWA install prompt appears above the bottom nav.",
      "If you lose connectivity, field report submit queues offline (queue indicator).",
      "When back online, queued daily reports sync automatically.",
      "Prefer Field report and Crew mobile paths on phone — not desktop ledgers.",
    ],
  },
];

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

/** 2.12.8 — accurate mobile FAQ copy (no “fully responsive” blanket claim). */
export const mobileFaqItems: { question: string; answer: string }[] = [
  {
    question: "Can I use Pitbull on mobile devices?",
    answer:
      "Yes for field capture and glance. Use phone bottom nav: Report → `/daily-reports/mobile` for the four-step field report; Crew → `/time-tracking/mobile` for time. Desktop ledgers and portfolio aggregation stay on larger screens — the app is not a full desktop clone on a phone.",
  },
  {
    question: "How does offline and PWA work on a phone?",
    answer:
      "Install Pitbull when the PWA prompt appears above the bottom nav. If you lose connectivity, field report submit can queue offline; when you reconnect, the queue syncs. Watch the offline/queue indicator on field paths.",
  },
  {
    question: "Where are Digital Twin and Plans on a job?",
    answer:
      "Open a project from Projects, then use project navigation: Digital Twin at `/projects/{id}/twin` and Plans & Specs at `/projects/{id}/plans-specs`. Site Walk is `/projects/{id}/site-walk`.",
  },
];

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
  {
    id: "plans-on-site",
    title: "Plans on site",
    href: "/projects",
    icon: "file-text",
    steps: [
      "Open Projects and select the job.",
      "Open Plans & Specs (`/projects/{id}/plans-specs`) — viewer-first on phone.",
      "Search sheet number; tap to view (admin upload is desktop).",
      "From Site Walk, use Plans for a filtered deep link into the same viewer.",
    ],
  },
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

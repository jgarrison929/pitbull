/**
 * Help Center — Field & mobile workflows card data (2.12.7+ / 3.1.x).
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

/** Mobile FAQ copy — truthful offline photo / plan limits (3.1.x). */
export const mobileFaqItems: { question: string; answer: string }[] = [
  {
    question: "Can I use Pitbull on mobile devices?",
    answer:
      "Yes for field capture and glance. Use phone bottom nav: Log → `/daily-reports/mobile?mode=quick` for a fast day log, or Report → `/daily-reports/mobile` for the full field report; Crew → `/time-tracking/mobile` for time. Desktop ledgers and portfolio aggregation stay on larger screens — the app is not a full desktop clone on a phone.",
  },
  {
    question: "How does offline and PWA work on a phone?",
    answer:
      "Install Pitbull when the PWA prompt appears above the bottom nav. Field report submit queues offline; large photos are downscaled when possible (up to 10). Photos still too large show as skipped — not silently saved. When you reconnect, the queue syncs. Watch the offline/queue indicator on field paths.",
  },
  {
    question: "Can I open drawings offline?",
    answer:
      "On Plans & Specs (`/projects/{id}/plans-specs`), sheets you View or Save offline are stored on this device only. Sheets not cached show Not offline — we never claim the whole drawing set is available offline.",
  },
  {
    question: "How do I pin an issue on a plan?",
    answer:
      "Open a drawing on Plans & Specs, write a pin note, then Review & create draft RFI. You must confirm before create. The draft carries drawing references (sheet/file id). Nothing auto-posts progress or cost.",
  },
  {
    question: "Where are Digital Twin and Plans on a job?",
    answer:
      "Open a project from Projects, then use project navigation: Digital Twin at `/projects/{id}/twin` and Plans & Specs at `/projects/{id}/plans-specs`. Site Walk is `/projects/{id}/site-walk`.",
  },
  {
    question: "How does AI work on the mobile field report?",
    answer:
      "On Field notes, use Suggest from notes (AI) when online — results are labeled “Suggestion — review before submit” and apply only after you confirm. Offline, AI is disabled with honest copy (enter narratives manually). Optional LLM end-of-day rewrite is off unless `NEXT_PUBLIC_FEATURE_FIELD_LLM_EOD=true`. AI never auto-posts progress.",
  },
  {
    question: "Is AI photo safety a compliance finding?",
    answer:
      "No. Photo assist safety notes are optional, labeled suggestions from caption heuristics only — not a site inspection or OSHA finding. Review before applying to the safety narrative.",
  },
];

export const fieldWorkflowCards: FieldWorkflowCard[] = [
  {
    id: "daily-field-report",
    title: "Daily Field Report",
    href: "/daily-reports/mobile",
    icon: "file-text",
    steps: [
      "On a phone, open bottom nav Log (quick) or full Field report.",
      "Last job/plan sheet may be remembered on this device.",
      "Add work + photos; offline photos downscale when possible.",
      "Review and Submit (online or offline queue — same daily-report path).",
    ],
  },
  {
    id: "site-walk",
    title: "Site Walk",
    href: "/projects",
    icon: "map-pin",
    steps: [
      "Open Projects (or field home **Today on this job**) and select the job.",
      "From project navigation, open Site Walk (`/projects/{id}/site-walk`).",
      "Capture field notes and observations while on site.",
      "Return via project nav or bottom nav when finished.",
    ],
  },
  {
    id: "plans-on-site",
    title: "Plans on site",
    href: "/projects",
    icon: "file-text",
    steps: [
      "Open Plans & Specs (`/projects/{id}/plans-specs`) — viewer-first on phone.",
      "View or Save offline individual sheets (not the whole set).",
      "Pin a note on an open drawing → confirm draft RFI with sheet refs.",
      "From Site Walk, use Plans for a filtered deep link into the same viewer.",
    ],
  },
  {
    id: "offline-pwa",
    title: "Offline / PWA",
    href: "/daily-reports/mobile",
    icon: "wifi-off",
    steps: [
      "Install Pitbull when the PWA install prompt appears above the bottom nav.",
      "Field report/quick log queue offline; photos downscale or show skipped honestly.",
      "Only saved/viewed drawings open offline — others say Not offline.",
      "When back online, queued daily reports sync automatically.",
    ],
  },
];

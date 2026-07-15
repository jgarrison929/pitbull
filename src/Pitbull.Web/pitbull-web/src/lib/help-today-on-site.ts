/**
 * Help Center — Today on site (3.3.6).
 * Real entities only: daily reports, photos, open RFIs for the UTC day.
 * No health scores, % complete, or portfolio rollups.
 */

export type TodayOnSiteHelpCard = {
  id: string;
  title: string;
  steps: string[];
  href: string;
};

export const TODAY_ON_SITE_HELP_SECTION_TITLE = "Today on site";

export const HELP_TODAY_ON_SITE_CARDS: TodayOnSiteHelpCard[] = [
  {
    id: "today-glance",
    title: "Today's field activity glance",
    steps: [
      "Open a project from Projects (or field home).",
      "On project detail, find Today's field activity — counts from real reports filed today (UTC day).",
      "Empty means nothing was filed yet for that job today — not a health score.",
      "Use deep links to open daily reports or RFIs; phone stays glance + drill only.",
    ],
    href: "/projects",
  },
  {
    id: "today-site-walk",
    title: "Today on Site Walk",
    steps: [
      "Open Site Walk for the same project (`/projects/{id}/site-walk`).",
      "Today's field activity uses the same project API — no second aggregation path.",
      "Counts stay server-side; the phone never rolls up a portfolio of jobs.",
    ],
    href: "/projects",
  },
  {
    id: "today-truth",
    title: "What the counts mean",
    steps: [
      "Daily report count: field reports filed for this project today (UTC).",
      "Photo count: photos attached to those reports (when available from the API).",
      "Open RFI count: RFIs still open for this project as of the glance (not invented).",
      "Never treat this card as % complete, subcontractor score, or site health.",
    ],
    href: "/help",
  },
];

export const todayOnSiteFaqItems: { question: string; answer: string }[] = [
  {
    question: "What is Today's field activity on a project?",
    answer:
      "A glance of real entities filed today for that job only: daily report count, photo count, and open RFIs. Empty is honest — we never invent activity or paint a health score. Phone stays glance + filtered drill; no portfolio rollup.",
  },
  {
    question: "Does Site Walk use a different today total?",
    answer:
      "No. Site Walk and project detail both call GET /api/projects/{id}/today-on-site. There is no second client-side aggregation path.",
  },
  {
    question: "Is Today on site a KPI or health score?",
    answer:
      "No. Labels say field activity, not health. Counts come only from real daily reports / RFIs for the documented UTC day boundary — never % complete or portfolio KPIs on this card.",
  },
];

export function helpTodayOnSiteCardIds(): string[] {
  return HELP_TODAY_ON_SITE_CARDS.map((c) => c.id);
}

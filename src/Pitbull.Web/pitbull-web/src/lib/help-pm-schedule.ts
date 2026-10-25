/**
 * Help Center cards for mobile schedule / look-ahead (band 3.7 / 3.6.8).
 * Real routes; no SPI/CPI invent; CPM labels stay honest.
 */

export const PM_SCHEDULE_HELP_SECTION_TITLE = "Schedule & look-ahead on phone";

export type PmScheduleHelpCard = {
  id: string;
  title: string;
  steps: string[];
  href: string;
};

export const HELP_PM_SCHEDULE_CARDS: PmScheduleHelpCard[] = [
  {
    id: "schedule-look-ahead-phone",
    title: "Look-ahead on phone",
    steps: [
      "Open a project → Schedule.",
      "Phone shows near-term activities with real status and critical flag when the server has them.",
      "Empty means none in range — not an on-track health score.",
    ],
    href: "/projects",
  },
  {
    id: "cpm-float-phone",
    title: "Critical path & float",
    steps: [
      "Critical badge appears only when the server marks IsCritical.",
      "Float shows days when present; otherwise “Float insufficient.”",
      "We never paint green “on track” without real data.",
    ],
    href: "/projects",
  },
];

export const pmScheduleFaqItems: { question: string; answer: string }[] = [
  {
    question: "Is percent complete a health score?",
    answer:
      "No. Percent complete is the activity’s server field only. We do not invent SPI/CPI or portfolio schedule health.",
  },
  {
    question: "Why does float say insufficient?",
    answer:
      "When the schedule has not calculated float, we show insufficient data instead of inventing zero float or on-track green.",
  },
];

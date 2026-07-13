/**
 * Help Center — office personas (2.22.1).
 * CEO briefing, CFO WIP, PM approvals, Estimator pipeline.
 * Title-first role profiles per ROLE-EXPERIENCE.md.
 */

export const OFFICE_WORKFLOWS_SECTION_TITLE = "Office workflows";

export type OfficeHelpCard = {
  id: string;
  persona: "ceo" | "cfo" | "pm" | "estimator";
  title: string;
  href: string;
  steps: string[];
};

export const officeHelpCards: OfficeHelpCard[] = [
  {
    id: "ceo-briefing",
    persona: "ceo",
    title: "CEO executive briefing",
    href: "/",
    steps: [
      "Sign in as CEO (demo: ceo@demo.local) — title drives the executive layout.",
      "Home opens the Executive dashboard with portfolio KPIs from role-summary.",
      "Tap Active projects, Billed YTD, Unbilled backlog, or AR−AP net to open filtered lists.",
      "AR−AP net is a proxy (aging AR minus AP), not a full consolidation close.",
      "Morning briefing tiles (when shown) use the same drill contracts as KPI cards.",
    ],
  },
  {
    id: "cfo-wip",
    persona: "cfo",
    title: "CFO finance & WIP",
    href: "/accounting/wip",
    steps: [
      "Sign in as CFO (demo: cfo@demo.local) for the controller layout.",
      "Home shows AR total, AP total, AR−AP net, and strict budget alerts — all drillable.",
      "Open Accounting → WIP for work-in-progress; use aging for AR/AP focus filters.",
      "Billed-to-date drills to billing applications (progress scope); unbilled backlog filters projects.",
      "Never treat empty aging buckets as “all clear” — zero means no rows matched the filter.",
    ],
  },
  {
    id: "pm-approvals",
    persona: "pm",
    title: "PM approvals & jobs",
    href: "/",
    steps: [
      "Sign in as Project Manager (demo: pm@demo.local).",
      "Home shows Active jobs, Open RFIs (not closed), and Hours this week — each with drill hrefs.",
      "Pending approvals card uses live GET /api/approvals/pending (time + CO glance counts).",
      "Mobile approve path is time entries only: /time-tracking/approval/mobile.",
      "Desktop bulk review remains /time-tracking/approval for weekly payroll prep.",
    ],
  },
  {
    id: "estimator-pipeline",
    persona: "estimator",
    title: "Estimator bid pipeline",
    href: "/bids?pipeline=open",
    steps: [
      "Sign in as Estimator (demo: estimator@demo.local).",
      "Home cards open the bid pipeline (Draft + Submitted) and active projects (not completed).",
      "Pipeline $ and open bid counts come from role-summary / analytics — not invented targets.",
      "Tap Open bids or Pipeline value to land on /bids?pipeline=open with the same predicate.",
      "Empty pipeline is honest zero — create or import bids under Bids, not fake placeholders.",
    ],
  },
];

/** FAQ deferred to 2.22.2 (role profiles, demo explore, KPI drill truth). */
export const officeFaqItems: { question: string; answer: string }[] = [];

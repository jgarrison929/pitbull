// Public changelog. Newest first. Each entry is a demo-able increment that passed ci-gate and verify-v5.
export const changelog = [
  {
    version: "5.0.0-m1.1",
    date: "2026-10-20",
    items: [
      "Earned value is real: units complete, weighted milestones, or PM percent with a who/why log.",
      "Actuals come from cost entries (foreman hours × rate); planned value from time-phased dates; locked progress claims drive EV.",
      "Job cost table shows how each line's earned percent was derived. PM can lock the open period claim.",
    ],
  },
  {
    version: "5.0.0-m1",
    date: "2026-10-18",
    items: [
      "Role-card demo login with a private sandbox per visitor, reset in one click, expiring after 24 hours.",
      "Portfolio and job screens read live from Postgres: earned value, CPI, SPI and EAC by job and cost code.",
      "Cost codes stack into readable rows on phones instead of scrolling sideways.",
      "Assistant rail: ask in words or by voice, and it runs the same typed actions as the screens and shows each one it ran.",
      "On a phone the foreman starts in the chat and voice view.",
    ],
  },
  {
    version: "5.0.0-m0",
    date: "2026-10-18",
    items: [
      "Fresh v5 app on staging with a public status page that shows the deployed commit and database health.",
    ],
  },
];

// Public changelog. Newest first. Each entry is a demo-able increment that passed ci-gate and verify-v5.
export const changelog = [
  {
    version: "5.0.0-m5.0",
    date: "2026-10-22",
    items: [
      "Change orders run draft, then priced, then approved or rejected. Void is available from draft or priced. Only an executive can approve or reject. Reject and void move no money.",
      "Approve adds the priced lines to Current Budget once. A new cost item starts with Original Budget at zero and Current Budget equal to the change, so the job's Current Budget and EAC both move by that amount. A second approve is refused. Original Budget stays where the estimate left it.",
      "Cedar Creek seeds CO-001, a priced retaining wall for $60,000.00. The job screen and the assistant run the same actions, and those actions show on the job's change list.",
    ],
  },
  {
    version: "5.0.0-m4.0",
    date: "2026-10-22",
    items: [
      "EV, AC, and PV share one cutoff at the last locked period; cost and planned-value changes since that lock show separately so on-plan work keeps SPI at 1.00.",
      "Per-item forecasts: Current Budget (AC + BAC − EV) or Average Performance (AC ÷ % complete), with job EAC as their sum and ETC on the job tiles.",
      "Units earned value is capped at Current Budget; earned man-hours sit next to installed quantity. Hand-computed fixtures cover every formula.",
    ],
  },
  {
    version: "5.0.0-m3",
    date: "2026-10-21",
    items: [
      "Superintendent approve posts hours and quantity to cost once, dated by the plan date — not the report or approve day.",
      "Foreman reports stay pending until approval; return needs a reason, keeps values, and posts nothing. Approve and return work on screen and via the assistant; both are audited.",
    ],
  },
  {
    version: "5.0.0-m2.1",
    date: "2026-10-21",
    items: [
      "Cost items carry Original Budget, Current Budget, and Current Estimate — each split into labor, material, equipment, and sub (integer cents).",
      "PM Approve estimate freezes Original Budget from the Current Estimate, sets Current Budget equal to Original, and writes an audit log. A second approve is refused.",
      "Harbor Abutment (26-010) seeds as a draft estimate; EV, job, and portfolio KPIs read Current Budget.",
    ],
  },
  {
    version: "5.0.0-m1.4",
    date: "2026-10-21",
    items: [
      "Status and /health show the release version, deployed commit, ci-gate result for that commit, and the last verify-v5 timestamp.",
    ],
  },
  {
    version: "5.0.0-m1.3",
    date: "2026-10-20",
    items: [
      "Report day's work takes per-line actual man-hours and quantity (defaults = last report, else plan). The submitted plan is unchanged.",
      "Actuals are dated today (America/Los_Angeles) and are idempotent, including a rain-day 0/0 report. Enter them on screen or via the assistant.",
    ],
  },
  {
    version: "5.0.0-m1.2",
    date: "2026-10-20",
    items: [
      "Cost codes are a searchable WBS tree with SQL leaf roll-ups, sized for 10,000 codes per job.",
      "Job cost table is virtualized; plan-line cost codes search the server instead of shipping the full list.",
      "Typeahead opens with an empty search so job codes appear; quantity unit comes from the picked option; perf:cost-codes measures concurrent HTTP search at 5 and 10 users.",
      "Selected cost-code label resolves from the line when outside the first-40 options; prefix search ranks matching codes ahead of substring hits.",
    ],
  },
  {
    version: "5.0.0-m1.1",
    date: "2026-10-20",
    items: [
      "Earned value is real: units complete, weighted milestones, or PM percent with a who/why log — all enterable on screen and via the assistant.",
      "Seed builds AC from dated labor/invoices on every job (no budget×pct plug) and PV from schedules fixed independently of progress.",
      "Units EV uses locked claimed installed qty; live installs show as pending until the PM locks. Report day's work requires a submitted plan.",
      "Assistant resolves job vs cost code for PM % and milestones. Milestone who/why lives on its own log.",
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

// Public roadmap. Shipped newest first; Next is release order. No dates on unshipped.
// Kept in sync with docs/roadmap.md by roadmap.test.ts (Railway builds from /v5).
// Shipped lists only versions that have a changelog entry (trust bar: nothing announced early).

export type ShippedRelease = {
  version: string;
  /** Short label shown on /roadmap; must appear in docs/roadmap.md. */
  name: string;
  /** ISO date (YYYY-MM-DD) once the release has shipped. */
  date: string;
};

export type NextRelease = {
  /** Version or module key shown on /roadmap; must appear in docs/roadmap.md. */
  version: string;
  name: string;
};

export const shipped = [
  {
    version: "5.0.3",
    name: "Average Performance selectable per cost item, the dark theme, plan history by role and time, and faster job pages",
    date: "2026-10-26",
  },
  {
    version: "5.0.2",
    name: "Crew labor rates, seeded field history, and drill-down from a cost item to its daily reports",
    date: "2026-10-26",
  },
  {
    version: "5.0.1",
    name: "The superintendent builds the day's plan, and a public /roadmap page",
    date: "2026-10-25",
  },
  {
    version: "5.0.0",
    name: "the role-card demo, per-visitor sandboxes, estimate to budget, the field daily plan and report, cost and earned value, and change orders",
    date: "2026-10-24",
  },
] as const satisfies readonly ShippedRelease[];

export const next = [
  {
    version: "5.0.4",
    name: "Clear next steps for each role, a plain purpose line on every page, and a phone layout with one main number per card",
  },
  { version: "5.0.5", name: "The S-curve for each job and the portfolio" },
  { version: "5.1", name: "Schedule" },
  { version: "5.2", name: "Contracts and subs" },
  { version: "5.3", name: "Document control" },
  { version: "5.4", name: "Compliance" },
  { version: "5.5", name: "Owner billing and portfolio reporting" },
  { version: "5.6+", name: "accounting and payroll export" },
] as const satisfies readonly NextRelease[];

/** Visible strings the trust-bar crawl rejects on /roadmap. */
export const ROADMAP_BANNED = [
  /coming\s+soon/i,
  /\btbd\b/i,
  /\bwip\b/i,
  /placeholder/i,
  /\berp\b/i,
  /\btodo\b/i,
  /lorem/i,
  /not\s+implemented/i,
] as const;

/** Label shown for a Next row (5.1 Schedule, plain version for 5.0.x). */
export function nextLabel(r: (typeof next)[number]): string {
  if (
    r.version === "5.1" ||
    r.version === "5.2" ||
    r.version === "5.3" ||
    r.version === "5.4" ||
    r.version === "5.5"
  ) {
    return `${r.version} ${r.name}`;
  }
  if (r.version === "5.6+") {
    return `${r.version} ${r.name}`;
  }
  return r.version;
}

/** Flatten page copy for banned-string checks (no dates on Next). */
export function roadmapPageText(): string {
  const shippedLines = shipped.map(
    (r) => `${r.version} ${r.name} ${r.date} Shipped`,
  );
  const nextLines = next.map((r) => {
    const label = nextLabel(r);
    return label === r.version ? `${r.version} ${r.name}` : label;
  });
  return ["Roadmap", "Shipped", ...shippedLines, "Next", ...nextLines].join(
    "\n",
  );
}

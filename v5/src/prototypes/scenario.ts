// Demo data for the M1 shell prototypes. Fictional company, jobs and people.
// Every shell renders this one scenario so the comparison is about the shell, not the data.

export const DEMO_LABEL = "Demo data · fictional company";
export const AS_OF = "Mon Oct 19, 2026";
export const PLAN_DATE = "Tue Oct 20, 2026";
export const COMPANY = "Summit Highway & Bridge";

export type Job = {
  id: string;
  number: string;
  name: string;
  short: string;
  owner: string;
  contract: number;
  /** Cost budget at completion (BAC). */
  budget: number;
  /** Planned value to date (BCWS). */
  pv: number;
  /** Earned value to date (BCWP). */
  ev: number;
  /** Actual cost to date (ACWP). */
  ac: number;
  pm: string;
  finish: string;
};

export const jobs: Job[] = [
  {
    id: "sr99",
    number: "24-118",
    name: "SR-99 / Airport Way Interchange",
    short: "SR-99 Interchange",
    owner: "State DOT, Region 2",
    contract: 48_600_000,
    budget: 43_200_000,
    pv: 29_900_000,
    ev: 30_250_000,
    ac: 29_080_000,
    pm: "Dana Whitfield",
    finish: "Aug 2027",
  },
  {
    id: "cedar",
    number: "25-031",
    name: "Cedar Creek Bridge Replacement",
    short: "Cedar Creek Bridge",
    owner: "County Public Works",
    contract: 14_600_000,
    budget: 12_897_400,
    pv: 6_330_000,
    ev: 6_396_900,
    ac: 7_046_300,
    pm: "Marcus Lee",
    finish: "Nov 2027",
  },
  {
    id: "i5",
    number: "24-077",
    name: "I-5 Culvert & Drainage Rehab",
    short: "I-5 Culverts",
    owner: "State DOT, Region 1",
    contract: 9_800_000,
    budget: 8_700_000,
    pv: 7_900_000,
    ev: 6_950_000,
    ac: 6_880_000,
    pm: "Priya Natarajan",
    finish: "Mar 2027",
  },
];

export type CostCode = {
  code: string;
  description: string;
  unit: string;
  budgetQty: number;
  installedQty: number;
  budgetCost: number;
  actualCost: number;
};

/** Cedar Creek Bridge, budget vs earned value by cost code. */
export const focusJobId = "cedar";
export const costCodes: CostCode[] = [
  {
    code: "02-100",
    description: "Mobilization",
    unit: "LS",
    budgetQty: 1,
    installedQty: 1,
    budgetCost: 640_000,
    actualCost: 655_000,
  },
  {
    code: "02-220",
    description: "Clearing & grubbing",
    unit: "AC",
    budgetQty: 4.2,
    installedQty: 4.2,
    budgetCost: 96_000,
    actualCost: 88_400,
  },
  {
    code: "03-310",
    description: "Structure excavation",
    unit: "CY",
    budgetQty: 6_800,
    installedQty: 6_120,
    budgetCost: 418_000,
    actualCost: 402_500,
  },
  {
    code: "03-450",
    description: "Drilled shafts, 72 in",
    unit: "LF",
    budgetQty: 1_440,
    installedQty: 1_080,
    budgetCost: 3_240_000,
    actualCost: 2_620_000,
  },
  {
    code: "04-110",
    description: "Footing concrete",
    unit: "CY",
    budgetQty: 1_150,
    installedQty: 1_150,
    budgetCost: 1_035_000,
    actualCost: 1_002_300,
  },
  {
    code: "04-210",
    description: "Pier column concrete",
    unit: "CY",
    budgetQty: 620,
    installedQty: 248,
    budgetCost: 868_000,
    actualCost: 371_200,
  },
  {
    code: "04-310",
    description: "Reinforcing steel",
    unit: "LB",
    budgetQty: 412_000,
    installedQty: 186_000,
    budgetCost: 906_400,
    actualCost: 432_900,
  },
  {
    code: "05-120",
    description: "Precast girders, set",
    unit: "EA",
    budgetQty: 28,
    installedQty: 0,
    budgetCost: 2_380_000,
    actualCost: 0,
  },
  {
    code: "06-200",
    description: "Deck concrete",
    unit: "CY",
    budgetQty: 1_380,
    installedQty: 0,
    budgetCost: 1_518_000,
    actualCost: 0,
  },
  {
    code: "07-410",
    description: "Cofferdam & dewatering",
    unit: "LS",
    budgetQty: 1,
    installedQty: 0.7,
    budgetCost: 1_150_000,
    actualCost: 1_180_000,
  },
  {
    code: "08-100",
    description: "Traffic control",
    unit: "MO",
    budgetQty: 24,
    installedQty: 9,
    budgetCost: 432_000,
    actualCost: 182_000,
  },
  {
    code: "09-500",
    description: "Erosion control & SWPPP",
    unit: "LS",
    budgetQty: 1,
    installedQty: 0.45,
    budgetCost: 214_000,
    actualCost: 112_000,
  },
];

export type CostRow = CostCode & {
  percent: number;
  earned: number;
  variance: number;
  cpi: number | null;
};

export function costRow(c: CostCode): CostRow {
  const percent = c.budgetQty === 0 ? 0 : c.installedQty / c.budgetQty;
  const earned = Math.round(c.budgetCost * percent);
  return {
    ...c,
    percent,
    earned,
    variance: earned - c.actualCost,
    cpi: c.actualCost === 0 ? null : earned / c.actualCost,
  };
}

export function jobMetrics(j: Job) {
  return {
    cpi: j.ev / j.ac,
    spi: j.ev / j.pv,
    percent: j.ev / j.budget,
    costVariance: j.ev - j.ac,
    /** Estimate at completion, assuming the current CPI holds. */
    eac: j.budget / (j.ev / j.ac),
  };
}

export type Health = "on-track" | "watch" | "at-risk";
export function health(index: number): Health {
  if (index >= 0.98) return "on-track";
  if (index >= 0.93) return "watch";
  return "at-risk";
}

export type PlanLine = {
  code: string;
  activity: string;
  location: string;
  qty: number;
  unit: string;
  crew: number;
  hours: number;
};

export const dailyPlan = {
  jobId: "cedar",
  date: PLAN_DATE,
  foreman: "Luis Ortega",
  crew: "Bridge Crew 2",
  weather: "Overcast, 54°F, 10% rain",
  lines: [
    {
      code: "04-210",
      activity: "Pour Pier 3 column, lift 2",
      location: "Pier 3",
      qty: 42,
      unit: "CY",
      crew: 6,
      hours: 10,
    },
    {
      code: "04-310",
      activity: "Tie column cage",
      location: "Pier 4",
      qty: 8_500,
      unit: "LB",
      crew: 4,
      hours: 10,
    },
    {
      code: "07-410",
      activity: "Dewatering watch, pump check",
      location: "Cofferdam B",
      qty: 1,
      unit: "DAY",
      crew: 1,
      hours: 10,
    },
  ] satisfies PlanLine[],
  equipment: [
    { name: "80-ton crawler crane", hours: 10 },
    { name: "Concrete pump, 38 m", hours: 6 },
    { name: "6 in trash pump (x2)", hours: 24 },
  ],
};

/** Planned man-hours per unit against the budgeted rate for the same cost code. */
export function planCheck(line: PlanLine) {
  const c = costCodes.find((x) => x.code === line.code);
  const manHours = line.crew * line.hours;
  const budgetRate: Record<string, number> = {
    "04-210": 1.6,
    "04-310": 0.0055,
    "07-410": 12,
  };
  const planned = manHours / line.qty;
  const budget = budgetRate[line.code] ?? planned;
  return {
    manHours,
    planned,
    budget,
    ok: planned <= budget * 1.05,
    description: c?.description ?? line.code,
  };
}

// Typed actions. The agent shell calls these by name; the screen shells call the same functions.
export const actions = {
  "portfolio.summary": () => jobs.map((j) => ({ job: j, ...jobMetrics(j) })),
  "job.costVariance": (jobId: string) => {
    if (jobId !== focusJobId) return [];
    return costCodes.map(costRow).sort((a, b) => a.variance - b.variance);
  },
  "dailyPlan.draft": () => ({
    ...dailyPlan,
    checks: dailyPlan.lines.map(planCheck),
  }),
} as const;

export type ActionName = keyof typeof actions;

export const usd = (n: number, digits = 0) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: digits,
  });
export const usdShort = (n: number) => {
  const a = Math.abs(n);
  const s =
    a >= 1e6
      ? `$${(a / 1e6).toFixed(1)}M`
      : a >= 1e3
        ? `$${Math.round(a / 1e3)}K`
        : `$${Math.round(a)}`;
  return n < 0 ? `−${s}` : s;
};
export const pct = (n: number) => `${Math.round(n * 100)}%`;
export const idx = (n: number | null) => (n === null ? "—" : n.toFixed(2));
export const qty = (n: number) =>
  n.toLocaleString("en-US", { maximumFractionDigits: 2 });

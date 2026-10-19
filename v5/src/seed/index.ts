// Deterministic demo seed: (companyId, today) -> rows. The same function seeds CI, staging and each visitor sandbox.
// Fictional company, people and jobs. Dates are relative to `today` so the demo never looks stale.
import { createHash } from "node:crypto";
import type {
  companies,
  costItems,
  dailyPlanLines,
  dailyPlans,
  jobs,
  users,
} from "@/db/schema";

export const SEED_COMPANY_NAME = "Summit Highway & Bridge";

type Insert<T extends { $inferInsert: unknown }> = T["$inferInsert"];

/** Stable UUID for a seeded row, so a reset recreates the same ids. */
export function seedId(companyId: string, key: string): string {
  const h = createHash("sha256").update(`${companyId}:${key}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-8${h.slice(13, 16)}-${((parseInt(h[16], 16) & 3) | 8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n));

export const seedUsers = [
  {
    key: "executive",
    role: "executive",
    name: "Elena Brooks",
    title: "VP Operations",
  },
  { key: "pm", role: "pm", name: "Marcus Lee", title: "Project Manager" },
  {
    key: "superintendent",
    role: "superintendent",
    name: "Ray Dominguez",
    title: "Superintendent",
  },
  {
    key: "foreman",
    role: "foreman",
    name: "Luis Ortega",
    title: "Foreman, Bridge Crew 2",
  },
] as const;

type ItemSpec = {
  code: string;
  description: string;
  unit: string;
  qty: number;
  budget: number; // dollars
  pct: number; // physical percent complete
  cpi: number; // earned / actual
  spi: number; // earned / planned
  mh: number; // budgeted man-hours per unit
};

const item = (
  code: string,
  description: string,
  unit: string,
  qty: number,
  budget: number,
  pct: number,
  cpi = 1,
  spi = 1,
  mh = 0,
): ItemSpec => ({ code, description, unit, qty, budget, pct, cpi, spi, mh });

const jobSpecs = [
  {
    key: "sr99",
    number: "24-118",
    name: "SR-99 / Airport Way Interchange",
    shortName: "SR-99 Interchange",
    owner: "State DOT, Region 2",
    pmName: "Dana Whitfield",
    finishDays: 300,
    contract: 48_600_000,
    items: [
      item("02-100", "Mobilization", "LS", 1, 1_900_000, 1, 1.02),
      item(
        "03-200",
        "Roadway excavation",
        "CY",
        182_000,
        4_550_000,
        0.92,
        1.08,
        1.02,
      ),
      item(
        "03-520",
        "Embankment in place",
        "CY",
        240_000,
        3_840_000,
        0.85,
        1.05,
        1.01,
      ),
      item("04-450", "Drilled shafts, 60 in", "LF", 2_600, 4_940_000, 1, 1.03),
      item(
        "05-110",
        "Bridge substructure concrete",
        "CY",
        3_900,
        5_460_000,
        0.88,
        1.02,
        1.02,
      ),
      item(
        "05-130",
        "Precast girders, set",
        "EA",
        64,
        6_080_000,
        0.5,
        1.06,
        1.0,
      ),
      item(
        "06-200",
        "Bridge deck concrete",
        "CY",
        2_700,
        3_510_000,
        0.3,
        1.0,
        0.98,
      ),
      item(
        "07-300",
        "Storm drain, 18-48 in",
        "LF",
        9_800,
        2_940_000,
        0.72,
        1.04,
        1.02,
      ),
      item("08-400", "HMA paving", "TON", 41_000, 4_100_000, 0.35, 1.05, 1.0),
      item("09-100", "Traffic control", "MO", 30, 1_380_000, 0.6, 1.02, 1.0),
      item("09-600", "Signals & lighting", "LS", 1, 2_200_000, 0.4, 1.01, 0.97),
      item("09-800", "Sign structures", "EA", 18, 2_300_000, 0.55, 1.07, 1.04),
    ],
  },
  {
    key: "cedar",
    number: "25-031",
    name: "Cedar Creek Bridge Replacement",
    shortName: "Cedar Creek Bridge",
    owner: "County Public Works",
    pmName: "Marcus Lee",
    finishDays: 390,
    contract: 14_600_000,
    items: [
      item("02-100", "Mobilization", "LS", 1, 640_000, 1, 0.98),
      item("02-220", "Clearing & grubbing", "AC", 4.2, 96_000, 1, 1.09),
      item(
        "03-310",
        "Structure excavation",
        "CY",
        6_800,
        418_000,
        0.9,
        0.93,
        1.02,
      ),
      item(
        "03-450",
        "Drilled shafts, 72 in",
        "LF",
        1_440,
        3_240_000,
        0.75,
        0.93,
        1.0,
      ),
      item("04-110", "Footing concrete", "CY", 1_150, 1_035_000, 1, 1.03),
      item(
        "04-210",
        "Pier column concrete",
        "CY",
        620,
        868_000,
        0.4,
        0.94,
        1.0,
        1.6,
      ),
      item(
        "04-310",
        "Reinforcing steel",
        "LB",
        412_000,
        906_400,
        0.45,
        0.95,
        1.02,
        0.0055,
      ),
      item("05-120", "Precast girders, set", "EA", 28, 2_380_000, 0),
      item("06-200", "Deck concrete", "CY", 1_380, 1_518_000, 0),
      item(
        "07-410",
        "Cofferdam & dewatering",
        "DAY",
        220,
        1_150_000,
        0.7,
        0.68,
        1.06,
        12,
      ),
      item("08-100", "Traffic control", "MO", 24, 432_000, 0.375, 0.89, 1.0),
      item(
        "09-500",
        "Erosion control & SWPPP",
        "LS",
        1,
        214_000,
        0.45,
        0.86,
        1.0,
      ),
    ],
  },
  {
    key: "i5",
    number: "24-077",
    name: "I-5 Culvert & Drainage Rehab",
    shortName: "I-5 Culverts",
    owner: "State DOT, Region 1",
    pmName: "Priya Natarajan",
    finishDays: 160,
    contract: 9_800_000,
    items: [
      item("02-100", "Mobilization", "LS", 1, 420_000, 1, 1.0),
      item(
        "03-210",
        "Trench excavation",
        "CY",
        21_000,
        840_000,
        0.9,
        1.03,
        0.9,
      ),
      item(
        "07-120",
        "Culvert, 72 in RCP",
        "LF",
        1_900,
        2_470_000,
        0.82,
        1.02,
        0.86,
      ),
      item(
        "07-150",
        "Culvert lining, CIPP",
        "LF",
        3_400,
        1_700_000,
        0.78,
        1.01,
        0.85,
      ),
      item(
        "07-300",
        "Catch basins & inlets",
        "EA",
        46,
        690_000,
        0.8,
        0.99,
        0.88,
      ),
      item(
        "07-500",
        "Headwalls & wingwalls",
        "EA",
        12,
        960_000,
        0.75,
        1.0,
        0.87,
      ),
      item(
        "08-200",
        "Pavement restoration",
        "SY",
        14_000,
        700_000,
        0.6,
        1.02,
        0.86,
      ),
      item("09-100", "Traffic control", "MO", 16, 520_000, 0.85, 1.0, 0.92),
      item(
        "09-500",
        "Erosion control & SWPPP",
        "LS",
        1,
        400_000,
        0.8,
        1.01,
        0.9,
      ),
    ],
  },
];

export type SeedRows = {
  company: Insert<typeof companies>;
  users: Insert<typeof users>[];
  jobs: Insert<typeof jobs>[];
  costItems: Insert<typeof costItems>[];
  dailyPlans: Insert<typeof dailyPlans>[];
  dailyPlanLines: Insert<typeof dailyPlanLines>[];
};

const cents = (dollars: number) => Math.round(dollars * 100);
const toMilli = (n: number) => Math.round(n * 1000);

export function seed(companyId: string, today: Date): SeedRows {
  const id = (key: string) => seedId(companyId, key);
  const out: SeedRows = {
    company: {
      id: companyId,
      name: SEED_COMPANY_NAME,
      isSandbox: true,
      seededAt: today,
    },
    users: seedUsers.map((u) => ({
      id: id(`user:${u.key}`),
      companyId,
      name: u.name,
      title: u.title,
      role: u.role,
    })),
    jobs: [],
    costItems: [],
    dailyPlans: [],
    dailyPlanLines: [],
  };

  for (const j of jobSpecs) {
    const jobId = id(`job:${j.key}`);
    out.jobs.push({
      id: jobId,
      companyId,
      number: j.number,
      name: j.name,
      shortName: j.shortName,
      owner: j.owner,
      pmName: j.pmName,
      finishOn: isoDate(addDays(today, j.finishDays)),
      contractCents: cents(j.contract),
    });
    for (const s of j.items) {
      const earned = cents(s.budget * s.pct);
      out.costItems.push({
        id: id(`cost:${j.key}:${s.code}`),
        companyId,
        jobId,
        code: s.code,
        description: s.description,
        unit: s.unit,
        budgetQtyMilli: toMilli(s.qty),
        installedQtyMilli: toMilli(s.qty * s.pct),
        budgetCents: cents(s.budget),
        plannedCents: Math.min(cents(s.budget), Math.round(earned / s.spi)),
        actualCents: Math.round(earned / s.cpi),
        budgetMhPerUnitMilli: toMilli(s.mh),
      });
    }
  }

  const planId = id("plan:cedar:tomorrow");
  const cost = (code: string) => id(`cost:cedar:${code}`);
  out.dailyPlans.push({
    id: planId,
    companyId,
    jobId: id("job:cedar"),
    crew: "Bridge Crew 2",
    foremanId: id("user:foreman"),
    planDate: isoDate(addDays(today, 1)),
    status: "draft",
    weather: "Overcast, 54°F, 10% rain",
    equipment: [
      { name: "80-ton crawler crane", hours: 10 },
      { name: "Concrete pump, 38 m", hours: 6 },
      { name: "6 in trash pump (x2)", hours: 24 },
    ],
  });
  const lines = [
    {
      code: "04-210",
      activity: "Pour Pier 3 column, lift 2",
      location: "Pier 3",
      qty: 42,
      workers: 6,
      hours: 10,
    },
    {
      code: "04-310",
      activity: "Tie column cage",
      location: "Pier 4",
      qty: 8_500,
      workers: 4,
      hours: 10,
    },
    {
      code: "07-410",
      activity: "Dewatering watch, pump check",
      location: "Cofferdam B",
      qty: 1,
      workers: 1,
      hours: 10,
    },
  ];
  lines.forEach((l, i) =>
    out.dailyPlanLines.push({
      id: id(`plan-line:cedar:${i}`),
      companyId,
      planId,
      costItemId: cost(l.code),
      activity: l.activity,
      location: l.location,
      qtyMilli: toMilli(l.qty),
      workers: l.workers,
      hoursTenths: l.hours * 10,
      sort: i,
    }),
  );
  return out;
}

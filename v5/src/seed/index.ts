// Deterministic demo seed: (companyId, today) -> rows. The same function seeds CI, staging and each visitor sandbox.
// Fictional company, people and jobs. Dates are relative to `today` so the demo never looks stale.
// EV is built forward: cost entries → AC, schedule dates → PV, locked progress claims → EV.
// Every material row is an explicit dated invoice — never budget×pct−labor. Schedules are fixed
// independently of physical % so PV is not forced equal to EV.
import type {
  actionRuns,
  changeOrderEvents,
  changeOrderLines,
  changeOrders,
  companies,
  costEntries,
  costItemMilestones,
  costItems,
  crews,
  dailyPlanEvents,
  dailyPlanLines,
  dailyPlans,
  jobs,
  milestoneLogs,
  pmPercentLogs,
  progressClaimLines,
  progressClaims,
  users,
} from "@/db/schema";
import { plugLabor, SHB_CSV, valueSetColumns } from "@/lib/budget";
import {
  insertColumns,
  parseEstimateCsv,
  reconcileByCode,
} from "@/lib/estimate-reconcile";
import {
  laborCents,
  plannedValueCents,
  snapshotClaimPercent,
  type EvMethod,
} from "@/lib/ev";
import { CREW_LABOR_RATE_CENTS } from "@/lib/crew-rates";
import {
  buildFieldHistory,
  type FieldHistoryItem,
  type FieldHistoryJob,
} from "./field-history";
import { finalizeSeedWithHistory } from "./finalize-history";
import { seedId } from "./ids";
import { seedStressJob } from "./stress";

export { seedId } from "./ids";

/** Job key → crew rate for historical labor cost_entries. */
const JOB_LABOR_RATE_CENTS: Record<string, number> = {
  sr99: CREW_LABOR_RATE_CENTS["Interchange Crew 1"],
  cedar: CREW_LABOR_RATE_CENTS["Bridge Crew 2"],
  i5: CREW_LABOR_RATE_CENTS["Culvert Crew A"],
};

const JOB_CREW_NAME: Record<string, keyof typeof CREW_LABOR_RATE_CENTS> = {
  sr99: "Interchange Crew 1",
  cedar: "Bridge Crew 2",
  i5: "Culvert Crew A",
};

export const SEED_COMPANY_NAME = "Summit Highway & Bridge";

type Insert<T extends { $inferInsert: unknown }> = T["$inferInsert"];

/** Stable UUID for a seeded row, so a reset recreates the same ids. */
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

/** Round-dollar material / equipment invoice posted on a past date. */
type InvoiceSpec = {
  dollars: number;
  note: string;
  daysAgo: number;
};

type ItemSpec = {
  code: string;
  description: string;
  unit: string;
  qty: number;
  budget: number; // dollars
  pct: number; // physical percent complete (drives the locked claim)
  /** Days before today planned work started — chosen independently of pct. */
  startAgo: number;
  /** Planned duration in days — chosen independently of pct. */
  spanDays: number;
  mh: number; // budgeted man-hours per unit
  method?: EvMethod;
  /** Explicit material / equipment invoices. Required when pct > 0. */
  invoices: InvoiceSpec[];
  /** Override crew hours; default is mh × installed qty. */
  laborHours?: number;
};

const COUNTED = new Set(["EA", "MO"]);

const item = (
  code: string,
  description: string,
  unit: string,
  qty: number,
  budget: number,
  pct: number,
  startAgo: number,
  spanDays: number,
  mh: number,
  invoices: InvoiceSpec[],
  method?: EvMethod,
): ItemSpec => ({
  code,
  description,
  unit,
  qty,
  budget,
  pct,
  startAgo,
  spanDays,
  mh,
  method,
  invoices,
});

/** Pick a measurement method from the work type when the spec does not name one. */
function methodOf(s: ItemSpec): EvMethod {
  if (s.method) return s.method;
  if (s.unit === "LS" && /mobilization/i.test(s.description))
    return "milestones";
  if (
    s.unit === "LS" ||
    /traffic control|signals|erosion|swppp/i.test(s.description)
  )
    return "pm_percent";
  return "units";
}

const cents = (dollars: number) => Math.round(dollars * 100);
const toMilli = (n: number) => Math.round(n * 1000);
const roundDollarCents = (dollars: number) => Math.round(dollars) * 100;

type InvoiceDraft = {
  amountCents: number;
  note: string;
  daysAgo: number;
};

type LaborTotals = {
  hoursTenths: number;
  rateCents: number;
  amountCents: number;
};

/**
 * Dated material / equipment / subcontract invoices only.
 * Labor posts from Part B daily-report history (not a single "Crew labor" row).
 * AC is invoices + history labor — never earned÷CPI and never budget×pct−labor.
 */
function draftInvoices(s: ItemSpec): InvoiceDraft[] {
  if (s.pct <= 0) return [];
  if (!s.invoices.length) {
    throw new Error(
      `seed: ${s.code} has progress but no invoices — refuse the AC=EV plug`,
    );
  }
  const drafts: InvoiceDraft[] = [];
  for (const inv of s.invoices) {
    if (inv.dollars === 0) continue;
    drafts.push({
      amountCents: roundDollarCents(inv.dollars),
      note: inv.note,
      daysAgo: Math.max(0, inv.daysAgo),
    });
  }
  return drafts;
}

/** Same hours tenths / amount math the pre-Part-B single labor row used. */
function laborTotalsForItem(
  s: ItemSpec,
  installed: number,
  rateCents: number,
): LaborTotals {
  const laborHours = s.laborHours ?? (s.mh > 0 ? s.mh * installed : 0);
  if (laborHours <= 0) {
    return { hoursTenths: 0, rateCents, amountCents: 0 };
  }
  const hoursTenths = Math.max(1, Math.round(laborHours * 10));
  return {
    hoursTenths,
    rateCents,
    amountCents: laborCents(hoursTenths / 10, rateCents),
  };
}

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
    estimateStatus: "approved" as const,
    // Healthy-ish job: invoices near but not equal to earned; schedules not pct-derived.
    items: [
      item("02-100", "Mobilization", "LS", 1, 1_900_000, 1, 160, 180, 0, [
        { dollars: 1_120_000, note: "Yard setup & crane pad", daysAgo: 140 },
        { dollars: 710_000, note: "Temp offices & utilities", daysAgo: 100 },
      ]),
      item("03-200", "Roadway excavation", "CY", 182_000, 4_550_000, 0.92, 200, 240, 0.012, [
        { dollars: 2_400_000, note: "Mass excavate subcontract", daysAgo: 90 },
        { dollars: 1_650_000, note: "Haul & disposal", daysAgo: 45 },
      ]),
      item("03-520", "Embankment in place", "CY", 240_000, 3_840_000, 0.85, 175, 220, 0.008, [
        { dollars: 1_900_000, note: "Borrow & place", daysAgo: 80 },
        { dollars: 1_250_000, note: "Compaction package", daysAgo: 35 },
      ]),
      item("04-450", "Drilled shafts, 60 in", "LF", 2_600, 4_940_000, 1, 220, 250, 0.4, [
        { dollars: 2_800_000, note: "Shaft drill & casing", daysAgo: 120 },
        { dollars: 1_900_000, note: "Concrete & slurry", daysAgo: 60 },
      ]),
      item(
        "05-110",
        "Bridge substructure concrete",
        "CY",
        3_900,
        5_460_000,
        0.88,
        190,
        230,
        1.2,
        [
          { dollars: 2_900_000, note: "Substructure forms", daysAgo: 100 },
          { dollars: 1_800_000, note: "Concrete supply", daysAgo: 40 },
        ],
      ),
      item("05-130", "Precast girders, set", "EA", 64, 6_080_000, 0.5, 90, 220, 8, [
        { dollars: 2_400_000, note: "Girder fabrication", daysAgo: 70 },
        { dollars: 980_000, note: "Set & diaphragm work", daysAgo: 25 },
      ]),
      item("06-200", "Bridge deck concrete", "CY", 2_700, 3_510_000, 0.3, 50, 200, 1.4, [
        { dollars: 720_000, note: "Deck forms & screed", daysAgo: 30 },
        { dollars: 410_000, note: "Deck concrete pours", daysAgo: 12 },
      ]),
      item("07-300", "Storm drain, 18-48 in", "LF", 9_800, 2_940_000, 0.72, 130, 210, 0.15, [
        { dollars: 1_450_000, note: "Pipe supply", daysAgo: 85 },
        { dollars: 780_000, note: "Install crew subcontract", daysAgo: 40 },
      ]),
      item("08-400", "HMA paving", "TON", 41_000, 4_100_000, 0.35, 55, 200, 0.05, [
        { dollars: 980_000, note: "Asphalt plant tickets", daysAgo: 28 },
        { dollars: 520_000, note: "Paving train", daysAgo: 14 },
      ]),
      item("09-100", "Traffic control", "MO", 30, 1_380_000, 0.6, 100, 220, 0, [
        { dollars: 520_000, note: "TCP devices & flagging", daysAgo: 60 },
        { dollars: 290_000, note: "Night premium shifts", daysAgo: 25 },
      ]),
      item("09-600", "Signals & lighting", "LS", 1, 2_200_000, 0.4, 70, 200, 0, [
        { dollars: 610_000, note: "Signal cabinets & poles", daysAgo: 45 },
        { dollars: 340_000, note: "Lighting conduit", daysAgo: 20 },
      ]),
      item("09-800", "Sign structures", "EA", 18, 2_300_000, 0.55, 95, 210, 12, [
        { dollars: 880_000, note: "Sign structure fab", daysAgo: 55 },
        { dollars: 420_000, note: "Erect & foundations", daysAgo: 22 },
      ]),
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
    estimateStatus: "approved" as const,
    // Over cost: generous equipment/material invoices. Schedules independent of pct.
    items: [
      item("02-100", "Mobilization", "LS", 1, 640_000, 1, 150, 170, 0, [
        { dollars: 420_000, note: "Mobilization package — crane & yard", daysAgo: 100 },
        { dollars: 245_000, note: "Temp facilities & barges", daysAgo: 80 },
      ]),
      item("02-220", "Clearing & grubbing", "AC", 4.2, 96_000, 1, 140, 160, 0, [
        { dollars: 72_000, note: "Clearing subcontract", daysAgo: 110 },
        { dollars: 38_000, note: "Haul-off & disposal", daysAgo: 95 },
      ]),
      item(
        "03-310",
        "Structure excavation",
        "CY",
        6_800,
        418_000,
        0.9,
        165,
        210,
        0,
        [
          { dollars: 280_000, note: "Excavator & trucking", daysAgo: 60 },
          { dollars: 165_000, note: "Spoils disposal", daysAgo: 40 },
        ],
      ),
      item(
        "03-450",
        "Drilled shafts, 72 in",
        "LF",
        1_440,
        3_240_000,
        0.75,
        140,
        210,
        0,
        [
          { dollars: 1_850_000, note: "Shaft drill & casing", daysAgo: 70 },
          { dollars: 920_000, note: "Concrete & slurry", daysAgo: 45 },
        ],
      ),
      item("04-110", "Footing concrete", "CY", 1_150, 1_035_000, 1, 170, 190, 0, [
        { dollars: 620_000, note: "Footing concrete supply", daysAgo: 90 },
        { dollars: 480_000, note: "Formwork & pump", daysAgo: 70 },
      ]),
      item(
        "04-210",
        "Pier column concrete",
        "CY",
        620,
        868_000,
        0.4,
        95,
        210,
        1.6,
        [
          { dollars: 310_000, note: "Column forms & bracing", daysAgo: 35 },
          { dollars: 195_000, note: "Concrete supply — pier pours", daysAgo: 20 },
        ],
      ),
      item(
        "04-310",
        "Reinforcing steel",
        "LB",
        412_000,
        906_400,
        0.45,
        105,
        210,
        0.0055,
        [
          { dollars: 380_000, note: "Rebar mill delivery", daysAgo: 50 },
          { dollars: 210_000, note: "Tie wire & accessories", daysAgo: 30 },
        ],
      ),
      item("05-120", "Precast girders, set", "EA", 28, 2_380_000, 0, 0, 180, 0, []),
      item("06-200", "Deck concrete", "CY", 1_380, 1_518_000, 0, 0, 160, 0, []),
      item(
        "07-410",
        "Cofferdam & dewatering",
        "DAY",
        220,
        1_150_000,
        0.7,
        130,
        230,
        12,
        [
          { dollars: 520_000, note: "Sheet pile rental", daysAgo: 80 },
          { dollars: 410_000, note: "Pump package & fuel", daysAgo: 40 },
          { dollars: 280_000, note: "Emergency flood watch overtime", daysAgo: 15 },
        ],
      ),
      item(
        "08-100",
        "Traffic control",
        "MO",
        24,
        432_000,
        0.375,
        85,
        210,
        0,
        [
          { dollars: 210_000, note: "TCP devices & flagging", daysAgo: 40 },
          { dollars: 95_000, note: "Night shift premium", daysAgo: 20 },
        ],
      ),
      item(
        "09-500",
        "Erosion control & SWPPP",
        "LS",
        1,
        214_000,
        0.45,
        100,
        210,
        0,
        [
          { dollars: 145_000, note: "SWPPP install & maintenance", daysAgo: 55 },
          { dollars: 72_000, note: "Storm repair extras", daysAgo: 25 },
        ],
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
    estimateStatus: "approved" as const,
    // Behind schedule: calendars well ahead of physical % (PV >> EV). Dated invoices ≠ earned.
    items: [
      item("02-100", "Mobilization", "LS", 1, 420_000, 1, 110, 130, 0, [
        { dollars: 250_000, note: "Mobilization — yard & trailers", daysAgo: 90 },
        { dollars: 145_000, note: "Temp access & staging", daysAgo: 70 },
      ]),
      item("03-210", "Trench excavation", "CY", 21_000, 840_000, 0.9, 155, 165, 0.1, [
        { dollars: 480_000, note: "Trench excavate & shoring", daysAgo: 50 },
        { dollars: 220_000, note: "Spoils haul", daysAgo: 25 },
      ]),
      item("07-120", "Culvert, 72 in RCP", "LF", 1_900, 2_470_000, 0.82, 150, 165, 0.8, [
        { dollars: 1_350_000, note: "RCP supply", daysAgo: 70 },
        { dollars: 620_000, note: "Install & bedding", daysAgo: 30 },
      ]),
      item("07-150", "Culvert lining, CIPP", "LF", 3_400, 1_700_000, 0.78, 148, 165, 0.3, [
        { dollars: 900_000, note: "CIPP liner material", daysAgo: 55 },
        { dollars: 410_000, note: "Cure crew", daysAgo: 20 },
      ]),
      item("07-300", "Catch basins & inlets", "EA", 46, 690_000, 0.8, 145, 165, 6, [
        { dollars: 340_000, note: "Precast basins", daysAgo: 60 },
        { dollars: 210_000, note: "Set & connect", daysAgo: 28 },
      ]),
      item("07-500", "Headwalls & wingwalls", "EA", 12, 960_000, 0.75, 142, 165, 18, [
        { dollars: 480_000, note: "Headwall forms & rebar", daysAgo: 55 },
        { dollars: 250_000, note: "Concrete pours", daysAgo: 22 },
      ]),
      item("08-200", "Pavement restoration", "SY", 14_000, 700_000, 0.6, 135, 165, 0.08, [
        { dollars: 280_000, note: "Base & binder", daysAgo: 40 },
        { dollars: 160_000, note: "Surface course", daysAgo: 15 },
      ]),
      item("09-100", "Traffic control", "MO", 16, 520_000, 0.85, 140, 165, 0, [
        { dollars: 280_000, note: "TCP devices & flagging", daysAgo: 50 },
        { dollars: 150_000, note: "Night closures", daysAgo: 18 },
      ]),
      item("09-500", "Erosion control & SWPPP", "LS", 1, 400_000, 0.8, 138, 165, 0, [
        { dollars: 210_000, note: "SWPPP install", daysAgo: 65 },
        { dollars: 115_000, note: "Maintenance & repairs", daysAgo: 25 },
      ]),
    ],
  },
];

/**
 * Approved (live) jobs in the seed. Harbor 26-010 is a separate draft estimate
 * and is not counted. Login copy and portfolio "active jobs" must agree with this.
 */
export const SEED_ACTIVE_JOB_COUNT = jobSpecs.filter(
  (j) => j.estimateStatus === "approved",
).length;

export type SeedRows = {
  company: Insert<typeof companies>;
  users: Insert<typeof users>[];
  jobs: Insert<typeof jobs>[];
  costItems: Insert<typeof costItems>[];
  costItemMilestones: Insert<typeof costItemMilestones>[];
  costEntries: Insert<typeof costEntries>[];
  pmPercentLogs: Insert<typeof pmPercentLogs>[];
  milestoneLogs: Insert<typeof milestoneLogs>[];
  progressClaims: Insert<typeof progressClaims>[];
  progressClaimLines: Insert<typeof progressClaimLines>[];
  crews: Insert<typeof crews>[];
  dailyPlans: Insert<typeof dailyPlans>[];
  dailyPlanEvents: Insert<typeof dailyPlanEvents>[];
  dailyPlanLines: Insert<typeof dailyPlanLines>[];
  /** Post-history change orders (baked by finalizeSeedWithHistory). */
  changeOrders: Insert<typeof changeOrders>[];
  changeOrderLines: Insert<typeof changeOrderLines>[];
  changeOrderEvents: Insert<typeof changeOrderEvents>[];
  /** Post-history action_runs (same summaries as live seedActionHistory). */
  actionRuns: Insert<typeof actionRuns>[];
};

/**
 * Tables insertWork writes after users. Stress / optional patches must go
 * through appendWorkSeed so a new table cannot be forgotten on one path.
 */
export const WORK_SEED_KEYS = [
  "jobs",
  "costItems",
  "costItemMilestones",
  "costEntries",
  "pmPercentLogs",
  "milestoneLogs",
  "progressClaims",
  "progressClaimLines",
  "crews",
  "dailyPlans",
  "dailyPlanEvents",
  "dailyPlanLines",
  "changeOrders",
  "changeOrderLines",
  "changeOrderEvents",
  "actionRuns",
] as const satisfies readonly (keyof SeedRows)[];

export type WorkSeedPatch = Partial<
  Pick<SeedRows, (typeof WORK_SEED_KEYS)[number]>
>;

/** Merge optional work rows into a seed bag. Used by V5_SEED_STRESS and tests. */
export function appendWorkSeed(out: SeedRows, patch: WorkSeedPatch) {
  for (const key of WORK_SEED_KEYS) {
    const rows = patch[key];
    if (rows && rows.length > 0) {
      (out[key] as unknown[]).push(...(rows as unknown[]));
    }
  }
}

export function seed(companyId: string, today: Date): SeedRows {
  const id = (key: string) => seedId(companyId, key);
  const pmId = id("user:pm");
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
    costItemMilestones: [],
    costEntries: [],
    pmPercentLogs: [],
    milestoneLogs: [],
    progressClaims: [],
    progressClaimLines: [],
    crews: [],
    dailyPlans: [],
    dailyPlanEvents: [],
    dailyPlanLines: [],
    changeOrders: [],
    changeOrderLines: [],
    changeOrderEvents: [],
    actionRuns: [],
  };

  const foremanId = id("user:foreman");
  const superintendentId = id("user:superintendent");
  const bridgeCrewId = id("crew:bridge-2");
  const culvertCrewId = id("crew:culvert-a");
  const interchangeCrewId = id("crew:interchange-1");
  const fieldJobs: FieldHistoryJob[] = [];
  const fieldItems: FieldHistoryItem[] = [];
  out.crews.push(
    {
      id: bridgeCrewId,
      companyId,
      name: "Bridge Crew 2",
      foremanId,
      laborRateCents: CREW_LABOR_RATE_CENTS["Bridge Crew 2"],
    },
    {
      id: culvertCrewId,
      companyId,
      name: "Culvert Crew A",
      foremanId,
      laborRateCents: CREW_LABOR_RATE_CENTS["Culvert Crew A"],
    },
    {
      id: interchangeCrewId,
      companyId,
      name: "Interchange Crew 1",
      foremanId,
      laborRateCents: CREW_LABOR_RATE_CENTS["Interchange Crew 1"],
    },
  );

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
      estimateStatus: j.estimateStatus,
    });

    // Period 1 starts as a draft. finalizeSeedWithHistory locks approved jobs
    // (and writes the matching progressClaim.lock action_runs) so every job's
    // change list has the same audit row the live path produced.
    const claimId = id(`claim:${j.key}:period-1`);
    out.progressClaims.push({
      id: claimId,
      companyId,
      jobId,
      periodLabel: "Period 1",
      status: "draft",
      lockedAt: null,
      lockedById: null,
    });

    for (const s of j.items) {
      const method = methodOf(s);
      const budgetCents = cents(s.budget);
      // Lump seed job (estimate_source = seed): the total is plugged into labor, so the split is not real.
      const cats = plugLabor(budgetCents);
      const values = valueSetColumns(cats, "approved");
      const targetPctMilli = Math.round(s.pct * 1000);
      const installed = COUNTED.has(s.unit)
        ? Math.round(s.qty * s.pct)
        : s.qty * s.pct;
      const installedMilli = toMilli(installed);
      const start = isoDate(addDays(today, -s.startAgo));
      const finish = isoDate(addDays(today, -s.startAgo + s.spanDays));
      const plannedCents = plannedValueCents(budgetCents, start, finish, today);

      const rateCents = JOB_LABOR_RATE_CENTS[j.key];
      if (rateCents == null) {
        throw new Error(`seed: no crew labor rate for job ${j.key}`);
      }
      const invoiceDrafts = draftInvoices(s);
      const labor = laborTotalsForItem(s, installed, rateCents);
      const invoiceCents = invoiceDrafts.reduce((a, d) => a + d.amountCents, 0);
      const actualCents = invoiceCents + labor.amountCents;

      let milestoneCompleteWeightMilli = 0;
      const milestones: {
        name: string;
        weightMilli: number;
        complete: boolean;
      }[] = [];
      if (method === "milestones") {
        // Two equal weights: "in" then "complete". pct 1 → both done; 0.5 → in only.
        const inDone = s.pct >= 0.5;
        const doneDone = s.pct >= 1;
        milestones.push(
          { name: "Mobilization in", weightMilli: 500, complete: inDone },
          { name: "Mobilization complete", weightMilli: 500, complete: doneDone },
        );
        milestoneCompleteWeightMilli = milestones
          .filter((m) => m.complete)
          .reduce((a, m) => a + m.weightMilli, 0);
        milestones.forEach((m, i) =>
          out.costItemMilestones.push({
            id: id(`ms:${j.key}:${s.code}:${i}`),
            companyId,
            costItemId: id(`cost:${j.key}:${s.code}`),
            name: m.name,
            weightMilli: m.weightMilli,
            complete: m.complete,
            sort: i,
          }),
        );
      }

      let pmPercentMilli = 0;
      if (method === "pm_percent") {
        pmPercentMilli = targetPctMilli;
        out.pmPercentLogs.push({
          id: id(`pmlog:${j.key}:${s.code}`),
          companyId,
          costItemId: id(`cost:${j.key}:${s.code}`),
          userId: pmId,
          percentMilli: pmPercentMilli,
          reason:
            s.pct >= 1
              ? "Work complete per field walk."
              : s.pct === 0
                ? "Not started."
                : "Field progress per last superintendent walkthrough.",
          at: today,
        });
      }

      const snap = snapshotClaimPercent({
        method,
        budgetQtyMilli: toMilli(s.qty),
        installedQtyMilli: method === "units" ? installedMilli : 0,
        unit: s.unit,
        milestoneCompleteWeightMilli,
        pmPercentMilli,
        milestones,
      });
      const claimedPercentMilli =
        method === "units" ? snap.percentMilli : targetPctMilli;
      const derivation =
        method === "units"
          ? snap.derivation
          : method === "milestones"
            ? snapshotClaimPercent({
                method,
                budgetQtyMilli: toMilli(s.qty),
                installedQtyMilli: 0,
                unit: s.unit,
                milestoneCompleteWeightMilli,
                pmPercentMilli: 0,
                milestones,
              }).derivation
            : `${snap.derivation} — Marcus Lee: ${
                out.pmPercentLogs.find(
                  (l) => l.id === id(`pmlog:${j.key}:${s.code}`),
                )?.reason ?? ""
              }`;

      const costItemId = id(`cost:${j.key}:${s.code}`);
      const claimedInstalled =
        method === "units" ? installedMilli : 0;
      out.costItems.push({
        id: costItemId,
        companyId,
        jobId,
        parentId: null,
        path: `/${s.code}/`,
        depth: 0,
        isLeaf: true,
        code: s.code,
        description: s.description,
        unit: s.unit,
        evMethod: method,
        budgetQtyMilli: toMilli(s.qty),
        installedQtyMilli: claimedInstalled,
        claimedInstalledQtyMilli: claimedInstalled,
        ...values,
        plannedStartOn: start,
        plannedFinishOn: finish,
        plannedCents,
        actualCents,
        // Pre-freeze AC so Period 1 lock (via finalizeSeedWithHistory) is a
        // no-op on money indices.
        lockedActualCents: actualCents,
        forecastMethod: "current_budget" as const,
        claimedPercentMilli,
        // Claimed % matches field state so the Period 1 lock is a no-op on numbers.
        earnDerivation: derivation,
        budgetMhPerUnitMilli: toMilli(s.mh),
      });

      invoiceDrafts.forEach((d, i) => {
        out.costEntries.push({
          id: id(`ce:${j.key}:${s.code}:${i}`),
          companyId,
          costItemId,
          kind: "other",
          amountCents: d.amountCents,
          note: d.note,
          at: addDays(today, -d.daysAgo),
        });
      });

      // Field-history labor rows are appended after all items exist.
      if (labor.hoursTenths > 0 || (method === "units" && installedMilli > 0)) {
        fieldItems.push({
          jobKey: j.key,
          code: s.code,
          costItemId,
          description: s.description,
          unit: s.unit,
          evMethod: method,
          plannedStartOn: start,
          plannedFinishOn: finish,
          installedMilli: method === "units" ? installedMilli : 0,
          hoursTenths: labor.hoursTenths,
          rateCents: labor.rateCents,
          laborAmountCents: labor.amountCents,
        });
      }

      out.progressClaimLines.push({
        id: id(`claim-line:${j.key}:${s.code}`),
        companyId,
        claimId,
        costItemId,
        claimedPercentMilli,
        installedQtyMilli: claimedInstalled,
        derivation,
      });
    }

    const crewName = JOB_CREW_NAME[j.key];
    if (!crewName) throw new Error(`seed: no crew name for job ${j.key}`);
    const crewId =
      j.key === "cedar"
        ? bridgeCrewId
        : j.key === "i5"
          ? culvertCrewId
          : interchangeCrewId;
    fieldJobs.push({
      key: j.key,
      id: jobId,
      crew: { id: crewId, name: crewName },
    });
  }

  // Draft estimate job, seeded through the CSV import pipeline from the SHB fixture
  // ($86,750.00 / 304 MH, docs/v5/intel/estimate-to-budget.md): CE filled, OB/CB zero until Approve.
  {
    const jobId = id("job:harbor");
    const start = isoDate(addDays(today, -14));
    const finish = isoDate(addDays(today, 200));
    out.jobs.push({
      id: jobId,
      companyId,
      number: "26-010",
      name: "Harbor Side Abutment — Phase 1",
      shortName: "Harbor Abutment",
      owner: "City Port Authority",
      pmName: "Marcus Lee",
      finishOn: isoDate(addDays(today, 240)),
      contractCents: cents(2_400_000),
      estimateStatus: "draft",
      estimateSource: "csv",
    });

    const parsed = parseEstimateCsv(SHB_CSV);
    const diff = parsed.ok ? reconcileByCode([], parsed.forest) : null;
    if (!diff?.ok) throw new Error("seed: SHB_CSV must import onto an empty job");
    const costId = (code: string) => id(`cost:harbor:${code}`);
    const harborClaimId = id("claim:harbor:period-1");
    // Draft Period 1 claim (Harbor stays unlocked — estimate not approved).
    out.progressClaims.push({
      id: harborClaimId,
      companyId,
      jobId,
      periodLabel: "Period 1",
      status: "draft",
      lockedAt: null,
      lockedById: null,
    });
    for (const step of diff.plan.steps) {
      if (step.kind !== "insert") continue;
      out.costItems.push({
        id: costId(step.code),
        companyId,
        jobId,
        parentId: step.parentCode ? costId(step.parentCode) : null,
        plannedStartOn: start,
        plannedFinishOn: finish,
        ...insertColumns(step),
      });
      if (!step.isLeaf) continue;
      out.progressClaimLines.push({
        id: id(`claim-line:harbor:${step.code}`),
        companyId,
        claimId: harborClaimId,
        costItemId: costId(step.code),
        claimedPercentMilli: 0,
        installedQtyMilli: 0,
        derivation: "Draft estimate — approve before locking progress",
      });
    }
  }

  // 30 working days of approved field history (labor cost_entries + plans).
  {
    const hist = buildFieldHistory({
      companyId,
      today,
      id,
      jobs: fieldJobs,
      items: fieldItems,
      foremanId,
      superintendentId,
    });
    out.dailyPlans.push(...hist.dailyPlans);
    out.dailyPlanEvents.push(...hist.dailyPlanEvents);
    out.dailyPlanLines.push(...hist.dailyPlanLines);
    out.costEntries.push(...hist.costEntries);
  }

  const planId = id("plan:cedar:tomorrow");
  const cost = (code: string) => id(`cost:cedar:${code}`);
  const tomorrowCreatedAt = new Date(
    `${isoDate(addDays(today, 1))}T06:00:00.000Z`,
  );
  out.dailyPlans.push({
    id: planId,
    companyId,
    jobId: id("job:cedar"),
    crew: "Bridge Crew 2",
    crewId: bridgeCrewId,
    foremanId,
    planDate: isoDate(addDays(today, 1)),
    status: "draft",
    weather: "Overcast, 54°F, 10% rain",
    equipment: [
      { name: "80-ton crawler crane", hours: 10 },
      { name: "Concrete pump, 38 m", hours: 6 },
      { name: "6 in trash pump (x2)", hours: 24 },
    ],
    createdById: foremanId,
    createdAt: tomorrowCreatedAt,
  });
  out.dailyPlanEvents.push({
    id: id("plan-event:cedar:tomorrow:created"),
    companyId,
    planId,
    kind: "created",
    actorRole: "superintendent",
    actorId: superintendentId,
    detail: "",
    at: tomorrowCreatedAt,
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

  // Today's draft on I-5 — finalizeSeedWithHistory issues, reports, and returns it.
  // Cedar's tomorrow Bridge Crew 2 draft stays for the foreman "Submit tomorrow's plan" rail.
  {
    const i5PlanId = id("plan:i5:today");
    const i5Cost = (code: string) => id(`cost:i5:${code}`);
    out.dailyPlans.push({
      id: i5PlanId,
      companyId,
      jobId: id("job:i5"),
      crew: "Culvert Crew A",
      crewId: culvertCrewId,
      foremanId,
      planDate: isoDate(today),
      status: "draft",
      weather: "Clear, 62°F, 5% rain",
      equipment: [
        { name: "Excavator 320", hours: 10 },
        { name: "18 in trash pump", hours: 10 },
      ],
      createdById: foremanId,
    });
    const i5Lines = [
      {
        code: "03-210",
        activity: "Trench excavation, station 42+00",
        location: "Culvert 7 approach",
        qty: 180,
        workers: 4,
        hours: 10,
      },
      {
        code: "07-120",
        activity: "Set 72 in RCP, bedding",
        location: "Culvert 7",
        qty: 48,
        workers: 5,
        hours: 10,
      },
      {
        code: "07-300",
        activity: "Set catch basins CB-12, CB-13",
        location: "East shoulder",
        qty: 2,
        workers: 2,
        hours: 10,
      },
    ];
    i5Lines.forEach((l, i) =>
      out.dailyPlanLines.push({
        id: id(`plan-line:i5:${i}`),
        companyId,
        planId: i5PlanId,
        costItemId: i5Cost(l.code),
        activity: l.activity,
        location: l.location,
        qtyMilli: toMilli(l.qty),
        workers: l.workers,
        hoursTenths: l.hours * 10,
        sort: i,
      }),
    );
  }

  // Period 2 drafts, COs, I-5 cycle, and action_runs — same end state as the
  // former live seedActionHistory path, without hundreds of SQL round-trips.
  finalizeSeedWithHistory(out, companyId, today);

  // Optional 10k WBS for local/perf only. Do not set V5_SEED_STRESS on the
  // Playwright webServer — e2e stress specs call ensureStressJob instead so
  // default sandboxes and Reset demo stay fast.
  if (process.env.V5_SEED_STRESS === "1") {
    appendWorkSeed(out, seedStressJob(companyId, today));
  }

  return out;
}

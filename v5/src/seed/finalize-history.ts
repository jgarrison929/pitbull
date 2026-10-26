/**
 * Bake the post–seedActionHistory demo state into the pure seed bag.
 *
 * Live typed-action history (24 run() calls) is ~400 SQL round-trips — fine
 * locally, multi-second on Railway. createSandbox / resetSandbox insert this
 * finalized bag in one pipelined transaction instead. Summaries, statuses, and
 * money match the live path; ids are deterministic seedIds.
 */
import type {
  actionRuns,
  changeOrderEvents,
  changeOrderLines,
  changeOrders,
  costItems,
  progressClaimLines,
  progressClaims,
} from "@/db/schema";
import { coLabel } from "@/lib/change-order";
import { snapshotClaimPercent } from "@/lib/ev";
import { addCalendarDays, calendarDateInTz } from "@/lib/plan-date";
import { seedId } from "./ids";
import type { SeedRows } from "./index";

type Insert<T extends { $inferInsert: unknown }> = T["$inferInsert"];

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

/** Jobs that Period 1 lock covers (Harbor stays draft/unlocked). */
const LOCK_JOB_KEYS = ["sr99", "cedar", "i5"] as const;

type CoSpec = {
  key: string;
  jobKey: (typeof LOCK_JOB_KEYS)[number] | "harbor";
  number: number;
  title: string;
  reason: string;
  status: "draft" | "priced" | "approved" | "rejected" | "voided";
  revision: number;
  line?: {
    code: string;
    description: string;
    unit: string;
    laborCents: number;
    materialCents: number;
    equipmentCents: number;
    subCents: number;
  };
  events: {
    command: "create" | "price" | "approve" | "reject" | "void";
    fromStatus: "draft" | "priced" | null;
    toStatus: "draft" | "priced" | "approved" | "rejected" | "voided";
    revision: number;
    actor: "pm" | "executive";
    reason: string;
    totalCents: number;
    cbDeltaCents: number | null;
    eacDeltaCents: number | null;
  }[];
};

const CO_SPECS: CoSpec[] = [
  {
    key: "cedar:1",
    jobKey: "cedar",
    number: 1,
    title: "Owner-added retaining wall, north approach",
    reason: "County directive CD-07",
    status: "priced",
    revision: 1,
    line: {
      code: "91-100",
      description: "Retaining wall, north approach",
      unit: "LS",
      laborCents: 1_850_000,
      materialCents: 2_325_000,
      equipmentCents: 610_000,
      subCents: 1_215_000,
    },
    events: [
      {
        command: "create",
        fromStatus: null,
        toStatus: "draft",
        revision: 0,
        actor: "pm",
        reason: "County directive CD-07",
        totalCents: 0,
        cbDeltaCents: null,
        eacDeltaCents: null,
      },
      {
        command: "price",
        fromStatus: "draft",
        toStatus: "priced",
        revision: 1,
        actor: "pm",
        reason: "",
        totalCents: 6_000_000,
        cbDeltaCents: null,
        eacDeltaCents: null,
      },
    ],
  },
  {
    key: "sr99:1",
    jobKey: "sr99",
    number: 1,
    title: "Temp access road grading",
    reason: "Owner asked for a haul route around the abutment",
    status: "draft",
    revision: 0,
    events: [
      {
        command: "create",
        fromStatus: null,
        toStatus: "draft",
        revision: 0,
        actor: "pm",
        reason: "Owner asked for a haul route around the abutment",
        totalCents: 0,
        cbDeltaCents: null,
        eacDeltaCents: null,
      },
    ],
  },
  {
    key: "sr99:2",
    jobKey: "sr99",
    number: 2,
    title: "Abutment formwork revise",
    reason: "Shop drawing conflict SF-14",
    status: "rejected",
    revision: 1,
    line: {
      code: "91-210",
      description: "Formwork revise, west wing",
      unit: "LS",
      laborCents: 420_000,
      materialCents: 180_000,
      equipmentCents: 0,
      subCents: 0,
    },
    events: [
      {
        command: "create",
        fromStatus: null,
        toStatus: "draft",
        revision: 0,
        actor: "pm",
        reason: "Shop drawing conflict SF-14",
        totalCents: 0,
        cbDeltaCents: null,
        eacDeltaCents: null,
      },
      {
        command: "price",
        fromStatus: "draft",
        toStatus: "priced",
        revision: 1,
        actor: "pm",
        reason: "",
        totalCents: 600_000,
        cbDeltaCents: null,
        eacDeltaCents: null,
      },
      {
        command: "reject",
        fromStatus: "priced",
        toStatus: "rejected",
        revision: 1,
        actor: "executive",
        reason: "Owner declined the formwork change",
        totalCents: 600_000,
        cbDeltaCents: null,
        eacDeltaCents: null,
      },
    ],
  },
  {
    key: "sr99:3",
    jobKey: "sr99",
    number: 3,
    title: "Temp cofferdam at pier 2",
    reason: "River rose; need a temporary cofferdam",
    status: "approved",
    revision: 1,
    line: {
      code: "91-300",
      description: "Temp cofferdam at pier 2",
      unit: "LS",
      laborCents: 800_000,
      materialCents: 1_250_000,
      equipmentCents: 350_000,
      subCents: 0,
    },
    events: [
      {
        command: "create",
        fromStatus: null,
        toStatus: "draft",
        revision: 0,
        actor: "pm",
        reason: "River rose; need a temporary cofferdam",
        totalCents: 0,
        cbDeltaCents: null,
        eacDeltaCents: null,
      },
      {
        command: "price",
        fromStatus: "draft",
        toStatus: "priced",
        revision: 1,
        actor: "pm",
        reason: "",
        totalCents: 2_400_000,
        cbDeltaCents: null,
        eacDeltaCents: null,
      },
      {
        command: "approve",
        fromStatus: "priced",
        toStatus: "approved",
        revision: 1,
        actor: "executive",
        reason: "",
        totalCents: 2_400_000,
        cbDeltaCents: 2_400_000,
        eacDeltaCents: 2_400_000,
      },
    ],
  },
  {
    key: "i5:1",
    jobKey: "i5",
    number: 1,
    title: "Duplicate field note pile tip",
    reason: "Opened by mistake — same as yesterday's note",
    status: "voided",
    revision: 0,
    events: [
      {
        command: "create",
        fromStatus: null,
        toStatus: "draft",
        revision: 0,
        actor: "pm",
        reason: "Opened by mistake — same as yesterday's note",
        totalCents: 0,
        cbDeltaCents: null,
        eacDeltaCents: null,
      },
      {
        command: "void",
        fromStatus: "draft",
        toStatus: "voided",
        revision: 0,
        actor: "pm",
        reason: "Duplicate of the field note",
        totalCents: 0,
        cbDeltaCents: null,
        eacDeltaCents: null,
      },
    ],
  },
  {
    key: "i5:2",
    jobKey: "i5",
    number: 2,
    title: "Guardrail extension east approach",
    reason: "Owner added 120 LF of guardrail",
    status: "priced",
    revision: 1,
    line: {
      code: "91-400",
      description: "Guardrail extension east approach",
      unit: "LS",
      laborCents: 220_000,
      materialCents: 680_000,
      equipmentCents: 0,
      subCents: 150_000,
    },
    events: [
      {
        command: "create",
        fromStatus: null,
        toStatus: "draft",
        revision: 0,
        actor: "pm",
        reason: "Owner added 120 LF of guardrail",
        totalCents: 0,
        cbDeltaCents: null,
        eacDeltaCents: null,
      },
      {
        command: "price",
        fromStatus: "draft",
        toStatus: "priced",
        revision: 1,
        actor: "pm",
        reason: "",
        totalCents: 1_050_000,
        cbDeltaCents: null,
        eacDeltaCents: null,
      },
    ],
  },
];

const dayLabel = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

/** Exact action_runs the live seedActionHistory path writes (order = rail order). */
function actionRunSpecs(today: Date, id: (k: string) => string) {
  const foreman = id("user:foreman");
  const pm = id("user:pm");
  const executive = id("user:executive");
  const superintendent = id("user:superintendent");
  const todayIso = calendarDateInTz(today);
  const tomorrowIso = addCalendarDays(todayIso, 1);
  const todayDay = dayLabel(todayIso);
  const tomorrowDay = dayLabel(tomorrowIso);
  type Run = {
    userId: string;
    prompt: string;
    action: string;
    summary: string;
    args: Record<string, unknown>;
  };
  const runs: Run[] = [
    {
      userId: foreman,
      prompt: "Add a note on the pour: forms checked, ready for concrete",
      action: "dailyPlan.updateLine",
      summary:
        "Changed 04-210 Pour Pier 3 column, lift 2 on Bridge Crew 2's plan: note \"Forms checked — ready for concrete.\"",
      args: {
        requested: "25-031",
        job: "25-031",
        line: "04-210",
        href: "/app/jobs/25-031",
      },
    },
    {
      userId: pm,
      prompt: "Import the estimate CSV for Harbor Abutment",
      action: "estimate.importCsv",
      summary:
        "Imported the estimate on Harbor Abutment: Current Estimate $86,750.00 across 4 leaves, 6 cost items, 304.0 MH. 0 updated, 0 added, 0 removed, 6 unchanged. Approve freezes it as Original Budget.",
      args: {
        requested: "26-010",
        job: "26-010",
        href: "/app/jobs/26-010",
      },
    },
    {
      userId: pm,
      prompt:
        "Raise a change order on 25-031: Owner-added retaining wall, north approach",
      action: "changeOrder.create",
      summary:
        'Raised CO-001 on Cedar Creek Bridge: "Owner-added retaining wall, north approach". Draft. Price it per cost item; nothing moves until a PM or executive approves it.',
      args: {
        requested: "25-031",
        job: "25-031",
        href: "/app/jobs/25-031#change-orders",
      },
    },
    {
      userId: pm,
      prompt:
        "Price CO-001 on 25-031: new 91-100 Retaining wall LS labor 18,500 material 23,250 equipment 6,100 sub 12,150",
      action: "changeOrder.price",
      summary:
        "Priced CO-001 on Cedar Creek Bridge (rev 1): $60,000.00 across 1 line. Pending PM or executive approval, not in Current Budget or EAC.",
      args: {
        requested: "25-031",
        job: "25-031",
        href: "/app/jobs/25-031#change-orders",
      },
    },
    {
      userId: pm,
      prompt: "Raise a change order on 24-118: Temp access road grading",
      action: "changeOrder.create",
      summary:
        'Raised CO-001 on SR-99 Interchange: "Temp access road grading". Draft. Price it per cost item; nothing moves until a PM or executive approves it.',
      args: {
        requested: "24-118",
        job: "24-118",
        href: "/app/jobs/24-118#change-orders",
      },
    },
    {
      userId: pm,
      prompt: "Raise a change order on 24-118: Abutment formwork revise",
      action: "changeOrder.create",
      summary:
        'Raised CO-002 on SR-99 Interchange: "Abutment formwork revise". Draft. Price it per cost item; nothing moves until a PM or executive approves it.',
      args: {
        requested: "24-118",
        job: "24-118",
        href: "/app/jobs/24-118#change-orders",
      },
    },
    {
      userId: pm,
      prompt:
        "Price CO-002 on 24-118: new 91-210 Formwork revise LS labor 4,200 material 1,800",
      action: "changeOrder.price",
      summary:
        "Priced CO-002 on SR-99 Interchange (rev 1): $6,000.00 across 1 line. Pending PM or executive approval, not in Current Budget or EAC.",
      args: {
        requested: "24-118",
        job: "24-118",
        href: "/app/jobs/24-118#change-orders",
      },
    },
    {
      userId: executive,
      prompt:
        "Reject CO-002 on 24-118 because Owner declined the formwork change",
      action: "changeOrder.reject",
      summary:
        'Rejected CO-002 on SR-99 Interchange: "Owner declined the formwork change". Nothing moved.',
      args: {
        requested: "24-118",
        job: "24-118",
        href: "/app/jobs/24-118#change-orders",
      },
    },
    {
      userId: pm,
      prompt: "Raise a change order on 24-118: Temp cofferdam at pier 2",
      action: "changeOrder.create",
      summary:
        'Raised CO-003 on SR-99 Interchange: "Temp cofferdam at pier 2". Draft. Price it per cost item; nothing moves until a PM or executive approves it.',
      args: {
        requested: "24-118",
        job: "24-118",
        href: "/app/jobs/24-118#change-orders",
      },
    },
    {
      userId: pm,
      prompt:
        "Price CO-003 on 24-118: new 91-300 Temp cofferdam LS labor 8,000 material 12,500 equipment 3,500",
      action: "changeOrder.price",
      summary:
        "Priced CO-003 on SR-99 Interchange (rev 1): $24,000.00 across 1 line. Pending PM or executive approval, not in Current Budget or EAC.",
      args: {
        requested: "24-118",
        job: "24-118",
        href: "/app/jobs/24-118#change-orders",
      },
    },
    {
      userId: executive,
      prompt: "Approve CO-003 on 24-118",
      action: "changeOrder.approve",
      summary:
        "Approved CO-003 on SR-99 Interchange (rev 1): Current Budget +$24,000.00, EAC +$24,000.00. New cost item 91-300. Original Budget unchanged.",
      args: {
        requested: "24-118",
        job: "24-118",
        href: "/app/jobs/24-118#change-orders",
      },
    },
    {
      userId: pm,
      prompt: "Raise a change order on 24-077: Duplicate field note pile tip",
      action: "changeOrder.create",
      summary:
        'Raised CO-001 on I-5 Culverts: "Duplicate field note pile tip". Draft. Price it per cost item; nothing moves until a PM or executive approves it.',
      args: {
        requested: "24-077",
        job: "24-077",
        href: "/app/jobs/24-077#change-orders",
      },
    },
    {
      userId: pm,
      prompt: "Void CO-001 on 24-077 because Duplicate of the field note",
      action: "changeOrder.void",
      summary:
        'Voided CO-001 on I-5 Culverts: "Duplicate of the field note". Nothing moved.',
      args: {
        requested: "24-077",
        job: "24-077",
        href: "/app/jobs/24-077#change-orders",
      },
    },
    {
      userId: pm,
      prompt: "Raise a change order on 24-077: Guardrail extension east approach",
      action: "changeOrder.create",
      summary:
        'Raised CO-002 on I-5 Culverts: "Guardrail extension east approach". Draft. Price it per cost item; nothing moves until a PM or executive approves it.',
      args: {
        requested: "24-077",
        job: "24-077",
        href: "/app/jobs/24-077#change-orders",
      },
    },
    {
      userId: pm,
      prompt:
        "Price CO-002 on 24-077: new 91-400 Guardrail extension LS labor 2,200 material 6,800 sub 1,500",
      action: "changeOrder.price",
      summary:
        "Priced CO-002 on I-5 Culverts (rev 1): $10,500.00 across 1 line. Pending PM or executive approval, not in Current Budget or EAC.",
      args: {
        requested: "24-077",
        job: "24-077",
        href: "/app/jobs/24-077#change-orders",
      },
    },
    {
      userId: superintendent,
      prompt: "Issue Culvert Crew A's plan on I-5 Culverts",
      action: "dailyPlan.submit",
      summary: `Issued Culvert Crew A's plan for ${todayDay} on I-5 Culverts: 3 activities, 110 man-hours. Planned only — report the day's work; cost posts when the superintendent approves.`,
      args: {
        requested: "24-077",
        job: "24-077",
        href: "/app/jobs/24-077",
      },
    },
    {
      userId: foreman,
      prompt:
        "Report day's work on 24-077: trench 175 CY at 42 MH, RCP 48 LF at 50 MH, basins 2 EA at 18 MH",
      action: "dailyReport.post",
      summary: `Reported Culvert Crew A's work on I-5 Culverts for ${todayDay}: 110 man-hours pending — 03-210: 42 MH (plan 40), 175 CY (plan 180); 07-300: 18 MH (plan 20). $9K and quantities await superintendent approval — nothing posted to actual cost yet.`,
      args: {
        requested: "24-077",
        job: "24-077",
        href: "/app/jobs/24-077",
      },
    },
    {
      userId: superintendent,
      prompt:
        "Return the report for 24-077 because Catch basin invert elevations don't match the mark-out",
      action: "dailyPlan.return",
      summary: `Returned Culvert Crew A's report for ${todayDay} on I-5 Culverts: "Catch basin invert elevations don't match the mark-out". Values kept for the foreman — nothing posted to cost.`,
      args: {
        requested: "24-077",
        job: "24-077",
        href: "/app/jobs/24-077",
      },
    },
    {
      userId: superintendent,
      prompt: "Show tomorrow's plan for Cedar Creek",
      action: "dailyPlan.show",
      summary: `Bridge Crew 2 on Cedar Creek Bridge, ${tomorrowDay}, is a draft. 3 activities, 110 man-hours: Pour Pier 3 column, lift 2, Tie column cage, Dewatering watch, pump check. Every line is within its budgeted unit rate.`,
      args: {
        requested: "25-031",
        job: "25-031",
        href: "/app/jobs/25-031",
      },
    },
    {
      userId: superintendent,
      prompt: "Why is Cedar Creek over budget?",
      action: "job.costVariance",
      summary:
        "Cedar Creek Bridge is $1.8M over on earned vs actual cost (CPI 0.78). Largest overruns: 07-410 Cofferdam & dewatering −$576K; 03-450 Drilled shafts, 72 in −$340K; 04-310 Reinforcing steel −$276K.",
      args: {
        requested: "25-031",
        job: "25-031",
        href: "/app/jobs/25-031",
      },
    },
    {
      userId: superintendent,
      prompt: "Show change orders on Cedar Creek",
      action: "changeOrder.show",
      summary:
        "Cedar Creek Bridge: 1 change order. Pending $60,000.00, not in Current Budget or EAC. CO-001 Owner-added retaining wall, north approach (priced, $60,000.00).",
      args: {
        requested: "25-031",
        job: "25-031",
        href: "/app/jobs/25-031#change-orders",
      },
    },
    {
      userId: pm,
      prompt: "Lock Period 1 on job 24-118",
      action: "progressClaim.lock",
      summary:
        "Locked Period 1 on SR-99 Interchange: 13 cost codes. Period 2 is now open as a draft.",
      args: {
        requested: "24-118",
        job: "24-118",
        href: "/app/jobs/24-118",
      },
    },
    {
      userId: pm,
      prompt: "Lock Period 1 on job 25-031",
      action: "progressClaim.lock",
      summary:
        "Locked Period 1 on Cedar Creek Bridge: 12 cost codes. Period 2 is now open as a draft.",
      args: {
        requested: "25-031",
        job: "25-031",
        href: "/app/jobs/25-031",
      },
    },
    {
      userId: pm,
      prompt: "Lock Period 1 on job 24-077",
      action: "progressClaim.lock",
      summary:
        "Locked Period 1 on I-5 Culverts: 9 cost codes. Period 2 is now open as a draft.",
      args: {
        requested: "24-077",
        job: "24-077",
        href: "/app/jobs/24-077",
      },
    },
  ];
  return runs;
}

/**
 * Mutate `out` to the post-history demo state (COs, locks, I-5 cycle, action_runs).
 * Idempotent only on a fresh base seed bag — call once at the end of seed().
 */
export function finalizeSeedWithHistory(
  out: SeedRows,
  companyId: string,
  today: Date,
): SeedRows {
  const id = (key: string) => seedId(companyId, key);
  const pmId = id("user:pm");
  const jobId = (key: string) => id(`job:${key}`);
  const todayIso = isoDate(today);

  // —— Cedar plan note + I-5 issue/report/return ——
  const cedarLine = out.dailyPlanLines.find(
    (l) => l.id === id("plan-line:cedar:0"),
  );
  if (cedarLine) cedarLine.notes = "Forms checked — ready for concrete.";

  const i5Plan = out.dailyPlans.find((p) => p.id === id("plan:i5:today"));
  if (i5Plan) {
    i5Plan.status = "issued";
    i5Plan.submittedAt = today;
    i5Plan.reportedAt = today;
    i5Plan.returnedAt = today;
    i5Plan.returnReason =
      "Catch basin invert elevations don't match the mark-out";
  }
  const i5Actuals: [string, number, number][] = [
    ["plan-line:i5:0", 420, 175_000],
    ["plan-line:i5:1", 500, 48_000],
    ["plan-line:i5:2", 180, 2_000],
  ];
  for (const [key, hours, qty] of i5Actuals) {
    const line = out.dailyPlanLines.find((l) => l.id === id(key));
    if (line) {
      line.reportedHoursTenths = hours;
      line.reportedQtyMilli = qty;
    }
  }

  // —— Change orders + approved leaf 91-300 ——
  const sr99 = out.jobs.find((j) => j.id === jobId("sr99"))!;
  const sr99Finish = sr99.finishOn;
  const newLeafId = id("cost:sr99:91-300");

  for (const spec of CO_SPECS) {
    const coId = id(`co:${spec.key}`);
    const co: Insert<typeof changeOrders> = {
      id: coId,
      companyId,
      jobId: jobId(spec.jobKey),
      number: spec.number,
      title: spec.title,
      reason: spec.reason,
      status: spec.status,
      revision: spec.revision,
      createdAt: today,
    };
    out.changeOrders.push(co);

    if (spec.line) {
      const linked =
        spec.status === "approved" && spec.line.code === "91-300"
          ? newLeafId
          : null;
      out.changeOrderLines.push({
        id: id(`co-line:${spec.key}:0`),
        companyId,
        changeOrderId: coId,
        sort: 0,
        costItemId: linked,
        newCode: spec.line.code,
        newDescription: spec.line.description,
        newUnit: spec.line.unit,
        newParentId: null,
        laborCents: spec.line.laborCents,
        materialCents: spec.line.materialCents,
        equipmentCents: spec.line.equipmentCents,
        subCents: spec.line.subCents,
        qtyDeltaMilli: 1_000,
        note: "",
      } satisfies Insert<typeof changeOrderLines>);
    }

    spec.events.forEach((ev, i) => {
      out.changeOrderEvents.push({
        id: id(`co-event:${spec.key}:${ev.command}:${i}`),
        companyId,
        changeOrderId: coId,
        command: ev.command,
        fromStatus: ev.fromStatus,
        toStatus: ev.toStatus,
        revision: ev.revision,
        actorId: id(`user:${ev.actor}`),
        actorRole: ev.actor,
        reason: ev.reason,
        totalCents: ev.totalCents,
        cbDeltaCents: ev.cbDeltaCents,
        eacDeltaCents: ev.eacDeltaCents,
        at: new Date(today.getTime() + i),
      } satisfies Insert<typeof changeOrderEvents>);
    });
  }

  // Approved CO-003 leaf (OB/CE = 0, CB = line; post-lock earnDerivation below).
  const finish =
    sr99Finish && sr99Finish > todayIso ? sr99Finish : todayIso;
  out.costItems.push({
    id: newLeafId,
    companyId,
    jobId: jobId("sr99"),
    parentId: null,
    path: "/91-300/",
    depth: 0,
    isLeaf: true,
    code: "91-300",
    description: "Temp cofferdam at pier 2",
    unit: "LS",
    evMethod: "units",
    forecastMethod: "current_budget",
    budgetQtyMilli: 1_000,
    installedQtyMilli: 0,
    claimedInstalledQtyMilli: 0,
    obLaborCents: 0,
    obMaterialCents: 0,
    obEquipmentCents: 0,
    obSubCents: 0,
    cbLaborCents: 800_000,
    cbMaterialCents: 1_250_000,
    cbEquipmentCents: 350_000,
    cbSubCents: 0,
    ceLaborCents: 0,
    ceMaterialCents: 0,
    ceEquipmentCents: 0,
    ceSubCents: 0,
    plannedStartOn: todayIso,
    plannedFinishOn: finish,
    plannedCents: 0,
    actualCents: 0,
    lockedActualCents: 0,
    claimedPercentMilli: 0,
    earnDerivation: `Added by ${coLabel(3)}; nothing claimed yet.`,
    budgetMhPerUnitMilli: 0,
  } satisfies Insert<typeof costItems>);

  // —— Period 1 locks + Period 2 drafts ——
  const pmLogsByItem = new Map(
    out.pmPercentLogs.map((l) => [l.costItemId, l]),
  );
  const claimByJobPeriod = new Map(
    out.progressClaims.map((c) => [`${c.jobId}:${c.periodLabel}`, c]),
  );
  const claimLinesByClaim = new Map<string, Insert<typeof progressClaimLines>[]>();
  for (const line of out.progressClaimLines) {
    const list = claimLinesByClaim.get(line.claimId) ?? [];
    list.push(line);
    claimLinesByClaim.set(line.claimId, list);
  }
  const entriesByItem = new Map<string, (typeof out.costEntries)[number][]>();
  for (const e of out.costEntries) {
    const list = entriesByItem.get(e.costItemId) ?? [];
    list.push(e);
    entriesByItem.set(e.costItemId, list);
  }

  for (const jobKey of LOCK_JOB_KEYS) {
    const jid = jobId(jobKey);
    const claim = claimByJobPeriod.get(`${jid}:Period 1`);
    if (!claim) continue;
    claim.status = "locked";
    claim.lockedAt = today;
    claim.lockedById = pmId;

    const items = out.costItems.filter((c) => c.jobId === jid);
    const existingLines = claimLinesByClaim.get(claim.id) ?? [];
    const byItem = new Map(existingLines.map((l) => [l.costItemId, l]));

    const lockedSnaps = new Map<
      string,
      { percentMilli: number; installedQtyMilli: number; derivation: string }
    >();

    for (const item of items) {
      const log = pmLogsByItem.get(item.id);
      const ms = out.costItemMilestones.filter((m) => m.costItemId === item.id);
      const completeWeight = ms
        .filter((m) => m.complete)
        .reduce((s, m) => s + m.weightMilli, 0);
      const snap = snapshotClaimPercent({
        method: item.evMethod as "units" | "milestones" | "pm_percent",
        budgetQtyMilli: item.budgetQtyMilli,
        installedQtyMilli:
          item.evMethod === "units" ? item.installedQtyMilli : 0,
        unit: item.unit,
        milestoneCompleteWeightMilli: completeWeight,
        pmPercentMilli: log?.percentMilli ?? 0,
        milestones: ms.map((m) => ({
          name: m.name,
          weightMilli: m.weightMilli,
          complete: Boolean(m.complete),
        })),
      });
      const derivation =
        item.evMethod === "pm_percent" && log
          ? `${snap.derivation} — ${log.reason}`
          : snap.derivation;
      const claimedInstalled =
        item.evMethod === "units" ? item.installedQtyMilli : 0;
      lockedSnaps.set(item.id, {
        percentMilli: snap.percentMilli,
        installedQtyMilli: claimedInstalled,
        derivation,
      });

      const row = byItem.get(item.id);
      if (row) {
        row.claimedPercentMilli = snap.percentMilli;
        row.installedQtyMilli = item.installedQtyMilli;
        row.derivation = derivation;
      } else {
        const line: Insert<typeof progressClaimLines> = {
          id: id(`claim-line:${jobKey}:${item.code}`),
          companyId,
          claimId: claim.id,
          costItemId: item.id,
          claimedPercentMilli: snap.percentMilli,
          installedQtyMilli: item.installedQtyMilli,
          derivation,
        };
        out.progressClaimLines.push(line);
        existingLines.push(line);
        byItem.set(item.id, line);
      }

      item.claimedPercentMilli = snap.percentMilli;
      item.claimedInstalledQtyMilli = claimedInstalled;
      item.lockedActualCents = item.actualCents;
      item.earnDerivation = `${derivation} (locked Period 1)`;

      // Same as lockProgressClaim: stamp every cost entry that exists now
      // (Part C locked_in_at). Harbor stays unlocked → entries stay null.
      for (const entry of entriesByItem.get(item.id) ?? []) {
        if (entry.lockedInAt == null) entry.lockedInAt = today;
      }
    }

    const nextId = id(`claim:${jobKey}:period-2`);
    const nextClaim: Insert<typeof progressClaims> = {
      id: nextId,
      companyId,
      jobId: jid,
      periodLabel: "Period 2",
      status: "draft",
      lockedAt: null,
      lockedById: null,
    };
    out.progressClaims.push(nextClaim);

    for (const item of items) {
      const snap = lockedSnaps.get(item.id)!;
      out.progressClaimLines.push({
        id: id(`claim-line:${jobKey}:period-2:${item.code}`),
        companyId,
        claimId: nextId,
        costItemId: item.id,
        claimedPercentMilli: snap.percentMilli,
        installedQtyMilli: snap.installedQtyMilli,
        derivation: "Draft — will refresh from field on lock",
      });
    }
  }

  // —— action_runs (same content as live seedActionHistory) ——
  actionRunSpecs(today, id).forEach((run, i) => {
    out.actionRuns.push({
      id: id(`action-run:${i}`),
      companyId,
      userId: run.userId,
      prompt: run.prompt,
      action: run.action,
      args: run.args,
      summary: run.summary,
      createdAt: new Date(today.getTime() + i),
    } satisfies Insert<typeof actionRuns>);
  });

  return out;
}

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { emptyCategories } from "./budget";
import {
  availableCommands,
  changeOrderCountLabel,
  CO_COMMANDS,
  coCommandFromArgs,
  decide,
  describeCoResult,
  parseCoLines,
  parseCoRef,
  parseDollarsToCents,
  parseQtyToMilli,
  planApproval,
  planRefusalField,
  resolveCoLines,
  sameCoLines,
  TERMINAL_STATUSES,
  type BudgetItem,
  type CoCommandResult,
  type CoLine,
  type CoStatus,
  type JobItemRef,
} from "./change-order";

describe("changeOrderCountLabel", () => {
  it("singular and plural", () => {
    expect(changeOrderCountLabel(0)).toBe("0 change orders");
    expect(changeOrderCountLabel(1)).toBe("1 change order");
    expect(changeOrderCountLabel(2)).toBe("2 change orders");
  });
});

const STATUSES: (CoStatus | null)[] = [
  null,
  "draft",
  "priced",
  "approved",
  "rejected",
  "voided",
];

describe("change-order state machine", () => {
  // Every (from, command) pair, written out by hand.
  const grid: Record<string, Record<string, string>> = {
    null: { create: "go draft", price: "illegal", approve: "illegal", reject: "illegal", void: "illegal" },
    draft: { create: "illegal", price: "go priced", approve: "illegal", reject: "illegal", void: "go voided" },
    priced: { create: "illegal", price: "go priced", approve: "go approved", reject: "go rejected", void: "go voided" },
    approved: { create: "illegal", price: "illegal", approve: "already", reject: "illegal", void: "illegal" },
    rejected: { create: "illegal", price: "illegal", approve: "illegal", reject: "already", void: "illegal" },
    voided: { create: "illegal", price: "illegal", approve: "illegal", reject: "illegal", void: "already" },
  };

  for (const from of STATUSES)
    for (const command of CO_COMMANDS)
      it(`${from ?? "(none)"} + ${command} → ${grid[String(from)]![command]}`, () => {
        const d = decide(from, command);
        const got = d.kind === "go" ? `go ${d.to}` : d.kind;
        expect(got).toBe(grid[String(from)]![command]);
      });

  it("terminal statuses are approved, rejected, voided", () => {
    expect([...TERMINAL_STATUSES].sort()).toEqual(["approved", "rejected", "voided"]);
    for (const s of TERMINAL_STATUSES) expect(availableCommands(s)).toEqual([]);
  });

  it("the one-decision index in the newest migration lists exactly the terminal statuses", () => {
    const dir = path.join(process.cwd(), "drizzle");
    const sql = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort()
      .map((f) => readFileSync(path.join(dir, f), "utf8"))
      .join("\n");
    const defs = [...sql.matchAll(/"change_order_events_decision_uq"[^;]*?in \(([^)]*)\)/g)];
    const last = defs.at(-1)?.[1];
    expect(last).toBe(TERMINAL_STATUSES.map((s) => `'${s}'`).join(", "));
  });

  it("illegal answers carry the next legal commands", () => {
    expect(decide("draft", "approve")).toEqual({
      kind: "illegal",
      from: "draft",
      allowed: ["price", "void"],
    });
    expect(availableCommands("priced")).toEqual(["price", "approve", "reject", "void"]);
  });
});

describe("references and money", () => {
  it.each([
    ["CO-001", { number: 1 }],
    ["co 3", { number: 3 }],
    ["PCO-12", { number: 12 }],
    ["#7", { number: 7 }],
    ["4", { number: 4 }],
    ["CO-000", null],
    ["", null],
    ["change order", null],
    [
      "6C1D2A9E-0000-4000-8000-000000000001",
      { id: "6c1d2a9e-0000-4000-8000-000000000001" },
    ],
  ])("parseCoRef(%j)", (s, want) => {
    expect(parseCoRef(s)).toEqual(want);
  });

  it.each([
    ["18,500", 1_850_000],
    ["$18,500.00", 1_850_000],
    ["$0.10", 10],
    ["-1,250.5", -125_050],
    ["−75", -7_500],
    ["", 0],
    ["-0", 0],
  ])("parseDollarsToCents(%j) = %d", (s, cents) => {
    const r = parseDollarsToCents(s);
    expect(r).toEqual({ ok: true, cents });
    if (r.ok) expect(Object.is(r.cents, -0)).toBe(false);
  });

  it.each(["1.234", "abc", "1e5", "12-3", "1,000,000,000.01"])(
    "parseDollarsToCents(%j) is refused",
    (s) => {
      expect(parseDollarsToCents(s).ok).toBe(false);
    },
  );

  it("quantities parse to thousandths", () => {
    expect(parseQtyToMilli("50")).toEqual({ ok: true, milli: 50_000 });
    expect(parseQtyToMilli("-12.5")).toEqual({ ok: true, milli: -12_500 });
    expect(parseQtyToMilli("1.2345").ok).toBe(false);
  });
});

const CEDAR_ITEMS: JobItemRef[] = [
  { id: "i-03", code: "03", isLeaf: false },
  { id: "i-03-310", code: "03-310", isLeaf: true },
  { id: "i-05-120", code: "05-120", isLeaf: true },
];

describe("parse and resolve lines", () => {
  it("skips blank rows and keys errors by row and field", () => {
    const r = parseCoLines([
      {},
      { code: "03-310", labor: "1.234" },
      { code: "03-310" },
      { code: "91-100", description: "Retaining wall", unit: "" },
    ]);
    expect(r).toEqual({
      ok: false,
      errors: {
        "lines.1.labor": "Use whole cents, at most two decimals.",
        "lines.2.labor": "Enter at least one amount or a quantity change.",
        "lines.3.unit": "A new cost item needs a unit, like LS or CY.",
      },
    });
  });

  it("an empty set asks for a line", () => {
    expect(parseCoLines([{}, { note: "  " }])).toEqual({
      ok: false,
      errors: { lines: "Add at least one line." },
    });
  });

  it("resolves codes and refuses summaries, missing codes, taken codes, and repeats", () => {
    const parsed = parseCoLines([
      { code: "03-310", labor: "100" },
      { code: "03", labor: "100" },
      { code: "04-999", labor: "100" },
      { code: "05-120", description: "Dup", unit: "LS", sub: "1" },
      { code: "03-310", material: "5" },
      { code: "91-100", description: "Wall", unit: "LS", parentCode: "03-310", sub: "1" },
    ]);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(resolveCoLines(parsed.lines, CEDAR_ITEMS)).toEqual({
      ok: false,
      errors: {
        "lines.1.code": "03 is a summary row. Pick a cost item under it.",
        "lines.2.code":
          "No cost item 04-999 on this job. To add one, give a description and unit.",
        "lines.3.code":
          "05-120 is already on this job. Leave the description blank to revise it.",
        "lines.4.code": "03-310 is already on line 1.",
        "lines.5.parentCode": "03-310 is not a summary code on this job.",
      },
    });
  });

  it("a new code under a summary resolves to its parent id; re-pricing the same lines is a no-op", () => {
    const parsed = parseCoLines([
      { code: "91-100", description: "Wall", unit: "ls", parentCode: "03", sub: "12,150" },
    ]);
    if (!parsed.ok) throw new Error("parse");
    const a = resolveCoLines(parsed.lines, CEDAR_ITEMS);
    expect(a).toEqual({
      ok: true,
      lines: [
        {
          sort: 0,
          target: { kind: "new", code: "91-100", description: "Wall", unit: "LS", parentId: "i-03" },
          delta: { ...emptyCategories(), subCents: 1_215_000 },
          qtyDeltaMilli: 0,
          note: "",
        },
      ],
    });
    if (!a.ok) return;
    expect(sameCoLines(a.lines, [{ ...a.lines[0]!, sort: 4 }])).toBe(true);
    expect(
      sameCoLines(a.lines, [
        { ...a.lines[0]!, delta: { ...a.lines[0]!.delta, subCents: 1_215_001 } },
      ]),
    ).toBe(false);
  });
});

// Hand-computed fixture. Lock cutoff = today 2026-10-22 is day 60 of 120 for both
// existing items, so PV at the cutoff is half of CB (same as-of as EV).
//
// 03-310 units, current_budget. CB 120,000 + 200,000 + 40,000 = $360,000; budget 400 CY; claimed 100 CY; AC $100,000.
//   before: EV = 360,000 × 100/400 = 90,000; EAC = 100,000 + 360,000 − 90,000 = $370,000
//   +50 CY at the same unit rate (+$45,000): CB $405,000 over 450 CY; EV = 405,000 × 100/450 = 90,000
//   after:  EAC = 100,000 + 405,000 − 90,000 = $415,000 → ΔEAC = +$45,000 = ΔCB. PV = $202,500.
// 05-120 pm_percent 50%, current_budget. CB sub $80,000; AC $30,000.
//   before: EV 40,000; EAC = 30,000 + 80,000 − 40,000 = $70,000
//   sub −$10,000: CB $70,000; EV 35,000; EAC = 30,000 + 70,000 − 35,000 = $65,000 → ΔEAC = −$5,000, ΔCB = −$10,000.
//   PV = $35,000.
// 91-100 new LS, qty 1: CB 18,500 + 23,250 + 6,100 + 12,150 = $60,000, EV 0, AC 0 → EAC $60,000. PV 0 (starts today).
// Job: ΔCB = 45,000 − 10,000 + 60,000 = $95,000; ΔEAC = 45,000 − 5,000 + 60,000 = $100,000.
const today = "2026-10-22";
const jobFinishOn = "2027-06-30";

const item = (over: Partial<BudgetItem> & Pick<BudgetItem, "id" | "code">): BudgetItem => ({
  path: `/03/${over.code}/`,
  depth: 1,
  isLeaf: true,
  cb: emptyCategories(),
  budgetQtyMilli: 0,
  evMethod: "pm_percent",
  forecastMethod: "current_budget",
  claimedInstalledQtyMilli: 0,
  claimedPercentMilli: 0,
  lockedActualCents: 0,
  plannedStartOn: "2026-08-23",
  plannedFinishOn: "2026-12-21",
  ...over,
});

const concrete = item({
  id: "i-03-310",
  code: "03-310",
  cb: { laborCents: 12_000_000, materialCents: 20_000_000, equipmentCents: 4_000_000, subCents: 0 },
  budgetQtyMilli: 400_000,
  evMethod: "units",
  claimedInstalledQtyMilli: 100_000,
  lockedActualCents: 10_000_000,
});
const rebar = item({
  id: "i-05-120",
  code: "05-120",
  cb: { ...emptyCategories(), subCents: 8_000_000 },
  claimedPercentMilli: 500,
  lockedActualCents: 3_000_000,
});
const ctx = {
  items: new Map([concrete, rebar].map((i) => [i.id, i])),
  codesOnJob: new Set(["03", "03-310", "05-120"]),
  today,
  lockCutoffOn: today,
  jobFinishOn,
};

const wall: CoLine = {
  sort: 2,
  target: {
    kind: "new",
    code: "91-100",
    description: "Retaining wall, north approach",
    unit: "LS",
    parentId: null,
  },
  delta: { laborCents: 1_850_000, materialCents: 2_325_000, equipmentCents: 610_000, subCents: 1_215_000 },
  qtyDeltaMilli: 1_000,
  note: "",
};
const moreConcrete: CoLine = {
  sort: 0,
  target: { kind: "existing", costItemId: "i-03-310" },
  delta: { laborCents: 1_500_000, materialCents: 2_500_000, equipmentCents: 500_000, subCents: 0 },
  qtyDeltaMilli: 50_000,
  note: "+50 CY",
};
const lessRebar: CoLine = {
  sort: 1,
  target: { kind: "existing", costItemId: "i-05-120" },
  delta: { ...emptyCategories(), subCents: -1_000_000 },
  qtyDeltaMilli: 0,
  note: "",
};

describe("planApproval (hand-computed)", () => {
  it("a new leaf moves Current Budget and EAC by exactly its total; OB and CE are 0", () => {
    const r = planApproval(ctx, [wall]);
    if (!r.ok) throw new Error(r.refusal.kind);
    expect(r.plan.move).toEqual({
      cbDeltaCents: 6_000_000,
      eacDeltaCents: 6_000_000,
      items: [{ code: "91-100", created: true, cbDeltaCents: 6_000_000, eacDeltaCents: 6_000_000 }],
    });
    expect(r.plan.writes).toEqual([]);
    expect(r.plan.inserts).toEqual([
      {
        sort: 2,
        code: "91-100",
        description: "Retaining wall, north approach",
        unit: "LS",
        parentId: null,
        path: "/91-100/",
        depth: 0,
        obLaborCents: 0,
        obMaterialCents: 0,
        obEquipmentCents: 0,
        obSubCents: 0,
        ceLaborCents: 0,
        ceMaterialCents: 0,
        ceEquipmentCents: 0,
        ceSubCents: 0,
        cbLaborCents: 1_850_000,
        cbMaterialCents: 2_325_000,
        cbEquipmentCents: 610_000,
        cbSubCents: 1_215_000,
        budgetQtyMilli: 1_000,
        evMethod: "units",
        forecastMethod: "current_budget",
        plannedStartOn: today,
        plannedFinishOn: jobFinishOn,
        plannedCents: 0,
      },
    ]);
  });

  it("plannedCents uses the lock cutoff, not the approve day", () => {
    // Cutoff on the planned start day → PV is 0 for existing items (t <= start).
    const early = planApproval({ ...ctx, lockCutoffOn: "2026-08-23" }, [moreConcrete]);
    if (!early.ok) throw new Error(early.refusal.kind);
    expect(early.plan.writes[0]?.plannedCents).toBe(0);
    // New leaf starts on approve day (today), after the lock → PV at cutoff is 0.
    const wallEarly = planApproval({ ...ctx, lockCutoffOn: "2026-08-23" }, [wall]);
    if (!wallEarly.ok) throw new Error(wallEarly.refusal.kind);
    expect(wallEarly.plan.inserts[0]?.plannedCents).toBe(0);
    expect(wallEarly.plan.inserts[0]?.plannedStartOn).toBe(today);
  });

  it("existing items: CB moves by Δ, EAC by the forecast difference, PV at lock cutoff", () => {
    const r = planApproval(ctx, [moreConcrete, lessRebar, wall]);
    if (!r.ok) throw new Error(r.refusal.kind);
    expect(r.plan.move).toEqual({
      cbDeltaCents: 9_500_000,
      eacDeltaCents: 10_000_000,
      items: [
        { code: "03-310", created: false, cbDeltaCents: 4_500_000, eacDeltaCents: 4_500_000 },
        { code: "05-120", created: false, cbDeltaCents: -1_000_000, eacDeltaCents: -500_000 },
        { code: "91-100", created: true, cbDeltaCents: 6_000_000, eacDeltaCents: 6_000_000 },
      ],
    });
    expect(r.plan.writes).toEqual([
      {
        costItemId: "i-03-310",
        cbLaborCents: 13_500_000,
        cbMaterialCents: 22_500_000,
        cbEquipmentCents: 4_500_000,
        cbSubCents: 0,
        budgetQtyMilli: 450_000,
        plannedCents: 20_250_000,
      },
      {
        costItemId: "i-05-120",
        cbLaborCents: 0,
        cbMaterialCents: 0,
        cbEquipmentCents: 0,
        cbSubCents: 7_000_000,
        budgetQtyMilli: 0,
        plannedCents: 3_500_000,
      },
    ]);
    for (const w of r.plan.writes)
      expect(Object.keys(w).some((k) => k.startsWith("ob") || k.startsWith("ce"))).toBe(false);
  });

  it("refuses a Current Budget below zero, a taken code, and an empty change order", () => {
    const tooMuch = { ...lessRebar, delta: { ...emptyCategories(), subCents: -9_000_000 } };
    const r = planApproval(ctx, [moreConcrete, tooMuch]);
    expect(r).toEqual({
      ok: false,
      refusal: { kind: "negative_budget", line: 1, code: "05-120", category: "sub", after: -1_000_000 },
    });
    if (!r.ok) expect(planRefusalField(r.refusal)).toBe("lines.1.sub");

    const taken = { ...wall, target: { ...wall.target, code: "03-310" } } as CoLine;
    expect(planApproval(ctx, [taken])).toEqual({
      ok: false,
      refusal: { kind: "code_taken", line: 2, code: "03-310" },
    });
    expect(planApproval(ctx, [])).toEqual({ ok: false, refusal: { kind: "empty" } });
  });

  it("a new leaf with no quantity earns by PM percent and still forecasts at its budget", () => {
    const r = planApproval(ctx, [{ ...wall, qtyDeltaMilli: 0 }]);
    if (!r.ok) throw new Error(r.refusal.kind);
    expect(r.plan.inserts[0]!.evMethod).toBe("pm_percent");
    expect(r.plan.move.eacDeltaCents).toBe(6_000_000);
  });
});

describe("assistant and form arguments", () => {
  it("asks which change order when none is named", () => {
    expect(coCommandFromArgs("approve", { job: "25-031" })).toEqual({
      ask: "Which change order? Say its number, like CO-001.",
    });
  });

  it("asks how to price when no lines are given", () => {
    expect(coCommandFromArgs("price", { changeOrder: "CO-001" })).toEqual({
      ask: "Price it per cost code, like: Price CO-001 on 25-031: new 91-100 Retaining wall LS labor 18,500 material 23,250.",
    });
  });

  it("maps args to typed commands", () => {
    expect(coCommandFromArgs("approve", { changeOrder: "CO-001", revision: "2" })).toEqual({
      kind: "approve",
      co: { number: 1 },
      expectRevision: 2,
    });
    expect(coCommandFromArgs("void", { changeOrder: "pco 4", reason: "Duplicate" })).toEqual({
      kind: "void",
      co: { number: 4 },
      reason: "Duplicate",
    });
    expect(coCommandFromArgs("create", { title: "Wall" })).toEqual({
      kind: "create",
      title: "Wall",
      reason: "",
    });
  });
});

describe("describeCoResult", () => {
  const job = { number: "25-031", shortName: "Cedar Creek" };
  const co = { id: "x", number: 1, label: "CO-001", title: "Owner-added retaining wall", status: "approved" as const, revision: 1 };

  it("says what moved and that Original Budget did not", () => {
    const plan = planApproval(ctx, [moreConcrete, lessRebar, wall]);
    if (!plan.ok) throw new Error("plan");
    const r: CoCommandResult = {
      ok: true,
      command: "approve",
      job,
      co,
      from: "priced",
      to: "approved",
      reason: "",
      totalCents: 9_500_000,
      lineCount: 3,
      unchanged: false,
      move: plan.plan.move,
    };
    expect(describeCoResult(r)).toBe(
      "Approved CO-001 on Cedar Creek (rev 1): Current Budget +$95,000.00, EAC +$100,000.00. " +
        "New cost item 91-100. EAC moves by a different amount where work is already earned or forecast by performance: " +
        "05-120 budget −$10,000.00, EAC −$5,000.00. Original Budget unchanged.",
    );
  });

  it("a second approve says nothing moved again", () => {
    expect(
      describeCoResult({
        ok: false,
        command: "approve",
        job,
        co,
        refusal: { kind: "already", status: "approved" },
      }),
    ).toBe("CO-001 on Cedar Creek is already approved. Current Budget was not moved again.");
  });

  it("reject and void say nothing moved", () => {
    const base = { ok: true as const, job, from: "priced" as const, totalCents: 0, lineCount: 1, unchanged: false, move: null };
    expect(
      describeCoResult({ ...base, command: "reject", to: "rejected", reason: "Owner declined", co: { ...co, status: "rejected" } }),
    ).toBe('Rejected CO-001 on Cedar Creek: "Owner declined". Nothing moved.');
    expect(
      describeCoResult({ ...base, command: "void", to: "voided", reason: "Duplicate", co: { ...co, status: "voided" } }),
    ).toBe('Voided CO-001 on Cedar Creek: "Duplicate". Nothing moved.');
  });
});

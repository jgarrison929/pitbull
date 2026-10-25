import { describe, expect, it } from "vitest";
import { plannedValueCents } from "./ev";
import {
  CycleError,
  plannedFinishExclusiveOn,
  runCpm,
  type CpmActivity,
  type CpmLink,
} from "./cpm";
import { createWorkingCalendar } from "./working-calendar";

/** Intel fixture calendar: Mon–Fri + Thanksgiving 2026-11-26. */
const calendar = createWorkingCalendar(["2026-11-26"]);
const JOB_START = "2026-11-02";

function blank(id: string, durationDays: number): CpmActivity {
  return {
    id,
    durationDays,
    startNoEarlierOn: null,
    earlyStartOn: "",
    earlyFinishOn: "",
    lateStartOn: "",
    lateFinishOn: "",
    totalFloatDays: -1,
    isCritical: false,
  };
}

/** Cedar Creek A–D graph from schedule intel / 5.1.1 acceptance checks 1–2. */
function cedarLinks(): CpmLink[] {
  return [
    {
      predecessorId: "A",
      successorId: "B",
      type: "finish_to_start",
      lagDays: 0,
    },
    {
      predecessorId: "A",
      successorId: "C",
      type: "finish_to_start",
      lagDays: 0,
    },
    {
      predecessorId: "B",
      successorId: "D",
      type: "finish_to_start",
      lagDays: 0,
    },
    {
      predecessorId: "C",
      successorId: "D",
      type: "finish_to_start",
      lagDays: 0,
    },
  ];
}

function byId(rows: CpmActivity[]) {
  return Object.fromEntries(rows.map((r) => [r.id, r]));
}

describe("runCpm — 5.1.1 CI acceptance", () => {
  it("1. forward pass: A–D early dates and job finish 2026-11-16", () => {
    const rows = runCpm(
      [blank("A", 5), blank("B", 3), blank("C", 4), blank("D", 2)],
      cedarLinks(),
      JOB_START,
      calendar,
    );
    const m = byId(rows);
    expect(m.A).toMatchObject({
      earlyStartOn: "2026-11-02",
      earlyFinishOn: "2026-11-06",
    });
    expect(m.B).toMatchObject({
      earlyStartOn: "2026-11-09",
      earlyFinishOn: "2026-11-11",
    });
    expect(m.C).toMatchObject({
      earlyStartOn: "2026-11-09",
      earlyFinishOn: "2026-11-12",
    });
    expect(m.D).toMatchObject({
      earlyStartOn: "2026-11-13",
      earlyFinishOn: "2026-11-16",
    });
    const jobFinish = rows.reduce(
      (max, r) => (r.earlyFinishOn > max ? r.earlyFinishOn : max),
      rows[0]!.earlyFinishOn,
    );
    expect(jobFinish).toBe("2026-11-16");
  });

  it("2. float and critical path: A/C/D critical, B float 1", () => {
    const rows = runCpm(
      [blank("A", 5), blank("B", 3), blank("C", 4), blank("D", 2)],
      cedarLinks(),
      JOB_START,
      calendar,
    );
    const m = byId(rows);
    expect(m.A).toMatchObject({
      totalFloatDays: 0,
      isCritical: true,
      lateStartOn: "2026-11-02",
      lateFinishOn: "2026-11-06",
    });
    expect(m.B).toMatchObject({
      totalFloatDays: 1,
      isCritical: false,
      lateStartOn: "2026-11-10",
      lateFinishOn: "2026-11-12",
    });
    expect(m.C).toMatchObject({
      totalFloatDays: 0,
      isCritical: true,
      lateStartOn: "2026-11-09",
      lateFinishOn: "2026-11-12",
    });
    expect(m.D).toMatchObject({
      totalFloatDays: 0,
      isCritical: true,
      lateStartOn: "2026-11-13",
      lateFinishOn: "2026-11-16",
    });
    const critical = rows.filter((r) => r.isCritical).map((r) => r.id);
    expect(critical).toEqual(["A", "C", "D"]);
  });

  it("3. start-to-start with lag: E SS+2 after A → 11-04 to 11-05", () => {
    const links: CpmLink[] = [
      ...cedarLinks(),
      {
        predecessorId: "A",
        successorId: "E",
        type: "start_to_start",
        lagDays: 2,
      },
    ];
    const rows = runCpm(
      [
        blank("A", 5),
        blank("B", 3),
        blank("C", 4),
        blank("D", 2),
        blank("E", 2),
      ],
      links,
      JOB_START,
      calendar,
    );
    const m = byId(rows);
    expect(m.E).toMatchObject({
      earlyStartOn: "2026-11-04",
      earlyFinishOn: "2026-11-05",
    });
    const jobFinish = rows.reduce(
      (max, r) => (r.earlyFinishOn > max ? r.earlyFinishOn : max),
      rows[0]!.earlyFinishOn,
    );
    expect(jobFinish).toBe("2026-11-16");
  });

  it("4. holiday: C at 12 d finishes 11-24; D skips 11-26 → 11-25 to 11-27", () => {
    const rows = runCpm(
      [blank("A", 5), blank("B", 3), blank("C", 12), blank("D", 2)],
      cedarLinks(),
      JOB_START,
      calendar,
    );
    const m = byId(rows);
    expect(m.C).toMatchObject({
      earlyStartOn: "2026-11-09",
      earlyFinishOn: "2026-11-24",
    });
    expect(m.D).toMatchObject({
      earlyStartOn: "2026-11-25",
      earlyFinishOn: "2026-11-27",
    });
    expect(calendar.isWorkingDay("2026-11-26")).toBe(false);
  });

  it("5. cycle refused: D→A names A → C → D → A", () => {
    const links: CpmLink[] = [
      ...cedarLinks(),
      {
        predecessorId: "D",
        successorId: "A",
        type: "finish_to_start",
        lagDays: 0,
      },
    ];
    const activities = [
      blank("A", 5),
      blank("B", 3),
      blank("C", 4),
      blank("D", 2),
    ];
    expect(() => runCpm(activities, links, JOB_START, calendar)).toThrow(
      CycleError,
    );
    try {
      runCpm(activities, links, JOB_START, calendar);
      expect.unreachable("expected CycleError");
    } catch (e) {
      expect(e).toBeInstanceOf(CycleError);
      const err = e as CycleError;
      expect(err.cycle.join(" → ")).toBe("A → C → D → A");
      expect(err.message).toMatch(/A → C → D → A/);
    }
  });

  it("6. plannedValueCents for 04-210 via plannedFinishExclusiveOn", () => {
    // C early finish 11-12 inclusive → exclusive 11-13 through the mapping.
    const budgetCents = 86_800_000;
    const startOn = "2026-11-09";
    const earlyFinishInclusive = "2026-11-12";
    const finishExclusive = plannedFinishExclusiveOn(earlyFinishInclusive);
    expect(finishExclusive).toBe("2026-11-13");
    const ladder = [
      ["2026-11-09", 0],
      ["2026-11-10", 21_700_000],
      ["2026-11-11", 43_400_000],
      ["2026-11-12", 65_100_000],
      ["2026-11-13", 86_800_000],
    ] as const;
    for (const [on, cents] of ladder) {
      expect(
        plannedValueCents(
          budgetCents,
          startOn,
          finishExclusive,
          new Date(`${on}T00:00:00Z`),
        ),
      ).toBe(cents);
    }
  });
});

describe("runCpm — SS late-finish cap", () => {
  it("X (10d) with Y (1d) SS+0 after X is critical with float 0", () => {
    const rows = runCpm(
      [blank("X", 10), blank("Y", 1)],
      [
        {
          predecessorId: "X",
          successorId: "Y",
          type: "start_to_start",
          lagDays: 0,
        },
      ],
      JOB_START,
      calendar,
    );
    const m = byId(rows);
    expect(m.X!.earlyFinishOn).toBe("2026-11-13");
    expect(m.Y!.earlyStartOn).toBe("2026-11-02");
    expect(m.X!.lateFinishOn).toBe("2026-11-13");
    expect(m.X!.totalFloatDays).toBe(0);
    expect(m.X!.isCritical).toBe(true);
  });

  it("F SS+0 after D keeps critical path A, C, D (D LF not past job finish)", () => {
    const links: CpmLink[] = [
      ...cedarLinks(),
      {
        predecessorId: "D",
        successorId: "F",
        type: "start_to_start",
        lagDays: 0,
      },
    ];
    const rows = runCpm(
      [
        blank("A", 5),
        blank("B", 3),
        blank("C", 4),
        blank("D", 2),
        blank("F", 1),
      ],
      links,
      JOB_START,
      calendar,
    );
    const m = byId(rows);
    expect(m.D!.lateFinishOn).toBe("2026-11-16");
    expect(m.D!.lateFinishOn).not.toBe("2026-11-17");
    expect(m.A!.totalFloatDays).toBe(0);
    expect(m.C!.totalFloatDays).toBe(0);
    expect(m.D!.totalFloatDays).toBe(0);
    const critical = rows.filter((r) => r.isCritical).map((r) => r.id);
    expect(critical).toEqual(["A", "C", "D"]);
  });
});

describe("plannedFinishExclusiveOn — PV mapping must-fail", () => {
  it("must-fail: finish→exclusive mapping must advance one calendar day", () => {
    // Revert risk: returning the inclusive finish unchanged makes this red.
    const earlyFinishInclusive = "2026-11-12";
    const exclusive = plannedFinishExclusiveOn(earlyFinishInclusive);
    expect(exclusive).toBe("2026-11-13");
    expect(exclusive).not.toBe(earlyFinishInclusive);

    const budgetCents = 86_800_000;
    const startOn = "2026-11-09";
    const asOf = new Date("2026-11-10T00:00:00Z");

    const viaMapping = plannedValueCents(
      budgetCents,
      startOn,
      exclusive,
      asOf,
    );
    expect(viaMapping).toBe(21_700_000);

    // Inclusive finish as exclusive under-reads PV on 11-10.
    const viaInclusive = plannedValueCents(
      budgetCents,
      startOn,
      earlyFinishInclusive,
      asOf,
    );
    expect(viaInclusive).not.toBe(viaMapping);
    expect(viaInclusive).toBe(28_933_333);

    // Mapping must be what check 6 feeds into plannedValueCents.
    expect(
      plannedValueCents(
        budgetCents,
        startOn,
        plannedFinishExclusiveOn(earlyFinishInclusive),
        asOf,
      ),
    ).toBe(21_700_000);
  });
});

describe("runCpm — performance (realistic 1k graph)", () => {
  it("median of several runs under 50 ms", () => {
    // Fixed-seed DAG: ~2 links/activity, 20% SS, lags 0–3, durations 1–15, 12 holidays.
    const n = 1000;
    let seed = 0xc0ffee;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0x100000000;
    };

    const holidays = [
      "2026-01-01",
      "2026-01-19",
      "2026-02-16",
      "2026-05-25",
      "2026-07-03",
      "2026-09-07",
      "2026-10-12",
      "2026-11-11",
      "2026-11-26",
      "2026-12-25",
      "2027-01-01",
      "2027-11-25",
    ];
    const cal = createWorkingCalendar(holidays);

    const activities = Array.from({ length: n }, (_, i) =>
      blank(`a${i}`, 1 + Math.floor(rnd() * 15)),
    );
    const links: CpmLink[] = [];
    for (let i = 0; i < n; i++) {
      const linkCount = 1 + Math.floor(rnd() * 2); // 1 or 2 outgoing
      for (let k = 0; k < linkCount; k++) {
        const span = 1 + Math.floor(rnd() * Math.min(40, n - 1 - i));
        const j = i + span;
        if (j >= n) continue;
        links.push({
          predecessorId: `a${i}`,
          successorId: `a${j}`,
          type: rnd() < 0.2 ? "start_to_start" : "finish_to_start",
          lagDays: Math.floor(rnd() * 4),
        });
      }
    }
    expect(links.length).toBeGreaterThan(n); // ~2 per activity

    const samples: number[] = [];
    for (let r = 0; r < 9; r++) {
      const t0 = performance.now();
      const rows = runCpm(activities, links, JOB_START, cal);
      samples.push(performance.now() - t0);
      expect(rows).toHaveLength(n);
    }
    samples.sort((a, b) => a - b);
    const median = samples[Math.floor(samples.length / 2)]!;
    expect(median).toBeLessThan(50);
  });
});

describe("runCpm — must-fail guards", () => {
  it("must-fail: B float must stay 1 (not 0) on the intel graph", () => {
    const m = byId(
      runCpm(
        [blank("A", 5), blank("B", 3), blank("C", 4), blank("D", 2)],
        cedarLinks(),
        JOB_START,
        calendar,
      ),
    );
    expect(m.B!.totalFloatDays).toBe(1);
    expect(m.B!.isCritical).toBe(false);
    expect(m.A!.isCritical && m.C!.isCritical && m.D!.isCritical).toBe(true);
  });

  it("must-fail: FS successor must not start on the predecessor finish day", () => {
    const m = byId(
      runCpm(
        [blank("A", 5), blank("B", 3), blank("C", 4), blank("D", 2)],
        cedarLinks(),
        JOB_START,
        calendar,
      ),
    );
    expect(m.B!.earlyStartOn).not.toBe(m.A!.earlyFinishOn);
    expect(m.B!.earlyStartOn).toBe("2026-11-09");
  });

  it("must-fail: cycle message must name the loop, not a generic invalid link", () => {
    const links: CpmLink[] = [
      ...cedarLinks(),
      {
        predecessorId: "D",
        successorId: "A",
        type: "finish_to_start",
        lagDays: 0,
      },
    ];
    try {
      runCpm(
        [blank("A", 5), blank("B", 3), blank("C", 4), blank("D", 2)],
        links,
        JOB_START,
        calendar,
      );
      expect.unreachable("expected throw");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      expect(msg).toMatch(/A → C → D → A/);
      expect(msg.toLowerCase()).not.toMatch(/^invalid link$/);
    }
  });

  it("must-fail: negative lag is refused", () => {
    expect(() =>
      runCpm(
        [blank("A", 5), blank("B", 3)],
        [
          {
            predecessorId: "A",
            successorId: "B",
            type: "finish_to_start",
            lagDays: -1,
          },
        ],
        JOB_START,
        calendar,
      ),
    ).toThrow(/lag/i);
  });

  it("must-fail: SS-only successor must not push predecessor LF past job finish", () => {
    const m = byId(
      runCpm(
        [blank("X", 10), blank("Y", 1)],
        [
          {
            predecessorId: "X",
            successorId: "Y",
            type: "start_to_start",
            lagDays: 0,
          },
        ],
        JOB_START,
        calendar,
      ),
    );
    expect(m.X!.lateFinishOn).toBe(m.X!.earlyFinishOn);
    expect(m.X!.totalFloatDays).toBe(0);
    expect(m.X!.lateFinishOn).not.toBe("2026-11-27");
  });
});

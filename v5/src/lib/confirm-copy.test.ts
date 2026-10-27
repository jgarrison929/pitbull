import { describe, expect, it } from "vitest";
import {
  approveChangeOrderCopy,
  approveReportCopy,
  rejectChangeOrderCopy,
  removePlanLineCopy,
  returnReportCopy,
  voidChangeOrderCopy,
} from "@/lib/confirm-copy";

describe("confirm copy", () => {
  it("names a priced void and the pending amount", () => {
    expect(
      voidChangeOrderCopy({
        jobNumber: "24-077",
        label: "CO-014",
        status: "priced",
        totalCents: 4_820_000,
      }),
    ).toEqual({
      title: "Void change order CO-014 on 24-077?",
      description:
        "This removes $48,200.00 from pending changes and cannot be undone.",
      confirmLabel: "Void change order",
      destructive: true,
    });
  });

  it("does not claim a draft void leaves pending changes", () => {
    const copy = voidChangeOrderCopy({
      jobNumber: "24-118",
      label: "CO-001",
      status: "draft",
      totalCents: 0,
    });
    expect(copy.description).toContain("not in pending changes");
    expect(copy.description).toContain("cannot be undone");
    expect(copy.destructive).toBe(true);
  });

  it("says reject leaves the budget and names the amount", () => {
    const copy = rejectChangeOrderCopy({
      jobNumber: "24-077",
      label: "CO-002",
      totalCents: 1_050_000,
    });
    expect(copy.title).toBe("Reject change order CO-002 on 24-077?");
    expect(copy.description).toContain("$10,500.00");
    expect(copy.description).toContain("does not enter Current Budget");
    expect(copy.confirmLabel).toBe("Reject change order");
    expect(copy.destructive).toBe(true);
  });

  it("states the Current Budget and EAC move on approve", () => {
    const copy = approveChangeOrderCopy({
      jobNumber: "25-031",
      label: "CO-001",
      cbDeltaCents: 6_000_000,
      eacDeltaCents: 6_000_000,
      refusal: null,
    });
    expect(copy.title).toBe("Approve change order CO-001 on 25-031?");
    expect(copy.description).toBe(
      "Current Budget increases by $60,000.00 and EAC increases by $60,000.00. This cannot be undone.",
    );
    expect(copy.destructive).toBe(false);
    expect(copy.confirmLabel).toBe("Approve change order");
  });

  it("uses a decrease when the change order is a credit", () => {
    const copy = approveChangeOrderCopy({
      jobNumber: "25-031",
      label: "CO-004",
      cbDeltaCents: -150_000,
      eacDeltaCents: 0,
      refusal: null,
    });
    expect(copy.description).toContain("Current Budget decreases by $1,500.00");
    expect(copy.description).toContain("EAC stays the same");
  });

  it("shows the refusal instead of a budget move", () => {
    const copy = approveChangeOrderCopy({
      jobNumber: "25-031",
      label: "CO-001",
      cbDeltaCents: null,
      eacDeltaCents: null,
      refusal: "It has no lines. Price it first.",
    });
    expect(copy.description).toBe("It has no lines. Price it first.");
  });

  it("names the plan line, crew, day, and job on remove", () => {
    const copy = removePlanLineCopy({
      jobNumber: "25-031",
      crew: "Bridge Crew 2",
      planDate: "2026-10-21",
      code: "04-210",
      activity: "Pour deck",
    });
    expect(copy.title).toBe("Remove 04-210 from Bridge Crew 2's plan?");
    expect(copy.description).toContain("04-210 Pour deck");
    expect(copy.description).toContain("Bridge Crew 2");
    expect(copy.description).toContain("25-031");
    expect(copy.description).toContain("Wed, Oct 21");
    expect(copy.description).toContain("The line leaves this draft.");
    expect(copy.confirmLabel).toBe("Remove plan line");
    expect(copy.destructive).toBe(true);
  });

  it("names the crew report on approve and return", () => {
    const approve = approveReportCopy({
      jobNumber: "25-031",
      crew: "Bridge Crew 2",
      planDate: "2026-10-21",
    });
    expect(approve.title).toBe("Approve Bridge Crew 2's report for Wed, Oct 21?");
    expect(approve.description).toContain("25-031");
    expect(approve.description).toContain("post to job cost");
    expect(approve.destructive).toBe(false);

    const back = returnReportCopy({
      jobNumber: "25-031",
      crew: "Bridge Crew 2",
      planDate: "2026-10-21",
    });
    expect(back.confirmLabel).toBe("Return report");
    expect(back.description).toContain("nothing posts to cost");
    expect(back.destructive).toBe(false);
  });
});

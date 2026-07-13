import { describe, expect, it } from "vitest";
import { evaluateScheduleSlipRisk } from "./schedule-slip-risk";

describe("schedule slip risk (2.20.3)", () => {
  it("does not invent risk without planned finish", () => {
    const r = evaluateScheduleSlipRisk({
      reportDate: "2026-07-12",
      plannedFinishDate: null,
      activityName: "Pour",
    });
    expect(r.showFlag).toBe(false);
    expect(r.band).toBe("insufficient");
    expect(r.truthNote).toMatch(/not all-clear|cannot score/i);
  });

  it("watch band for 1–3 days late", () => {
    const r = evaluateScheduleSlipRisk({
      reportDate: "2026-07-12",
      plannedFinishDate: "2026-07-10",
      activityName: "Form deck",
    });
    expect(r.showFlag).toBe(true);
    expect(r.band).toBe("watch");
    expect(r.daysLate).toBe(2);
    expect(r.label).toMatch(/\*/);
    expect(r.truthNote).toMatch(/Proxy/i);
  });

  it("risk band for >3 days late", () => {
    const r = evaluateScheduleSlipRisk({
      reportDate: "2026-07-20",
      plannedFinishDate: "2026-07-10",
      activityName: "Steel",
    });
    expect(r.band).toBe("risk");
    expect(r.daysLate).toBe(10);
    expect(r.label).toMatch(/Risk/i);
  });

  it("no flag when on time", () => {
    const r = evaluateScheduleSlipRisk({
      reportDate: "2026-07-10",
      plannedFinishDate: "2026-07-12",
    });
    expect(r.showFlag).toBe(false);
    expect(r.band).toBe("none");
  });
});

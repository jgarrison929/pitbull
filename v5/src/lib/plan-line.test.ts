import { describe, expect, it } from "vitest";
import { applyLineInput, rebalance, type LineValues } from "./plan-line";

const pour: LineValues = {
  costItemId: "c-04-210",
  activity: "Pour Pier 3 column, lift 2",
  location: "Pier 3",
  qtyMilli: 42_000,
  workers: 6,
  hoursTenths: 100,
  notes: "",
};
const codes = ["c-04-210", "c-04-310"];

describe("plan line rules", () => {
  it("60 → 80 man-hours at 10 h adds two workers", () => {
    expect(rebalance(6, 100, 80)).toEqual({ workers: 8, hoursTenths: 100 });
    const r = applyLineInput(pour, { manHours: "80" }, codes);
    expect(r.values).toMatchObject({ workers: 8, hoursTenths: 100 });
  });

  it("a target the hours don't divide changes the hours instead", () => {
    expect(rebalance(6, 100, 75)).toEqual({ workers: 6, hoursTenths: 125 });
  });

  it("explicit workers and hours win when man-hours already agrees", () => {
    const r = applyLineInput(
      pour,
      { workers: 4, hours: 12, manHours: 48 },
      codes,
    );
    expect(r.values).toMatchObject({ workers: 4, hoursTenths: 120 });
  });

  it("rejects a cost code that isn't on this job", () => {
    expect(
      applyLineInput(pour, { costItemId: "elsewhere" }, codes).errors,
    ).toEqual({
      costItemId: "Pick a cost code from this job's list.",
    });
  });

  it("rejects fractional workers, out-of-range hours and negative quantities together", () => {
    const r = applyLineInput(
      pour,
      { workers: "2.5", hours: "30", qty: "-1" },
      codes,
    );
    expect(Object.keys(r.errors ?? {}).sort()).toEqual([
      "hours",
      "qty",
      "workers",
    ]);
  });

  it("parses quantities with thousands separators", () => {
    expect(applyLineInput(pour, { qty: "8,500" }, codes).values?.qtyMilli).toBe(
      8_500_000,
    );
  });
});

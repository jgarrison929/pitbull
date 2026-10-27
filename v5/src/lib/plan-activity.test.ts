import { describe, expect, it } from "vitest";
import {
  activitiesCoveringDate,
  type PlanActivityOption,
} from "./plan-activity";

const opts: PlanActivityOption[] = [
  {
    id: "c",
    code: "C",
    name: "Pier columns",
    earlyStartOn: "2026-11-09",
    earlyFinishOn: "2026-11-12",
    costItemId: "ci-210",
  },
  {
    id: "e",
    code: "E",
    name: "Tie column cage",
    earlyStartOn: "2026-10-20",
    earlyFinishOn: "2026-10-21",
    costItemId: "ci-310",
  },
];

describe("activitiesCoveringDate", () => {
  it("keeps activities whose inclusive span covers the plan date", () => {
    expect(activitiesCoveringDate(opts, "2026-10-20").map((a) => a.code)).toEqual([
      "E",
    ]);
    expect(activitiesCoveringDate(opts, "2026-10-21").map((a) => a.code)).toEqual([
      "E",
    ]);
    expect(activitiesCoveringDate(opts, "2026-11-10").map((a) => a.code)).toEqual([
      "C",
    ]);
    expect(activitiesCoveringDate(opts, "2026-10-19")).toEqual([]);
  });
});

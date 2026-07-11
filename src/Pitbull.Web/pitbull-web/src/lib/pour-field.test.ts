import { describe, expect, it } from "vitest";
import {
  buildFieldWorkSummary,
  isFieldStepReady,
  nextReportStep,
  normalizeCrewCounts,
  prevReportStep,
  toggleFieldActivity,
  toggleTruckCondition,
} from "./pour-field";

describe("toggleFieldActivity", () => {
  it("adds and removes activity chips", () => {
    expect(toggleFieldActivity([], "pour")).toEqual(["pour"]);
    expect(toggleFieldActivity(["pour", "form"], "pour")).toEqual(["form"]);
  });
});

describe("toggleTruckCondition", () => {
  it("multi-selects truck conditions", () => {
    expect(toggleTruckCondition([], "too_wet")).toEqual(["too_wet"]);
    expect(toggleTruckCondition(["too_wet"], "held")).toEqual([
      "too_wet",
      "held",
    ]);
  });
});

describe("normalizeCrewCounts", () => {
  it("drops empty trades and zero counts", () => {
    expect(
      normalizeCrewCounts([
        { trade: " Form ", count: 4 },
        { trade: "", count: 2 },
        { trade: "Finish", count: 0 },
      ])
    ).toEqual([{ trade: "Form", count: 4 }]);
  });
});

describe("buildFieldWorkSummary", () => {
  it("builds plain super language from chips + notes", () => {
    const summary = buildFieldWorkSummary({
      activities: ["pour", "finish"],
      truckConditions: ["too_wet", "held"],
      truckNotes: "Load 3 driven around to dry out.",
      crewCounts: [
        { trade: "Place", count: 6 },
        { trade: "Finish", count: 2 },
      ],
      workNarrative: "East vault walls.",
    });
    expect(summary).toContain("Pour");
    expect(summary).toContain("Too wet");
    expect(summary).toContain("Place×6");
    expect(summary).toContain("East vault walls");
  });

  it("does not invent narrative when empty", () => {
    expect(
      buildFieldWorkSummary({
        activities: [],
        truckConditions: [],
        truckNotes: "",
        crewCounts: [],
        workNarrative: "",
      })
    ).toBe("");
  });
});

describe("isFieldStepReady", () => {
  it("requires some field signal", () => {
    expect(
      isFieldStepReady({
        activities: [],
        truckConditions: [],
        truckNotes: "",
        crewCounts: [],
        workNarrative: "",
      })
    ).toBe(false);
    expect(
      isFieldStepReady({
        activities: ["pour"],
        truckConditions: [],
        truckNotes: "",
        crewCounts: [],
        workNarrative: "",
      })
    ).toBe(true);
  });
});

describe("report step navigation", () => {
  it("walks short path Project → Field → Photos → Review", () => {
    expect(nextReportStep("Project")).toBe("Field");
    expect(nextReportStep("Field")).toBe("Photos");
    expect(nextReportStep("Review")).toBeNull();
    expect(prevReportStep("Photos")).toBe("Field");
  });
});

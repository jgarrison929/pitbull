import { describe, expect, it } from "vitest";
import {
  buildFieldWorkSummary,
  isFieldStepReady,
  nextReportStep,
  normalizeCrewCounts,
  prevReportStep,
  showsTruckMaterialSection,
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

describe("showsTruckMaterialSection", () => {
  it("is true only when Pour is selected", () => {
    expect(showsTruckMaterialSection([])).toBe(false);
    expect(showsTruckMaterialSection(["rebar", "form"])).toBe(false);
    expect(showsTruckMaterialSection(["pour"])).toBe(true);
    expect(showsTruckMaterialSection(["form", "pour"])).toBe(true);
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

  it("omits truck material when Pour is not selected", () => {
    const summary = buildFieldWorkSummary({
      activities: ["rebar"],
      truckConditions: ["too_wet"],
      truckNotes: "should not appear",
      crewCounts: [],
      workNarrative: "Tied steel on L1.",
    });
    expect(summary).toContain("Rebar");
    expect(summary).not.toContain("Too wet");
    expect(summary).not.toContain("should not appear");
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

  it("does not treat orphan truck chips as ready without Pour", () => {
    expect(
      isFieldStepReady({
        activities: ["rebar"],
        truckConditions: ["too_wet"],
        truckNotes: "leftover",
        crewCounts: [],
        workNarrative: "",
      })
    ).toBe(true); // rebar activity is enough
    expect(
      isFieldStepReady({
        activities: [],
        truckConditions: ["too_wet"],
        truckNotes: "leftover",
        crewCounts: [],
        workNarrative: "",
      })
    ).toBe(false);
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

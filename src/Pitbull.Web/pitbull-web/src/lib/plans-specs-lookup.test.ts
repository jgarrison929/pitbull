import { describe, expect, it } from "vitest";
import {
  buildPlansSpecsHref,
  filterPlanSets,
  filterSpecSections,
  resolveSiteWalkPlansFilter,
  selectPlanOrSpecFromDeepLink,
  type PlanSetSearchItem,
  type SpecSectionSearchItem,
} from "./plans-specs-lookup";

const PLANS: PlanSetSearchItem[] = [
  {
    id: "plan-1",
    name: "Architectural Level 2",
    discipline: "Architectural",
    revision: "Rev 3",
    status: "Issued",
    sheetNumber: "A-201",
  },
  {
    id: "plan-2",
    name: "Structural Foundation",
    discipline: "Structural",
    revision: "IFC",
    status: "Draft",
    sheetNumber: "S-101",
  },
];

const SPECS: SpecSectionSearchItem[] = [
  {
    id: "spec-1",
    sectionCode: "03 30 00",
    title: "Cast-in-Place Concrete",
    divisionCode: "03",
    status: "Current",
  },
  {
    id: "spec-2",
    sectionCode: "05 12 00",
    title: "Structural Steel Framing",
    divisionCode: "05",
    status: "Draft",
  },
];

describe("filterPlanSets", () => {
  it("matches sheet number, name, and discipline", () => {
    expect(filterPlanSets(PLANS, "A-201").map((p) => p.id)).toEqual(["plan-1"]);
    expect(filterPlanSets(PLANS, "structural").map((p) => p.id)).toEqual([
      "plan-2",
    ]);
  });
});

describe("filterSpecSections", () => {
  it("matches section code and title", () => {
    expect(filterSpecSections(SPECS, "03 30").map((s) => s.id)).toEqual([
      "spec-1",
    ]);
    expect(filterSpecSections(SPECS, "steel").map((s) => s.id)).toEqual([
      "spec-2",
    ]);
  });
});

describe("selectPlanOrSpecFromDeepLink", () => {
  it("resolves planId and section code from query context", () => {
    const { plan, spec } = selectPlanOrSpecFromDeepLink(PLANS, SPECS, {
      planId: "plan-2",
      section: "03 30 00",
    });
    expect(plan?.id).toBe("plan-2");
    expect(spec?.id).toBe("spec-1");
  });

  it("resolves sheet shorthand", () => {
    const { plan } = selectPlanOrSpecFromDeepLink(PLANS, SPECS, {
      sheet: "S-101",
    });
    expect(plan?.id).toBe("plan-2");
  });
});

describe("buildPlansSpecsHref", () => {
  it("builds deep link used from daily report / site walk", () => {
    expect(
      buildPlansSpecsHref("proj-abc", { sheet: "A-201", view: "plans" })
    ).toBe("/projects/proj-abc/plans-specs?sheet=A-201&view=plans");
  });
});

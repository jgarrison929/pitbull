import { describe, expect, it } from "vitest";
import { ProjectStatus } from "@/lib/types";
import {
  coerceProjectStatus,
  isFieldReportEligibleStatus,
  toProjectLookupItems,
} from "./projects";

describe("coerceProjectStatus", () => {
  it("accepts string enum names from the API", () => {
    expect(coerceProjectStatus("Active")).toBe(ProjectStatus.Active);
    expect(coerceProjectStatus("PreConstruction")).toBe(
      ProjectStatus.PreConstruction
    );
    expect(coerceProjectStatus("OnHold")).toBe(ProjectStatus.OnHold);
  });

  it("accepts numeric values", () => {
    expect(coerceProjectStatus(2)).toBe(ProjectStatus.Active);
    expect(coerceProjectStatus(1)).toBe(ProjectStatus.PreConstruction);
  });
});

describe("isFieldReportEligibleStatus", () => {
  it("includes open jobs when status is a string (live API shape)", () => {
    expect(isFieldReportEligibleStatus("Active")).toBe(true);
    expect(isFieldReportEligibleStatus("PreConstruction")).toBe(true);
    expect(isFieldReportEligibleStatus("OnHold")).toBe(true);
  });

  it("includes open jobs when status is numeric", () => {
    expect(isFieldReportEligibleStatus(ProjectStatus.Active)).toBe(true);
    expect(isFieldReportEligibleStatus(ProjectStatus.PreConstruction)).toBe(
      true
    );
    expect(isFieldReportEligibleStatus(ProjectStatus.OnHold)).toBe(true);
  });

  it("excludes bidding and closed-out jobs", () => {
    expect(isFieldReportEligibleStatus("Bidding")).toBe(false);
    expect(isFieldReportEligibleStatus("Completed")).toBe(false);
    expect(isFieldReportEligibleStatus("Closed")).toBe(false);
    expect(isFieldReportEligibleStatus(ProjectStatus.Completed)).toBe(false);
  });
});

describe("toProjectLookupItems", () => {
  const mixed = [
    {
      id: "a",
      number: "P-100",
      name: "Alpha Tower",
      status: "Active" as const,
    },
    {
      id: "b",
      number: "P-200",
      name: "Beta Plaza",
      status: "Completed" as const,
    },
    {
      id: "c",
      number: "P-300",
      name: "Gamma Site",
      status: ProjectStatus.PreConstruction,
    },
    {
      id: "d",
      number: "",
      name: "Nameless Hold",
      status: "OnHold" as const,
    },
  ];

  it("filters to field-eligible projects and maps label/sublabel for smart pick list", () => {
    const items = toProjectLookupItems(mixed);
    expect(items.map((i) => i.id)).toEqual(["a", "c", "d"]);
    expect(items[0]).toMatchObject({
      id: "a",
      label: "P-100",
      sublabel: "Alpha Tower",
    });
    expect(items[0]?.searchText.toLowerCase()).toContain("alpha");
  });

  it("uses name as label when number is blank", () => {
    const items = toProjectLookupItems(mixed);
    const hold = items.find((i) => i.id === "d");
    expect(hold?.label).toBe("Nameless Hold");
    expect(hold?.sublabel).toBeUndefined();
  });

  it("does not drop string-status Active jobs (regression for empty pick list)", () => {
    // Bug: p.status === ProjectStatus.Active failed when API sent "Active"
    const onlyStringActive = [
      { id: "x", number: "J-1", name: "Job One", status: "Active" as const },
    ];
    expect(toProjectLookupItems(onlyStringActive)).toHaveLength(1);
    expect(toProjectLookupItems(onlyStringActive)[0]?.label).toBe("J-1");
  });
});

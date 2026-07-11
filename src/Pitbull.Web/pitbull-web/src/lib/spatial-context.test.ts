import { describe, expect, it } from "vitest";
import {
  applySpatialContextToReportData,
  formatZoneLabel,
  isSpatialContextOptionalForSubmit,
  normalizeZoneOptions,
  pickSpatialContext,
  type SpatialZoneOption,
} from "./spatial-context";

const ZONES: SpatialZoneOption[] = [
  {
    id: "zone-east",
    code: "L1-EAST",
    name: "L1 East pour",
    pathLabel: "Jobsite / Building A / Level 1 / L1 East pour",
  },
  {
    id: "zone-west",
    code: "L1-WEST",
    name: "L1 West core",
    pathLabel: "Jobsite / Building A / Level 1 / L1 West core",
  },
];

describe("pickSpatialContext", () => {
  it("skips when no selection", () => {
    expect(pickSpatialContext(ZONES, null)).toEqual({ kind: "skip" });
    expect(pickSpatialContext(ZONES, "")).toEqual({ kind: "skip" });
    expect(pickSpatialContext(ZONES, "   ")).toEqual({ kind: "skip" });
  });

  it("skips unknown zone ids (stale offline cache)", () => {
    expect(pickSpatialContext(ZONES, "missing")).toEqual({ kind: "skip" });
  });

  it("applies when zone exists", () => {
    const d = pickSpatialContext(ZONES, "zone-east");
    expect(d.kind).toBe("apply");
    if (d.kind === "apply") {
      expect(d.spatialNodeId).toBe("zone-east");
      expect(d.zone.code).toBe("L1-EAST");
    }
  });
});

describe("applySpatialContextToReportData", () => {
  it("omits SpatialNodeId on skip", () => {
    const data = applySpatialContextToReportData(
      { WorkNarrative: "poured", SpatialNodeId: "stale" },
      { kind: "skip" }
    );
    expect(data.SpatialNodeId).toBeUndefined();
    expect(data.WorkNarrative).toBe("poured");
  });

  it("sets SpatialNodeId on apply", () => {
    const data = applySpatialContextToReportData(
      { WorkNarrative: "poured" },
      {
        kind: "apply",
        spatialNodeId: "zone-east",
        zone: ZONES[0]!,
      }
    );
    expect(data.SpatialNodeId).toBe("zone-east");
  });
});

describe("isSpatialContextOptionalForSubmit", () => {
  it("never blocks submit", () => {
    expect(isSpatialContextOptionalForSubmit({ kind: "skip" })).toBe(true);
    expect(
      isSpatialContextOptionalForSubmit({
        kind: "apply",
        spatialNodeId: "zone-east",
        zone: ZONES[0]!,
      })
    ).toBe(true);
  });
});

describe("formatZoneLabel / normalizeZoneOptions", () => {
  it("formats path and normalizes API casing", () => {
    expect(formatZoneLabel(ZONES[0])).toContain("Level 1");
    expect(formatZoneLabel(null)).toContain("optional");
    const zones = normalizeZoneOptions([
      { Id: "a", Code: "Z1", Name: "Zone 1", PathLabel: "A / Z1" },
    ]);
    expect(zones).toEqual([
      { id: "a", code: "Z1", name: "Zone 1", pathLabel: "A / Z1" },
    ]);
  });
});

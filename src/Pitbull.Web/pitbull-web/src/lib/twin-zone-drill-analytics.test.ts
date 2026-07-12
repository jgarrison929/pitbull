import { describe, expect, it } from "vitest";
import {
  TWIN_ZONE_DRILL_EVENT,
  buildTwinZoneDrillProps,
} from "./twin-zone-drill-analytics";

describe("twin-zone-drill-analytics (2.16.1)", () => {
  it("uses stable event name twin_zone_drill", () => {
    expect(TWIN_ZONE_DRILL_EVENT).toBe("twin_zone_drill");
  });

  it("builds diagnostic timing props without inventing success KPIs", () => {
    const props = buildTwinZoneDrillProps({
      projectId: "proj-1",
      spatialNodeId: "zone-a",
      durationMs: 123.4,
      pinsEmpty: true,
    });
    expect(props).toEqual({
      project_id: "proj-1",
      spatial_node_id: "zone-a",
      duration_ms: 123,
      pins_empty: true,
    });
    expect(props).not.toHaveProperty("all_clear");
    expect(props).not.toHaveProperty("health_score");
  });
});

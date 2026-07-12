import { describe, it, expect } from "vitest";
import {
  SITE_WALK_STARTED_EVENT,
  buildSiteWalkStartedProps,
} from "./site-walk-analytics";

describe("site_walk_started analytics (2.14.9)", () => {
  it("uses stable event name and project_id (viewport_class via captureProductEvent)", () => {
    expect(SITE_WALK_STARTED_EVENT).toBe("site_walk_started");
    expect(buildSiteWalkStartedProps("p1")).toEqual({ project_id: "p1" });
  });
});

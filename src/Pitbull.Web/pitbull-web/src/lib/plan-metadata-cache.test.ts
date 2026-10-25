import { describe, it, expect } from "vitest";
import {
  isPlanSetsMetadataUrl,
  PLAN_METADATA_CACHE_NOTE,
} from "./plan-metadata-cache";

describe("plan-metadata-cache (2.14.1)", () => {
  it("matches plan-sets list URLs for SW cache, not arbitrary project paths", () => {
    expect(
      isPlanSetsMetadataUrl("/api/projects/abc/plan-sets?page=1&pageSize=200")
    ).toBe(true);
    expect(isPlanSetsMetadataUrl("/api/projects/abc/plan-sets")).toBe(true);
    expect(isPlanSetsMetadataUrl("/api/projects?pageSize=10")).toBe(false);
    expect(isPlanSetsMetadataUrl("/api/projects/abc/daily-reports")).toBe(false);
  });

  it("documents metadata-only cache intent", () => {
    expect(PLAN_METADATA_CACHE_NOTE).toMatch(/metadata/i);
    expect(PLAN_METADATA_CACHE_NOTE).not.toMatch(/pdf binary/i);
  });
});

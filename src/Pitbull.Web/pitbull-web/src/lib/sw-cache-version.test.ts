import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  SW_CACHE_VERSION,
  parseSwCacheVersionFromSource,
  swHasDeployClaimHooks,
} from "./sw-cache-version";

describe("sw deploy freshness (3.2.1)", () => {
  const swPath = join(__dirname, "../../public/sw.js");
  const source = readFileSync(swPath, "utf8");

  it("public/sw.js CACHE_VERSION matches SW_CACHE_VERSION", () => {
    expect(parseSwCacheVersionFromSource(source)).toBe(SW_CACHE_VERSION);
  });

  it("install skipWaiting and activate clients.claim are present", () => {
    expect(swHasDeployClaimHooks(source)).toBe(true);
  });
});

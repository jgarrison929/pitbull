/**
 * Static structural evidence for Digital Twin web surface (route/nav/helpers).
 * Complements twin-browser.log when headless browser is unavailable.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { getProjectNavItems } from "./project-nav";
import { isDigitalTwinEnabled } from "./feature-flags";

const WEB_ROOT = join(__dirname, "..");
const TWIN_PAGE = join(
  WEB_ROOT,
  "app",
  "(dashboard)",
  "projects",
  "[id]",
  "twin",
  "page.tsx"
);

describe("twin surface static structure", () => {
  it("route file exists for Digital Twin workspace", () => {
    expect(existsSync(TWIN_PAGE)).toBe(true);
    const src = readFileSync(TWIN_PAGE, "utf8");
    expect(src).toContain("digital-twin-workspace");
    expect(src).toContain("twin-empty-state");
    expect(src).toContain("twin-zone-linked-artifacts");
    expect(src).toContain("twin-zone-photo-thumbs");
    expect(src).toContain("twin-loading-skeleton");
    expect(src).toContain("twin-model-assets");
    expect(src).toContain("twin-schematic-zones");
    expect(src).toContain("twin-schematic-board");
    expect(src).toMatch(/No spatial graph yet|No published spatial graph|Seed demo zones/i);
  });

  it("project nav includes Digital Twin when flag on", () => {
    expect(isDigitalTwinEnabled()).toBe(true);
    const pid = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const twin = getProjectNavItems(pid).find((i) => i.id === "twin");
    expect(twin).toBeDefined();
    expect(twin!.href).toBe(`/projects/${pid}/twin`);
    expect(twin!.label).toMatch(/twin/i);
  });

  it("empty-state and overlay truth copy present in page source", () => {
    const src = readFileSync(TWIN_PAGE, "utf8");
    expect(src).toContain("Truth note");
    expect(src).toMatch(/insufficient|Insufficient|not green/i);
  });
});

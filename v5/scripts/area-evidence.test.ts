import { describe, expect, it } from "vitest";
import { parseBeforeAfter } from "../../.cursor/skills/verify-v5/before-after.mjs";
import {
  beforeAfterSection,
  imageTag,
  prSections,
  proofCell,
  scenarioOrder,
  scenariosTable,
} from "./area-evidence.mjs";

const rows = [
  {
    scenario: "PB-97-S1",
    test: "foreman changes the pour @PB-97-S1",
    result: "pass",
    page: "/app/jobs/25-031",
    role: "foreman",
    viewport: "1280×800",
    theme: "light",
    before: "PB-97-S1-before.jpg",
    after: "PB-97-S1-after.jpg",
    beforeTaken: true,
    afterTaken: true,
    replayUrl: null,
  },
  {
    scenario: "PB-97-S2",
    test: "superintendent whole number @PB-97-S2",
    result: "pass",
    page: "/app/jobs/25-031",
    role: "superintendent",
    viewport: "1280×800",
    theme: "light",
    before: "PB-97-S2-before.jpg",
    after: "PB-97-S2-after.jpg",
    beforeTaken: true,
    afterTaken: true,
    replayUrl: "https://us.posthog.com/project/1/replay/abc",
  },
];

describe("area-evidence", () => {
  it("builds the scenarios table with screenshot names and a recording link", () => {
    const table = scenariosTable(rows);
    expect(table).toContain("| Scenario | Test | Result | Proof |");
    expect(table).toContain("`PB-97-S1-before.jpg`, `PB-97-S1-after.jpg`");
    expect(table).toContain("[recording](https://us.posthog.com/project/1/replay/abc)");
    expect(proofCell(["a.jpg"], null)).toBe("`a.jpg`");
  });

  it("labels Before/After pairs the way the verify gate reads them", () => {
    const root = "https://raw.githubusercontent.com/jgarrison929/pitbull/example/evidence";
    const section = beforeAfterSection(rows, (file) => `${root}/${file}`);
    const body = `## Scenarios\n\n${scenariosTable(rows)}\n\n${section}\n`;
    const parsed = parseBeforeAfter(body);
    expect(parsed.kind).toBe("pairs");
    expect(parsed.problems).toEqual([]);
    const pairs = parsed.pairs ?? [];
    expect(pairs).toHaveLength(2);
    expect(pairs[0]?.label).toBe("/app/jobs/25-031 · foreman · 1280×800 · light");
    expect(pairs[1]?.label).toBe(
      "/app/jobs/25-031 · superintendent · 1280×800 · light",
    );
  });

  it("uses an img tag for an absolute file path so a PR upload can rewrite it", () => {
    const tag = imageTag(
      "Before",
      "/app/jobs/25-031 · pm · 1280×800 · light",
      "/opt/cursor/artifacts/plan-edit/PB-97-S3-before.jpg",
    );
    expect(tag).toContain('alt="Before: /app/jobs/25-031 · pm · 1280×800 · light"');
    expect(tag).toContain('src="/opt/cursor/artifacts/plan-edit/PB-97-S3-before.jpg"');
    const body = prSections(rows, (file) => `/opt/cursor/artifacts/plan-edit/${file}`);
    const parsed = parseBeforeAfter(body);
    expect(parsed.kind).toBe("pairs");
    expect(parsed.problems).toEqual([]);
  });

  it("orders PB-97-S1 before PB-97-S5", () => {
    expect(scenarioOrder("PB-97-S1")).toBeLessThan(scenarioOrder("PB-97-S5"));
  });
});

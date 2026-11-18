import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseBeforeAfter } from "../../.cursor/skills/verify-v5/before-after.mjs";
import {
  beforeAfterSection,
  imageTag,
  prSections,
  escapeCell,
  pairProblems,
  proofCell,
  REQUIRED_PAIRS,
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

  it("escapes pipes only after escaping backslashes", () => {
    expect(escapeCell("a|b")).toBe("a\\|b");
    expect(escapeCell("a\\b")).toBe("a\\\\b");
    expect(escapeCell("a\\|b")).toBe("a\\\\\\|b");
    expect(escapeCell("line\n2")).toBe("line 2");
  });

  it("orders PB-97-S1 before PB-97-S5", () => {
    expect(scenarioOrder("PB-97-S1")).toBeLessThan(scenarioOrder("PB-97-S5"));
  });

  it("keys S3 and S4 by scenario and role, not capture order", () => {
    const page = "/app/jobs/25-031";
    const viewport = "1280×800";
    const theme = "light";
    const shot = (
      scenario: string,
      role: string,
      which: "before" | "after",
      file: string,
    ) => ({ scenario, role, which, file, page, viewport, theme, test: scenario, result: "pass" });
    // Befores and afters are interleaved so a zip by capture order would cross S3 and S4.
    const shots = [
      shot("PB-97-S3", "pm", "before", "s3-pm-before.jpg"),
      shot("PB-97-S3", "executive", "before", "s3-ex-before.jpg"),
      shot("PB-97-S4", "pm", "before", "s4-pm-before.jpg"),
      shot("PB-97-S4", "pm", "after", "s4-pm-after.jpg"),
      shot("PB-97-S3", "executive", "after", "s3-ex-after.jpg"),
      shot("PB-97-S3", "pm", "after", "s3-pm-after.jpg"),
    ];
    const section = beforeAfterSection(shots, (file) => file);
    const parsed = parseBeforeAfter(section);
    expect(parsed.kind).toBe("pairs");
    expect(parsed.problems).toEqual([]);
    const pairs = parsed.pairs ?? [];
    expect(pairs.map((pair) => [pair.before.url, pair.after.url])).toEqual([
      ["s3-pm-before.jpg", "s3-pm-after.jpg"],
      ["s3-ex-before.jpg", "s3-ex-after.jpg"],
      ["s4-pm-before.jpg", "s4-pm-after.jpg"],
    ]);
    expect(pairs[0]?.label).toBe("/app/jobs/25-031 · pm · 1280×800 · light");
    expect(pairs[1]?.label).toBe("/app/jobs/25-031 · executive · 1280×800 · light");
    expect(pairs[2]?.label).toBe("/app/jobs/25-031 · pm · 1280×800 · light");
    const table = scenariosTable(shots);
    const s3 = table.split("\n").filter((line) => line.includes("PB-97-S3"));
    expect(s3).toHaveLength(1);
    expect(s3[0]).toContain("`s3-pm-before.jpg`, `s3-pm-after.jpg`, `s3-ex-before.jpg`, `s3-ex-after.jpg`");
  });

  it("fails when a pair is byte-identical or a scenario role has no pair", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "area-evidence-"));
    const written = REQUIRED_PAIRS.map((req) => {
      const before = `${req.scenario}-${req.role}-before.jpg`;
      const after = `${req.scenario}-${req.role}-after.jpg`;
      fs.writeFileSync(path.join(dir, before), `before-${req.scenario}-${req.role}`);
      fs.writeFileSync(path.join(dir, after), `after-${req.scenario}-${req.role}`);
      return {
        scenario: req.scenario,
        role: req.role,
        test: req.scenario,
        result: "pass",
        page: "/app/jobs/25-031",
        viewport: "1280×800",
        theme: "light",
        before,
        after,
        beforeTaken: true,
        afterTaken: true,
        replayUrl: null,
      };
    });
    expect(pairProblems(dir, written)).toEqual([]);

    const pm = written.find((row) => row.scenario === "PB-97-S3" && row.role === "pm");
    if (!pm) throw new Error("missing S3 pm fixture");
    fs.writeFileSync(path.join(dir, pm.after), fs.readFileSync(path.join(dir, pm.before)));
    expect(pairProblems(dir, written)).toEqual([
      "PB-97-S3 pm before and after are byte-identical",
    ]);

    fs.writeFileSync(path.join(dir, pm.after), "after-PB-97-S3-pm");
    const withoutExecutive = written.filter(
      (row) => !(row.scenario === "PB-97-S3" && row.role === "executive"),
    );
    expect(pairProblems(dir, withoutExecutive)).toEqual([
      "PB-97-S3 executive lacks a pair",
    ]);
  });
});

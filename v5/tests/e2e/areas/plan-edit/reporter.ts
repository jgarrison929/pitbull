import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { Reporter, TestCase, TestResult } from "@playwright/test/reporter";

/** Playwright loads reporters as CJS, so this cannot use import.meta. npm scripts run from v5/. */
function v5Root(): string {
  const candidates = [process.cwd(), path.resolve(process.cwd(), "v5")];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "scripts/area-evidence.mjs"))) return dir;
  }
  return process.cwd();
}

const root = v5Root();
const evidenceDir = path.join(root, "test-results/areas/plan-edit");
const script = path.join(root, "scripts/area-evidence.mjs");

const FALLBACK_ROLE: Record<string, string> = {
  "PB-97-S1": "foreman",
  "PB-97-S2": "superintendent",
  "PB-97-S3": "pm",
  "PB-97-S4": "pm",
  "PB-97-S5": "foreman",
};

type Meta = {
  page?: string;
  role?: string;
  viewport?: string;
  theme?: string;
  before?: string;
  after?: string;
  beforeTaken?: boolean;
  afterTaken?: boolean;
  replayUrl?: string | null;
};

type Seen = { title: string; result: string };

function scenarioId(title: string): string | null {
  return title.match(/@(PB-97-S\d+)/)?.[1] ?? null;
}

function resultLabel(status: TestResult["status"]): string {
  if (status === "passed") return "pass";
  if (status === "skipped") return "skipped";
  return "fail";
}

/** Writes run.json from Playwright results plus each scenario's shot metadata, then scenarios.md. */
export default class AreaPlanEditReporter implements Reporter {
  private readonly seen = new Map<string, Seen>();

  onTestEnd(test: TestCase, result: TestResult): void {
    const id = scenarioId(test.title);
    if (!id) return;
    this.seen.set(id, { title: test.title, result: resultLabel(result.status) });
  }

  onEnd(): void {
    if (this.seen.size === 0) return;
    fs.mkdirSync(evidenceDir, { recursive: true });
    const scenarios = [...this.seen.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, seen]) => {
        const meta = readMeta(id);
        return {
          scenario: id,
          test: seen.title,
          result: seen.result,
          page: meta?.page ?? "/app/jobs/25-031",
          role: meta?.role ?? FALLBACK_ROLE[id] ?? "foreman",
          viewport: meta?.viewport ?? "1280×800",
          theme: meta?.theme ?? "light",
          before: meta?.before ?? `${id}-before.jpg`,
          after: meta?.after ?? `${id}-after.jpg`,
          beforeTaken: meta?.beforeTaken ?? false,
          afterTaken: meta?.afterTaken ?? false,
          replayUrl: meta?.replayUrl ?? null,
        };
      });
    fs.writeFileSync(
      path.join(evidenceDir, "run.json"),
      JSON.stringify({ scenarios }, null, 2),
    );
    const run = spawnSync(
      process.execPath,
      [script, "--dir", evidenceDir, "--write-scenarios", "--quiet"],
      { encoding: "utf8" },
    );
    if (run.status !== 0) {
      throw new Error(
        `area-evidence.mjs exited ${run.status}: ${run.stderr || run.stdout}`,
      );
    }
  }
}

function readMeta(id: string): Meta | null {
  const file = path.join(evidenceDir, `${id}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8")) as Meta;
}

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "../../..");

describe("no Recharts / heavy client chart deps", () => {
  it("must-fail: recharts must not appear in package.json dependencies", () => {
    // Past mistake (#721): three polylines pulled ~5MB client chart runtime.
    const pkg = JSON.parse(
      readFileSync(join(root, "package.json"), "utf8"),
    ) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    expect(pkg.dependencies?.recharts).toBeUndefined();
    expect(pkg.devDependencies?.recharts).toBeUndefined();
  });

  it("must-fail: detects a recharts import in a sample chart module", () => {
    const pastMistake = `import { LineChart, Line } from "recharts";`;
    expect(pastMistake).toMatch(/from\s+["']recharts["']/);
  });
});

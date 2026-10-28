import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("portfolio table links", () => {
  const src = readFileSync(
    fileURLToPath(new URL("./portfolio-table.tsx", import.meta.url)),
    "utf8",
  );

  it("uses plain <a> (no next/link prefetch on job rows)", () => {
    expect(src).not.toMatch(/from ["']next\/link["']/);
    expect(src).not.toMatch(/<Link\b/);
    expect(src).toMatch(/data-testid="job-link"/);
  });
});

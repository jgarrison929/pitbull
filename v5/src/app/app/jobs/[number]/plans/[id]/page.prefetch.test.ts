import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("plan detail links", () => {
  const src = readFileSync(
    fileURLToPath(new URL("./page.tsx", import.meta.url)),
    "utf8",
  );

  it("uses plain <a> for back + cost-code links (no next/link prefetch)", () => {
    // Must-fail: next/link (even prefetch={false}) fires ?_rsc= after paint and
    // held superintendent plan-page networkidle ~1.0–1.6 s on staging 5.0.3.
    expect(src).not.toMatch(/from ["']next\/link["']/);
    expect(src).not.toMatch(/<Link\b/);
    expect(src).toMatch(/data-testid="plan-detail-back"/);
    expect(src).toMatch(/<a\b[\s\S]*data-testid="plan-detail-back"/);
    expect(src).toMatch(/\/cost-items\//);
  });
});

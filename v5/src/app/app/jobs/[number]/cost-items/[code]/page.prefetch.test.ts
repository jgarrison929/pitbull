import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("cost-item drill links", () => {
  const src = readFileSync(
    fileURLToPath(new URL("./page.tsx", import.meta.url)),
    "utf8",
  );

  it("uses plain <a> for back + plan-entry links (no next/link prefetch)", () => {
    expect(src).not.toMatch(/from ["']next\/link["']/);
    expect(src).toMatch(/data-testid="cost-item-back"/);
    expect(src).toMatch(/data-testid="cost-entry-plan-link"/);
    expect(src).toMatch(/<a\b[\s\S]*data-testid="cost-item-back"/);
    expect(src).toMatch(/<a\b[\s\S]*data-testid="cost-entry-plan-link"/);
  });
});

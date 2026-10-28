import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("cost table links", () => {
  const src = readFileSync(
    fileURLToPath(new URL("./cost-table.tsx", import.meta.url)),
    "utf8",
  );

  it("uses plain <a> (no next/link prefetch on cost-code links)", () => {
    expect(src).not.toMatch(/from ["']next\/link["']/);
    expect(src).not.toMatch(/<Link\b/);
    expect(src).toMatch(/cost-code-link-/);
  });
});

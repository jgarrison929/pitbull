import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("changes page links", () => {
  const src = readFileSync(
    fileURLToPath(new URL("./page.tsx", import.meta.url)),
    "utf8",
  );

  it("uses plain <a> (no next/link prefetch on the changes page)", () => {
    expect(src).not.toMatch(/from ["']next\/link["']/);
    expect(src).not.toMatch(/<Link\b/);
    expect(src).toMatch(/data-testid="changes-back"/);
  });
});

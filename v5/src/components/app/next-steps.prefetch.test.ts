import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("next-step links", () => {
  const src = readFileSync(
    fileURLToPath(new URL("./next-steps.tsx", import.meta.url)),
    "utf8",
  );

  it("uses plain <a> so a journey tap is a full load", () => {
    expect(src).not.toMatch(/from ["']next\/link["']/);
    expect(src).not.toMatch(/<Link\b/);
    expect(src).toMatch(/data-testid="next-step"/);
  });
});

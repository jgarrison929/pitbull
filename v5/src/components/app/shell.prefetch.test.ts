import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("AppShell Link prefetch", () => {
  const src = readFileSync(
    fileURLToPath(new URL("./shell.tsx", import.meta.url)),
    "utf8",
  );

  it("disables prefetch on Brand and Switch-role links", () => {
    const hits = src.match(/prefetch=\{false\}/g) ?? [];
    expect(hits.length).toBeGreaterThanOrEqual(2);
  });
});

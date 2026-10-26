import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("NavLink prefetch", () => {
  const src = readFileSync(
    fileURLToPath(new URL("./nav-link.tsx", import.meta.url)),
    "utf8",
  );

  it("disables automatic Link prefetch on shell nav (viewport burst)", () => {
    // Must-fail against default prefetch=true: both the Suspense fallback Link
    // and the active Link fire ?_rsc= for every on-screen tab / job pill.
    const hits = src.match(/prefetch=\{false\}/g) ?? [];
    expect(hits.length).toBeGreaterThanOrEqual(2);
    expect(src).not.toMatch(/prefetch=\{true\}/);
  });
});

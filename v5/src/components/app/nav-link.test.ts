import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("NavLink", () => {
  const src = readFileSync(
    fileURLToPath(new URL("./nav-link.tsx", import.meta.url)),
    "utf8",
  );

  it("uses plain <a> instead of next/link (no post-paint ?_rsc= prefetch)", () => {
    // Must-fail: next/link with prefetch={false} still fires router prefetches
    // under Next 16.4 + partialPrefetching and holds cost-item networkidle.
    expect(src).not.toMatch(/from ["']next\/link["']/);
    expect(src).not.toMatch(/<Link\b/);
    expect(src).toMatch(/<a\b/);
  });
});

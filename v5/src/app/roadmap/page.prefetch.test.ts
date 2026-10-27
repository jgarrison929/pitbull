import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("roadmap chrome links", () => {
  const src = readFileSync(
    fileURLToPath(new URL("./page.tsx", import.meta.url)),
    "utf8",
  );

  it("uses plain <a> (no next/link /app?_rsc= prefetch)", () => {
    // Same leftover as changelog: Link href="/app" aborted when the crawl
    // left /roadmap. Keep chrome + shipped version anchors as plain <a>.
    expect(src).not.toMatch(/from ["']next\/link["']/);
    expect(src).not.toMatch(/<Link\b/);
    expect(src).toMatch(/href="\/app"/);
    expect(src).toMatch(/href="\/changelog"/);
    expect(src).toMatch(/href="\/status"/);
    expect(src).toMatch(/href=\{`\/changelog#\$\{r\.version\}`\}/);
  });
});

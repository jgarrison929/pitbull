import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("changelog chrome links", () => {
  const src = readFileSync(
    fileURLToPath(new URL("./page.tsx", import.meta.url)),
    "utf8",
  );

  it("uses plain <a> (no next/link /app?_rsc= prefetch)", () => {
    // Staging verify after #29 still saw ERR_ABORTED /app?_rsc= next to
    // /changelog navigations — next/link Back-to-Pitbull fired the prefetch.
    expect(src).not.toMatch(/from ["']next\/link["']/);
    expect(src).not.toMatch(/<Link\b/);
    expect(src).toMatch(/href="\/app"/);
    expect(src).toMatch(/href="\/roadmap"/);
    expect(src).toMatch(/href="\/status"/);
  });
});

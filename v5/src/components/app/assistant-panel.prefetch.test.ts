import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("AssistantPanel Open links", () => {
  const src = readFileSync(
    fileURLToPath(new URL("./assistant-panel.tsx", import.meta.url)),
    "utf8",
  );

  it("uses plain <a> for action Open hrefs (no next/link RSC prefetch)", () => {
    // Desktop rail (lg+) mounts these; next/link prefetches held cost-item
    // networkidle @1280 in CI after NavLink was already switched to <a>.
    expect(src).not.toMatch(/from ["']next\/link["']/);
    expect(src).not.toMatch(/<Link\b/);
    expect(src).toMatch(/r\.args\.href/);
    expect(src).toMatch(/<a\b[\s\S]*href=\{r\.args\.href\}/);
  });
});

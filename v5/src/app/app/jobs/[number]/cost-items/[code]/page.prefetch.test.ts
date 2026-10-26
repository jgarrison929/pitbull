import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("cost-item drill Link prefetch", () => {
  const src = readFileSync(
    fileURLToPath(new URL("./page.tsx", import.meta.url)),
    "utf8",
  );

  it("disables prefetch on back + plan-entry links", () => {
    expect(src).toMatch(/data-testid="cost-item-back"[\s\S]*?prefetch=\{false\}/);
    expect(src).toMatch(
      /data-testid="cost-entry-plan-link"[\s\S]*?prefetch=\{false\}/,
    );
  });
});

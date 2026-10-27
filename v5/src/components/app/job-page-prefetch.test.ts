import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Wiring guard only — behavior is locked in
 * `tests/e2e/job-page-prefetch.spec.ts` (render + no post-paint ?_rsc=).
 * Keep plan-card edits minimal (#63 owns neighboring changes there).
 */
describe("job page drill links (wiring)", () => {
  it("cost-table does not import next/link", () => {
    const src = readFileSync(
      fileURLToPath(new URL("./cost-table.tsx", import.meta.url)),
      "utf8",
    );
    expect(src).not.toMatch(/from ["']next\/link["']/);
  });

  it("plan-card does not import next/link", () => {
    const src = readFileSync(
      fileURLToPath(new URL("./plan-card.tsx", import.meta.url)),
      "utf8",
    );
    expect(src).not.toMatch(/from ["']next\/link["']/);
  });

  it("job page does not import next/link", () => {
    const src = readFileSync(
      fileURLToPath(
        new URL("../../app/app/jobs/[number]/page.tsx", import.meta.url),
      ),
      "utf8",
    );
    expect(src).not.toMatch(/from ["']next\/link["']/);
  });
});

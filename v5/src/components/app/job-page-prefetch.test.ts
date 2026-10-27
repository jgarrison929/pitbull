import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Job-page drill Links under Next 16.4 + partialPrefetching fire post-paint
 * `?_rsc=` into the proxy+app pools and hold verify networkidle on the warm
 * 24-browser burst (24-077 / 24-118). Same root cause as NavLink / #29.
 */
describe("job page drill links avoid next/link prefetch", () => {
  it("cost-table leaf codes use plain <a>", () => {
    const src = readFileSync(
      fileURLToPath(new URL("./cost-table.tsx", import.meta.url)),
      "utf8",
    );
    expect(src).not.toMatch(/from ["']next\/link["']/);
    expect(src).toMatch(/data-testid=\{`cost-code-link-\$\{n\.code\}`\}/);
    expect(src).toMatch(/<a\b/);
  });

  it("plan-card detail link uses plain <a>", () => {
    const src = readFileSync(
      fileURLToPath(new URL("./plan-card.tsx", import.meta.url)),
      "utf8",
    );
    expect(src).not.toMatch(/from ["']next\/link["']/);
    expect(src).toMatch(/data-testid="plan-detail-link"/);
    expect(src).toMatch(/<a[\s\S]*?data-testid="plan-detail-link"/);
  });

  it("job page full-change-list link uses plain <a>", () => {
    const src = readFileSync(
      fileURLToPath(
        new URL("../../app/app/jobs/[number]/page.tsx", import.meta.url),
      ),
      "utf8",
    );
    expect(src).not.toMatch(/from ["']next\/link["']/);
    expect(src).toMatch(/data-testid="job-changes-full-link"/);
    expect(src).toMatch(/<a[\s\S]*?data-testid="job-changes-full-link"/);
  });
});

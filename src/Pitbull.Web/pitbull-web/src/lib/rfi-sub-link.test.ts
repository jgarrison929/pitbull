import { describe, it, expect } from "vitest";
import { buildProjectRfisForSubHref } from "./rfi-sub-link";

describe("buildProjectRfisForSubHref (2.14.6)", () => {
  it("filters RFIs by sub name search without inventing health scores", () => {
    const href = buildProjectRfisForSubHref("p1", { subName: "Acme Concrete" });
    expect(href).toBe("/projects/p1/rfis?search=Acme+Concrete");
    expect(href).not.toMatch(/health|score/i);
  });
});

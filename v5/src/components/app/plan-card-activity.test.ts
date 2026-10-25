import { describe, expect, it } from "vitest";
import { activityLabel } from "./plan-card";

describe("honesty: plan activity wrap", () => {
  it("binds a trailing short token with nbsp so phone cannot orphan '2'", () => {
    // Bug: "Pour Pier 3 column, lift 2" wrapped so "2" sat alone on the next line.
    const labeled = activityLabel("Pour Pier 3 column, lift 2");
    expect(labeled).toContain("lift\u00A02");
    expect(labeled.endsWith("2")).toBe(true);
    expect(labeled).not.toMatch(/lift 2$/);
  });
});

import { describe, it, expect } from "vitest";
import { buildProgressDraftHref } from "./progress-deep-link";

describe("buildProgressDraftHref (2.14.4)", () => {
  it("links schedule activity into progress with preselect query params", () => {
    const href = buildProgressDraftHref("p1", {
      activityId: "act-9",
      activityName: "Pour foundation",
    });
    expect(href).toContain("/projects/p1/progress");
    expect(href).toContain("activityId=act-9");
    expect(href).toContain("activityName=Pour");
  });
});

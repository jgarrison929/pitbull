import { describe, expect, it } from "vitest";
import {
  formatSubmittalDueLabel,
  isSubmittalOverdue,
  submittalMobileListUrl,
  submittalTypeLabel,
  SUBMITTAL_LIST_EMPTY_DESCRIPTION,
  SUBMITTAL_LIST_EMPTY_TITLE,
} from "./submittal-mobile-list";

describe("submittal-mobile-list (3.4.6)", () => {
  it("builds slim list URL with view=mobile", () => {
    expect(submittalMobileListUrl("proj-1", 50)).toBe(
      "/api/projects/proj-1/submittals?view=mobile&pageSize=50"
    );
  });

  it("overdue only when past due and not terminal", () => {
    const now = new Date(2026, 6, 21);
    expect(isSubmittalOverdue("2026-07-01", "InReview", now)).toBe(true);
    expect(isSubmittalOverdue("2026-07-01", "Approved", now)).toBe(false);
    expect(isSubmittalOverdue("2026-08-01", "Submitted", now)).toBe(false);
  });

  it("formats due with overdue prefix", () => {
    const now = new Date(2026, 6, 21);
    const over = formatSubmittalDueLabel("2026-07-01", "Submitted", now);
    expect(over.overdue).toBe(true);
    expect(over.text).toMatch(/^Overdue/);
  });

  it("type labels are human-readable", () => {
    expect(submittalTypeLabel("ShopDrawing")).toBe("Shop Drawing");
  });

  it("empty copy is not a health score", () => {
    expect(SUBMITTAL_LIST_EMPTY_TITLE.toLowerCase()).not.toMatch(/health|%|complete/);
    expect(SUBMITTAL_LIST_EMPTY_DESCRIPTION.toLowerCase()).toMatch(/not a register health/);
  });
});

import { describe, expect, it } from "vitest";
import {
  formatRfiDueLabel,
  isRfiOverdue,
  normalizeRfiStatus,
  rfiMobileListUrl,
  RFI_LIST_EMPTY_DESCRIPTION,
  RFI_LIST_EMPTY_TITLE,
} from "./rfi-mobile-list";

describe("rfi-mobile-list", () => {
  it("builds slim list URL with view=mobile", () => {
    expect(rfiMobileListUrl("abc-123", 25)).toBe(
      "/api/projects/abc-123/rfis?view=mobile&pageSize=25"
    );
  });

  it("normalizes string and numeric status honestly", () => {
    expect(normalizeRfiStatus("Open")).toBe("Open");
    expect(normalizeRfiStatus(0)).toBe("Open");
    expect(normalizeRfiStatus("answered")).toBe("Answered");
    expect(normalizeRfiStatus(2)).toBe("Closed");
  });

  it("marks overdue only when past due and not closed", () => {
    const now = new Date(2026, 6, 21); // local July 21 2026
    expect(isRfiOverdue("2026-07-01T00:00:00Z", "Open", now)).toBe(true);
    expect(isRfiOverdue("2026-07-01T00:00:00Z", "Closed", now)).toBe(false);
    expect(isRfiOverdue("2026-08-01T00:00:00Z", "Open", now)).toBe(false);
    expect(isRfiOverdue(null, "Open", now)).toBe(false);
  });

  it("formats due label with overdue prefix", () => {
    const now = new Date(2026, 6, 21);
    const over = formatRfiDueLabel("2026-07-01T12:00:00Z", 0, now);
    expect(over.overdue).toBe(true);
    expect(over.text).toMatch(/^Overdue/);
    const future = formatRfiDueLabel("2026-08-01T12:00:00Z", "Open", now);
    expect(future.overdue).toBe(false);
    expect(future.text).toMatch(/^Due /);
  });

  it("empty copy is honest — not a health score", () => {
    expect(RFI_LIST_EMPTY_TITLE.toLowerCase()).not.toMatch(/health|all clear|resolved/);
    expect(RFI_LIST_EMPTY_DESCRIPTION.toLowerCase()).toMatch(/not a health/);
  });
});

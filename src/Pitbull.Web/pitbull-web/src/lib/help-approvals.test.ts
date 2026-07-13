import { describe, expect, it } from "vitest";
import {
  APPROVALS_HELP_SECTION_TITLE,
  approvalsFaqItems,
  approvalsHelpCards,
} from "./help-approvals";

describe("help approvals (2.21.9)", () => {
  it("covers pending card and mobile approve paths", () => {
    expect(APPROVALS_HELP_SECTION_TITLE).toMatch(/Approvals/i);
    const ids = approvalsHelpCards.map((c) => c.id);
    expect(ids).toContain("mobile-time-approve");
    expect(ids).toContain("pm-pending-card");
    expect(
      approvalsHelpCards.find((c) => c.id === "mobile-time-approve")?.href
    ).toBe("/time-tracking/approval/mobile");
  });

  it("FAQ freezes time entries as mobile lifecycle", () => {
    const blob = approvalsFaqItems.map((f) => f.answer).join("\n");
    expect(blob).toMatch(/time entr/i);
    expect(blob).toMatch(/2\.21\.3|freeze|only/i);
    expect(blob.toLowerCase()).not.toMatch(/all clear|fake count/);
  });
});

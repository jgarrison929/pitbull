import { describe, it, expect } from "vitest";
import {
  fieldWorkflowCards,
  FIELD_WORKFLOWS_SECTION_TITLE,
  mobileFaqItems,
} from "./help-field-workflows";

/**
 * 2.12.7 — asserts shipped Help field-workflow data drives real routes.
 */
describe("help-field-workflows", () => {
  it("exposes section title for Field & mobile workflows", () => {
    expect(FIELD_WORKFLOWS_SECTION_TITLE).toBe("Field & mobile workflows");
  });

  it("2.12.8 mobile FAQ is truthful (no fully-responsive blanket; real routes)", () => {
    const blob = mobileFaqItems.map((f) => f.answer).join("\n");
    expect(blob.toLowerCase()).not.toContain("fully responsive");
    expect(blob).toContain("/daily-reports/mobile");
    expect(blob).toMatch(/bottom nav|Report/i);
    expect(blob).toMatch(/offline|PWA|queue/i);
    expect(blob).toContain("/projects/{id}/twin");
    expect(blob).toContain("/projects/{id}/plans-specs");
  });

  it("ships Daily Field Report, Site Walk, Offline/PWA with deep links and 3–5 steps", () => {
    expect(fieldWorkflowCards.map((c) => c.id)).toEqual([
      "daily-field-report",
      "site-walk",
      "offline-pwa",
    ]);

    const report = fieldWorkflowCards.find((c) => c.id === "daily-field-report")!;
    expect(report.href).toBe("/daily-reports/mobile");
    expect(report.title).toBe("Daily Field Report");
    expect(report.steps.length).toBeGreaterThanOrEqual(3);
    expect(report.steps.length).toBeLessThanOrEqual(5);

    const walk = fieldWorkflowCards.find((c) => c.id === "site-walk")!;
    expect(walk.href).toBe("/projects");
    expect(walk.steps.some((s) => s.includes("/projects/{id}/site-walk"))).toBe(
      true
    );

    const offline = fieldWorkflowCards.find((c) => c.id === "offline-pwa")!;
    expect(offline.href).toBe("/daily-reports/mobile");
    expect(offline.steps.some((s) => /offline|pwa|queue|sync/i.test(s))).toBe(
      true
    );
  });
});

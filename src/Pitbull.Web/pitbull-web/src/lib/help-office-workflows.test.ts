import { describe, expect, it } from "vitest";
import {
  OFFICE_WORKFLOWS_SECTION_TITLE,
  officeFaqItems,
  officeHelpCards,
} from "./help-office-workflows";

describe("help office workflows (2.22.1)", () => {
  it("covers CEO, CFO, PM, Estimator cards with real hrefs", () => {
    expect(OFFICE_WORKFLOWS_SECTION_TITLE).toMatch(/Office/i);
    const personas = officeHelpCards.map((c) => c.persona).sort();
    expect(personas).toEqual(["ceo", "cfo", "estimator", "pm"]);
    for (const card of officeHelpCards) {
      expect(card.steps.length).toBeGreaterThanOrEqual(3);
      expect(card.steps.length).toBeLessThanOrEqual(5);
      expect(card.href.startsWith("/")).toBe(true);
      expect(card.title.length).toBeGreaterThan(0);
    }
  });

  it("uses known live routes (no fake destinations)", () => {
    const byId = Object.fromEntries(officeHelpCards.map((c) => [c.id, c]));
    expect(byId["ceo-briefing"]?.href).toBe("/");
    expect(byId["cfo-wip"]?.href).toBe("/accounting/wip");
    expect(byId["pm-approvals"]?.href).toBe("/");
    expect(byId["estimator-pipeline"]?.href).toBe("/bids?pipeline=open");
  });

  it("labels AR−AP as proxy and empty queues as honest", () => {
    const blob = officeHelpCards
      .flatMap((c) => c.steps)
      .join("\n")
      .toLowerCase();
    expect(blob).toMatch(/proxy/);
    expect(blob).toMatch(/honest|empty|zero/);
    // Reject polish claims — allow cautionary "not all clear" / "not invented"
    expect(blob).not.toMatch(/fake kpi/);
    expect(blob).not.toMatch(/(?:is|are|shows)\s+all clear/);
  });

  it("office FAQ covers title-first profiles and honest KPI drills (2.22.2)", () => {
    expect(officeFaqItems.length).toBeGreaterThanOrEqual(3);
    const blob = officeFaqItems.map((f) => `${f.question} ${f.answer}`).join("\n");
    expect(blob).toMatch(/title-first|role_profile|job_title/i);
    expect(blob).toMatch(/demo/i);
    expect(blob).toMatch(/proxy|drill/i);
    expect(blob.toLowerCase()).not.toMatch(/fake consolidation|invented kpi totals/);
  });
});

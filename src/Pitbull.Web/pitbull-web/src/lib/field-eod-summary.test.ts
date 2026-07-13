import { describe, expect, it } from "vitest";
import {
  buildLlmEodSuggestionFromText,
  buildRuleBasedEodSummary,
} from "./field-eod-summary";

describe("rule-based EOD summary (2.20.0)", () => {
  it("summarizes entered fields without inventing KPIs", () => {
    const s = buildRuleBasedEodSummary({
      projectLabel: "26-001 — Tower",
      reportDate: "2026-07-12",
      activities: ["Concrete pour"],
      crewHeadcount: 8,
      workNarrative: "East pour complete",
      delaysNarrative: "",
      safetyNarrative: "Toolbox talk",
      photoCount: 2,
      hasZone: true,
    });
    expect(s.source).toBe("rule-based");
    expect(s.title).toMatch(/rule-based/i);
    expect(s.bullets.some((b) => b.includes("Concrete pour"))).toBe(true);
    expect(s.bullets.some((b) => b.includes("8"))).toBe(true);
    expect(s.truthNote).toMatch(/not an executive KPI/i);
    expect(s.truthNote).toMatch(/No LLM/i);
    expect(s.bullets.join(" ")).not.toMatch(/\b100%|\$\d|all clear\b/i);
  });

  it("handles empty form honestly", () => {
    const s = buildRuleBasedEodSummary({
      projectLabel: "",
      reportDate: "2026-07-12",
      activities: [],
      crewHeadcount: 0,
      workNarrative: "",
      delaysNarrative: "",
      safetyNarrative: "",
      photoCount: 0,
      hasZone: false,
    });
    expect(s.bullets.some((b) => /none entered|none noted/i.test(b))).toBe(
      true
    );
  });

  it("LLM suggestion wrapper is labeled and not rule-based source", () => {
    const s = buildLlmEodSuggestionFromText({
      prose: "- Poured east\n- Rain delay AM",
      model: "test-model",
    });
    expect(s.source).toBe("llm-suggestion");
    expect(s.bullets).toEqual(["Poured east", "Rain delay AM"]);
    expect(s.truthNote).toMatch(/Suggestion|review/i);
    expect(s.truthNote).toMatch(/test-model/);
  });
});

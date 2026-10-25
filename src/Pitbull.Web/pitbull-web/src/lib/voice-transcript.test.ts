import { describe, expect, it } from "vitest";
import {
  applyVoiceTranscriptToNarratives,
  classifyVoiceTranscript,
  cleanTranscript,
  narrativesFromVoiceApply,
} from "./voice-transcript";

describe("cleanTranscript", () => {
  it("collapses whitespace", () => {
    expect(cleanTranscript("  poured   120 yards  ")).toBe("poured 120 yards");
  });
});

describe("classifyVoiceTranscript", () => {
  it("routes delay language to delaysNarrative", () => {
    expect(classifyVoiceTranscript("Waiting on rebar delivery delay")).toBe(
      "delaysNarrative"
    );
  });

  it("routes safety language to safetyNarrative", () => {
    expect(classifyVoiceTranscript("Toolbox talk complete, no near miss")).toBe(
      "safetyNarrative"
    );
  });

  it("defaults work narrative for progress speech", () => {
    expect(classifyVoiceTranscript("Poured 120 yards east wall")).toBe(
      "workNarrative"
    );
  });
});

describe("applyVoiceTranscriptToNarratives", () => {
  it("writes transcript into work narrative form state", () => {
    const next = applyVoiceTranscriptToNarratives(
      { workNarrative: "", delaysNarrative: "", safetyNarrative: "" },
      "Poured 120 yards in east wall, rebar looks good"
    );
    expect(next.workNarrative).toContain("Poured 120 yards");
    expect(next.delaysNarrative).toBe("");
  });

  it("appends to existing field content", () => {
    const next = applyVoiceTranscriptToNarratives(
      {
        workNarrative: "Morning pour complete.",
        delaysNarrative: "",
        safetyNarrative: "",
      },
      "Afternoon finish work"
    );
    expect(next.workNarrative).toContain("Morning pour complete.");
    expect(next.workNarrative).toContain("Afternoon finish work");
  });

  it("respects explicit field override", () => {
    const next = applyVoiceTranscriptToNarratives(
      { workNarrative: "", delaysNarrative: "", safetyNarrative: "" },
      "rain delay on north side",
      "workNarrative"
    );
    expect(next.workNarrative).toContain("rain delay");
    expect(next.delaysNarrative).toBe("");
  });
});

describe("narrativesFromVoiceApply", () => {
  it("is the entry point voice control uses for form updates", () => {
    const next = narrativesFromVoiceApply(
      { workNarrative: "", delaysNarrative: "", safetyNarrative: "" },
      "Safety stand-down after PPE check"
    );
    expect(next.safetyNarrative.toLowerCase()).toMatch(/safety|ppe/);
  });
});

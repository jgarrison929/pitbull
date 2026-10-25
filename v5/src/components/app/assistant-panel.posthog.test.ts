import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("AssistantPanel PostHog wiring", () => {
  const src = readFileSync(
    fileURLToPath(new URL("./assistant-panel.tsx", import.meta.url)),
    "utf8",
  );

  it("marks the question box with data-ph-unmask", () => {
    expect(src).toMatch(/data-ph-unmask/);
    expect(src).toMatch(/data-testid="assistant-input"/);
  });

  it("fires captureAiQuestionAsked on submit", () => {
    expect(src).toMatch(/captureAiQuestionAsked/);
    expect(src).toMatch(/onSubmit=\{onSubmit\}/);
    expect(src).toMatch(/ai_question_asked|captureAiQuestionAsked\(\{/);
  });
});

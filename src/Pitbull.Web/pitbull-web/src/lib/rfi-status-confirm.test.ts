import { describe, expect, it } from "vitest";
import { RfiStatus } from "./types";
import {
  evaluateRfiStatusTransition,
  rfiWorkflowActionLabel,
} from "./rfi-status-confirm";

describe("evaluateRfiStatusTransition (3.4.5 confirm-to-submit)", () => {
  it("blocks POST when not confirmed even if transition is valid", () => {
    const result = evaluateRfiStatusTransition({
      confirmed: false,
      currentStatus: RfiStatus.Open,
      nextStatus: RfiStatus.Answered,
      hasAnswer: true,
    });
    expect(result.mayPost).toBe(false);
    if (!result.mayPost) {
      expect(result.reason).toBe("not_confirmed");
    }
  });

  it("allows POST only after confirm for Open → Answered with answer", () => {
    const result = evaluateRfiStatusTransition({
      confirmed: true,
      currentStatus: "Open",
      nextStatus: RfiStatus.Answered,
      hasAnswer: true,
    });
    expect(result.mayPost).toBe(true);
    if (result.mayPost) {
      expect(result.next).toBe(RfiStatus.Answered);
      expect(result.label).toBe("Answered");
    }
  });

  it("requires answer before Answered even when confirmed", () => {
    const result = evaluateRfiStatusTransition({
      confirmed: true,
      currentStatus: RfiStatus.Open,
      nextStatus: RfiStatus.Answered,
      hasAnswer: false,
    });
    expect(result.mayPost).toBe(false);
    if (!result.mayPost) {
      expect(result.reason).toBe("answer_required");
    }
  });

  it("rejects invalid transition Open → Closed", () => {
    const result = evaluateRfiStatusTransition({
      confirmed: true,
      currentStatus: RfiStatus.Open,
      nextStatus: RfiStatus.Closed,
      hasAnswer: true,
    });
    expect(result.mayPost).toBe(false);
    if (!result.mayPost) {
      expect(result.reason).toBe("invalid_transition");
    }
  });

  it("allows Answered → Closed when confirmed", () => {
    const result = evaluateRfiStatusTransition({
      confirmed: true,
      currentStatus: RfiStatus.Answered,
      nextStatus: RfiStatus.Closed,
      hasAnswer: true,
    });
    expect(result.mayPost).toBe(true);
  });

  it("workflow action labels are jobsite-clear", () => {
    expect(rfiWorkflowActionLabel(RfiStatus.Answered)).toBe("Mark Answered");
    expect(rfiWorkflowActionLabel(RfiStatus.Closed)).toBe("Close RFI");
    expect(rfiWorkflowActionLabel(RfiStatus.Open)).toBe("Reopen");
  });
});

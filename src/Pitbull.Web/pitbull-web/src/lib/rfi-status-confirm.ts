import {
  getNextRfiStatuses,
  parseRfiStatus,
  rfiStatusLabel,
} from "./workflow-transitions";
import { RfiStatus } from "./types";

/**
 * Confirm-to-submit gate for RFI status workflow PUTs (band 3.5 / 3.4.5).
 * Status must not post on a single accidental tap — caller must pass confirmed=true
 * after an explicit user confirm step (dialog).
 */

export type RfiStatusConfirmInput = {
  /** User explicitly confirmed the transition in UI */
  confirmed: boolean;
  currentStatus: RfiStatus | string | number;
  nextStatus: RfiStatus | string | number;
  /** Answer text present on RFI or in draft field */
  hasAnswer: boolean;
};

export type RfiStatusConfirmDenial =
  | "not_confirmed"
  | "answer_required"
  | "invalid_transition"
  | "same_status";

export type RfiStatusConfirmResult =
  | { mayPost: true; next: RfiStatus; label: string }
  | { mayPost: false; reason: RfiStatusConfirmDenial; message: string };

/**
 * Pure guard: whether a status-changing PUT may proceed.
 * Real entry used by RFI detail workflow buttons.
 */
export function evaluateRfiStatusTransition(
  input: RfiStatusConfirmInput
): RfiStatusConfirmResult {
  const current = parseRfiStatus(input.currentStatus);
  const next = parseRfiStatus(input.nextStatus);

  if (!input.confirmed) {
    return {
      mayPost: false,
      reason: "not_confirmed",
      message: "Confirm the status change before submitting.",
    };
  }

  if (current === next) {
    return {
      mayPost: false,
      reason: "same_status",
      message: "Status is already set.",
    };
  }

  const allowed = getNextRfiStatuses(current);
  if (!allowed.includes(next)) {
    return {
      mayPost: false,
      reason: "invalid_transition",
      message: `Cannot change from ${rfiStatusLabel(current)} to ${rfiStatusLabel(next)}.`,
    };
  }

  if (next === RfiStatus.Answered && !input.hasAnswer) {
    return {
      mayPost: false,
      reason: "answer_required",
      message: "An answer is required before marking as Answered.",
    };
  }

  return {
    mayPost: true,
    next,
    label: rfiStatusLabel(next),
  };
}

/** Action button label for a next status (phone-friendly). */
export function rfiWorkflowActionLabel(next: RfiStatus): string {
  switch (next) {
    case RfiStatus.Answered:
      return "Mark Answered";
    case RfiStatus.Closed:
      return "Close RFI";
    case RfiStatus.Open:
      return "Reopen";
    default:
      return rfiStatusLabel(next);
  }
}

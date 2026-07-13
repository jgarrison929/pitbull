import { describe, expect, it } from "vitest";
import { TimeEntryStatus } from "./types";
import {
  canReviewTimeEntryFromSubmitted,
  canTransitionTimeEntry,
  getNextTimeEntryStatuses,
  timeEntryAllowedTransitions,
} from "./workflow-transitions";

describe("time entry transitions (2.21.8 mirror)", () => {
  it("matches C# graph: Draft → Submitted only", () => {
    expect(getNextTimeEntryStatuses(TimeEntryStatus.Draft)).toEqual([
      TimeEntryStatus.Submitted,
    ]);
  });

  it("Submitted can approve, reject, or return to draft", () => {
    const next = getNextTimeEntryStatuses(TimeEntryStatus.Submitted);
    expect(next).toContain(TimeEntryStatus.Approved);
    expect(next).toContain(TimeEntryStatus.Rejected);
    expect(next).toContain(TimeEntryStatus.Draft);
  });

  it("Approved is terminal", () => {
    expect(getNextTimeEntryStatuses(TimeEntryStatus.Approved)).toEqual([]);
    expect(
      canTransitionTimeEntry(TimeEntryStatus.Approved, TimeEntryStatus.Draft)
    ).toBe(false);
  });

  it("review path only from Submitted", () => {
    expect(canReviewTimeEntryFromSubmitted("approve")).toBe(true);
    expect(canReviewTimeEntryFromSubmitted("reject")).toBe(true);
  });

  it("exposes same status enum labels as string keys for docs", () => {
    expect(TimeEntryStatus[TimeEntryStatus.Submitted]).toBe("Submitted");
    expect(timeEntryAllowedTransitions[TimeEntryStatus.Rejected]).toEqual([
      TimeEntryStatus.Draft,
      TimeEntryStatus.Submitted,
    ]);
  });
});

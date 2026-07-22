/**
 * Band 3.5–3.7 residual honesty tests over shipped mobile list helpers.
 */
import { describe, expect, it } from "vitest";
import { RFI_LIST_EMPTY_DESCRIPTION, rfiMobileListUrl } from "./rfi-mobile-list";
import {
  SUBMITTAL_LIST_EMPTY_DESCRIPTION,
  submittalMobileListUrl,
} from "./submittal-mobile-list";
import { CO_LIST_EMPTY_DESCRIPTION, coMobileListUrl } from "./co-mobile-list";
import {
  SCHEDULE_MOBILE_EMPTY,
  scheduleActivitiesMobileUrl,
} from "./schedule-mobile-list";
import {
  SUBCONTRACT_LIST_EMPTY_DESCRIPTION,
  mapSubcontractMobileRow,
  subcontractMobileListUrl,
  summarizeSubcontractListMoney,
} from "./subcontract-mobile-list";
import { SCHEDULE_KANBAN_EMPTY } from "./schedule-kanban";
import { evaluateRfiStatusTransition } from "./rfi-status-confirm";
import { RfiStatus } from "./types";
import { buildSubmittalWorkflowGlance } from "./submittal-workflow-glance";
import { cpmOnTrackClaimAllowed } from "./cpm-honesty";

describe("mobile list DTO honesty residual (3.4.9+)", () => {
  it("RFI, Submittal, CO, subcontract, and activity list URLs request view=mobile", () => {
    expect(rfiMobileListUrl("a")).toContain("view=mobile");
    expect(submittalMobileListUrl("b")).toContain("view=mobile");
    expect(coMobileListUrl("c")).toContain("view=mobile");
    expect(subcontractMobileListUrl("d")).toContain("view=mobile");
    expect(scheduleActivitiesMobileUrl("p", "s")).toContain("view=mobile");
  });

  it("empty copy never sells health", () => {
    for (const s of [
      RFI_LIST_EMPTY_DESCRIPTION,
      SUBMITTAL_LIST_EMPTY_DESCRIPTION,
      CO_LIST_EMPTY_DESCRIPTION,
      SUBCONTRACT_LIST_EMPTY_DESCRIPTION,
      SCHEDULE_MOBILE_EMPTY,
      SCHEDULE_KANBAN_EMPTY,
    ]) {
      const lower = s.toLowerCase();
      // May mention "health" only to reject it — must not claim all-clear / % complete
      expect(lower).not.toMatch(/all clear|% complete|are healthy/);
      expect(lower).toMatch(/not a |do not invent|never|not an |none/);
    }
  });

  it("CPM never allows invented on-track claim", () => {
    expect(cpmOnTrackClaimAllowed({ isCritical: false, totalFloat: 5 })).toBe(false);
    expect(cpmOnTrackClaimAllowed({})).toBe(false);
  });

  it("status transition still requires confirm", () => {
    const blocked = evaluateRfiStatusTransition({
      confirmed: false,
      currentStatus: RfiStatus.Open,
      nextStatus: RfiStatus.Answered,
      hasAnswer: true,
    });
    expect(blocked.mayPost).toBe(false);
  });

  it("submittal glance has no invented percent fields", () => {
    const steps = buildSubmittalWorkflowGlance("Submitted");
    expect(steps.every((s) => !("%" in s))).toBe(true);
    expect(JSON.stringify(steps)).not.toMatch(/health|percent/i);
  });

  it("subcontract money summary does not invent paid=$0 or remaining=full committed", () => {
    const summary = summarizeSubcontractListMoney([
      mapSubcontractMobileRow({
        id: "1",
        number: "SC",
        title: "T",
        status: "InProgress",
        amount: 10_000,
        // paidToDate omitted on purpose
      }),
    ]);
    expect(summary.totalPaidToDate).toBeNull();
    expect(summary.totalRemaining).toBeNull();
    expect(summary.totalRemaining).not.toBe(10_000);
  });
});

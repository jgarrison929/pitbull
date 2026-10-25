import { describe, it, expect } from "vitest";
import {
  ROLE_KPI_DRILL_CONTRACTS,
  allRoleKpiKeys,
} from "./role-kpi-drill-contracts";
import {
  parseAgingDrillParams,
  parseProjectsDrillParams,
  parseRfiDrillParams,
  parseTimeTrackingDrillParams,
  roleKpiDrillHref,
  rfiMatchesNotClosed,
} from "./role-kpi-drills";

/**
 * Ensures every KPI drill URL parses to the filter semantics documented next to
 * the RoleDashboardSummary (or analytics) headline predicate.
 */
describe("role KPI drill parity (contracts)", () => {
  it("has a contract for every RoleKpiKey and href matches roleKpiDrillHref", () => {
    for (const key of allRoleKpiKeys()) {
      const c = ROLE_KPI_DRILL_CONTRACTS[key];
      expect(c.href).toBe(roleKpiDrillHref(key));
      expect(c.headlineSource.length).toBeGreaterThan(0);
      expect(c.headlinePredicate.length).toBeGreaterThan(0);
    }
  });

  it("openRfis / viewRfis match Status != Closed (not Open-only)", () => {
    for (const key of ["openRfis", "viewRfis"] as const) {
      const href = roleKpiDrillHref(key);
      expect(href).toContain("status=notClosed");
      expect(href).not.toMatch(/status=open(?!Or)/i);
      const qs = href.split("?")[1] ?? "";
      const p = parseRfiDrillParams(new URLSearchParams(qs));
      expect(p.mode).toBe("notClosed");
      expect(ROLE_KPI_DRILL_CONTRACTS[key].expectedSemantics.rfiStatusMode).toBe(
        "notClosed"
      );
    }
    // Semantics: Open(0) + Answered(1) match; Closed(2) does not
    expect(rfiMatchesNotClosed(0)).toBe(true);
    expect(rfiMatchesNotClosed(1)).toBe(true);
    expect(rfiMatchesNotClosed(2)).toBe(false);
  });

  it("activeProjects matches Status != Completed (excludeCompleted)", () => {
    const href = roleKpiDrillHref("activeProjects");
    expect(href).toContain("excludeCompleted=true");
    const p = parseProjectsDrillParams(
      new URLSearchParams(href.split("?")[1] ?? "")
    );
    expect(p.excludeCompleted).toBe(true);
  });

  it("unbilledBacklog keeps unbilled + excludeCompleted", () => {
    const href = roleKpiDrillHref("unbilledBacklog");
    const p = parseProjectsDrillParams(
      new URLSearchParams(href.split("?")[1] ?? "")
    );
    expect(p.unbilled).toBe(true);
    expect(p.excludeCompleted).toBe(true);
  });

  it("arApNet is full board; arTotal/arOverdue are AR-focused; apNearTerm is AP near-term", () => {
    expect(roleKpiDrillHref("arApNet")).toBe("/billing/aging");
    expect(
      parseAgingDrillParams(new URLSearchParams("")).focus
    ).toBe("both");
    expect(
      parseAgingDrillParams(
        new URLSearchParams(roleKpiDrillHref("arTotal").split("?")[1] ?? "")
      ).focus
    ).toBe("ar");
    expect(
      parseAgingDrillParams(
        new URLSearchParams(roleKpiDrillHref("arOverdue").split("?")[1] ?? "")
      )
    ).toEqual({ focus: "ar", overdueOnly: true, nearTermOnly: false });
    expect(
      parseAgingDrillParams(
        new URLSearchParams(roleKpiDrillHref("apNearTerm").split("?")[1] ?? "")
      )
    ).toEqual({ focus: "ap", overdueOnly: false, nearTermOnly: true });
  });

  it("hoursThisWeek forces entries view + this-week range", () => {
    const href = roleKpiDrillHref("hoursThisWeek");
    const p = parseTimeTrackingDrillParams(
      new URLSearchParams(href.split("?")[1] ?? "")
    );
    expect(p.viewEntries).toBe(true);
    expect(p.periodThisWeek).toBe(true);
    expect(p.startDate).toBeTruthy();
    expect(p.endDate).toBeTruthy();
  });

  it("every contract expectedSemantics is consistent with href parse", () => {
    for (const key of allRoleKpiKeys()) {
      const c = ROLE_KPI_DRILL_CONTRACTS[key];
      const qs = c.href.includes("?") ? c.href.split("?")[1]! : "";
      const params = new URLSearchParams(qs);

      if ("excludeCompleted" in c.expectedSemantics) {
        expect(parseProjectsDrillParams(params).excludeCompleted).toBe(
          c.expectedSemantics.excludeCompleted
        );
      }
      if ("unbilled" in c.expectedSemantics) {
        expect(parseProjectsDrillParams(params).unbilled).toBe(
          c.expectedSemantics.unbilled
        );
      }
      if ("budgetAlert" in c.expectedSemantics) {
        const p = parseProjectsDrillParams(params);
        expect(p.budgetAlert).toBe(c.expectedSemantics.budgetAlert);
        if (typeof c.expectedSemantics.budgetAlertPercent === "number") {
          expect(p.budgetAlertPercent).toBe(
            c.expectedSemantics.budgetAlertPercent
          );
        }
      }
      if ("focus" in c.expectedSemantics) {
        const p = parseAgingDrillParams(params);
        expect(p.focus).toBe(c.expectedSemantics.focus);
        if ("overdueOnly" in c.expectedSemantics) {
          expect(p.overdueOnly).toBe(c.expectedSemantics.overdueOnly);
        }
        if ("nearTermOnly" in c.expectedSemantics) {
          expect(p.nearTermOnly).toBe(c.expectedSemantics.nearTermOnly);
        }
      }
      if ("rfiStatusMode" in c.expectedSemantics) {
        expect(parseRfiDrillParams(params).mode).toBe(
          c.expectedSemantics.rfiStatusMode
        );
      }
      if ("viewEntries" in c.expectedSemantics) {
        const p = parseTimeTrackingDrillParams(params);
        expect(p.viewEntries).toBe(c.expectedSemantics.viewEntries);
        if ("periodThisWeek" in c.expectedSemantics) {
          expect(p.periodThisWeek).toBe(c.expectedSemantics.periodThisWeek);
        }
      }
      if ("pipelineOpen" in c.expectedSemantics) {
        expect(params.get("pipeline") === "open").toBe(
          c.expectedSemantics.pipelineOpen
        );
      }
      if ("changeOrderOpen" in c.expectedSemantics) {
        expect(params.get("status") === "open").toBe(
          c.expectedSemantics.changeOrderOpen
        );
      }
      if ("scopeProgress" in c.expectedSemantics) {
        expect(params.get("scope") === "progress").toBe(
          c.expectedSemantics.scopeProgress
        );
      }
      if (
        "status" in c.expectedSemantics &&
        c.key === "complianceAttention"
      ) {
        expect(params.get("status")).toBe("attention");
      }
      if ("isActive" in c.expectedSemantics) {
        expect(params.get("isActive")).toBe(c.expectedSemantics.isActive);
      }
      if ("period" in c.expectedSemantics && c.key === "safetyYtd") {
        expect(params.get("period")).toBe("ytd");
      }
    }
  });
});

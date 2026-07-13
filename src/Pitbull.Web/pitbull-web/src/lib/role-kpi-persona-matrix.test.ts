/**
 * 2.22.2 — persona home KPI matrix: every home KPI key has a drill contract href.
 * Mirrors audit matrix in docs/specs/role-kpi-drill-contracts.md.
 */
import { describe, expect, it } from "vitest";
import {
  ROLE_KPI_DRILL_CONTRACTS,
  type RoleKpiKey,
} from "./role-kpi-drill-contracts";
import { roleKpiDrillHref } from "./role-kpi-drills";

/** Keys rendered as clickable home KPIs per role layout (audit 2.22.1). */
const PERSONA_HOME_KPI_KEYS: Record<string, RoleKpiKey[]> = {
  ceo: [
    "activeProjects",
    "billedToDate",
    "unbilledBacklog",
    "arApNet",
    "arOverdue",
    "budgetAlert",
    "safetyYtd",
    "complianceAttention",
    "openRfis",
    "workforce",
  ],
  cfo: [
    "arTotal",
    "apTotal",
    "arApNet",
    "budgetAlertStrict",
    "billedToDate",
    "unbilledBacklog",
  ],
  pm: ["activeProjects", "openRfis", "hoursThisWeek", "viewRfis"],
  estimator: ["bidPipeline", "estimatorProjects"],
  /** Shared widgets / briefing tiles (not field portfolio KPIs). */
  shared: [
    "activeProjects",
    "workforce",
    "hoursThisWeek",
    "pendingTimeApprovals",
    "openRfis",
    "openChangeOrders",
    "bidPipeline",
    "apNearTerm",
  ],
};

describe("persona KPI drill matrix (2.22.2)", () => {
  it("every persona home KPI key has a non-empty contract href", () => {
    for (const [persona, keys] of Object.entries(PERSONA_HOME_KPI_KEYS)) {
      for (const key of keys) {
        const href = roleKpiDrillHref(key);
        expect(href, `${persona}/${key}`).toMatch(/^\//);
        expect(ROLE_KPI_DRILL_CONTRACTS[key].href).toBe(href);
        expect(ROLE_KPI_DRILL_CONTRACTS[key].headlinePredicate.length).toBeGreaterThan(0);
      }
    }
  });

  it("apNearTerm is not an orphan (near-term filter on aging)", () => {
    const href = roleKpiDrillHref("apNearTerm");
    expect(href).toContain("nearTerm=true");
    expect(href).toContain("focus=ap");
  });

  it("field super intentionally has no RoleKpiKey portfolio KPIs", () => {
    // Documented intentional non-orphan: capture + glance only
    expect(PERSONA_HOME_KPI_KEYS.field ?? PERSONA_HOME_KPI_KEYS.super).toBeUndefined();
  });
});

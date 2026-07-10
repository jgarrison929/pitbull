import { describe, it, expect } from "vitest";
import {
  agingLineHasOverdue31Plus,
  parseAgingDrillParams,
  parseProjectsDrillParams,
  parseTimeTrackingDrillParams,
  roleKpiDrillHref,
  thisWeekDateRangeUtc,
} from "./role-kpi-drills";

describe("roleKpiDrillHref", () => {
  it("maps unbilled backlog to projects with unbilled filter (not bare /projects)", () => {
    const href = roleKpiDrillHref("unbilledBacklog");
    expect(href).toContain("/projects");
    expect(href).toContain("unbilled=true");
    expect(href).not.toBe("/projects");
  });

  it("maps billed-to-date to progress billing applications", () => {
    expect(roleKpiDrillHref("billedToDate")).toBe(
      "/billing/applications?scope=progress"
    );
  });

  it("maps open RFIs and COs to status=open", () => {
    expect(roleKpiDrillHref("openRfis")).toBe("/rfis?status=open");
    expect(roleKpiDrillHref("openChangeOrders")).toBe(
      "/change-orders?status=open"
    );
  });

  it("maps bid pipeline to open pipeline filter", () => {
    expect(roleKpiDrillHref("bidPipeline")).toContain("pipeline=open");
  });

  it("maps safety YTD to safety report, not mobile daily entry", () => {
    const href = roleKpiDrillHref("safetyYtd");
    expect(href).toContain("/reports/safety");
    expect(href).not.toContain("daily-reports/mobile");
  });

  it("maps budget alerts with threshold", () => {
    expect(roleKpiDrillHref("budgetAlert")).toContain("budgetAlert=true");
    expect(roleKpiDrillHref("budgetAlertStrict")).toContain(
      "budgetAlertPercent=90"
    );
  });

  it("maps view RFIs action to RFIs not projects", () => {
    expect(roleKpiDrillHref("viewRfis")).toBe("/rfis?status=open");
    expect(roleKpiDrillHref("viewRfis")).not.toContain("/projects");
  });
});

describe("parseProjectsDrillParams", () => {
  it("parses unbilled and budget alert flags from URLSearchParams", () => {
    const p = parseProjectsDrillParams(
      new URLSearchParams(
        "unbilled=true&status=active&budgetAlert=true&budgetAlertPercent=90"
      )
    );
    expect(p.unbilled).toBe(true);
    expect(p.budgetAlert).toBe(true);
    expect(p.budgetAlertPercent).toBe(90);
    expect(p.status).toBe("active");
  });

  it("defaults budget threshold to 75", () => {
    const p = parseProjectsDrillParams(new URLSearchParams("budgetAlert=true"));
    expect(p.budgetAlertPercent).toBe(75);
  });
});

describe("parseAgingDrillParams", () => {
  it("parses focus=ar and overdue=true from AR overdue drill URL", () => {
    const href = roleKpiDrillHref("arOverdue");
    const qs = href.split("?")[1] ?? "";
    const p = parseAgingDrillParams(new URLSearchParams(qs));
    expect(p.focus).toBe("ar");
    expect(p.overdueOnly).toBe(true);
  });

  it("parses focus=ap from AP KPI drill", () => {
    const qs = roleKpiDrillHref("apTotal").split("?")[1] ?? "";
    const p = parseAgingDrillParams(new URLSearchParams(qs));
    expect(p.focus).toBe("ap");
    expect(p.overdueOnly).toBe(false);
  });

  it("defaults to both focus when no params", () => {
    const p = parseAgingDrillParams(new URLSearchParams(""));
    expect(p.focus).toBe("both");
    expect(p.overdueOnly).toBe(false);
  });
});

describe("agingLineHasOverdue31Plus", () => {
  it("is true when any 31+ bucket has balance", () => {
    expect(
      agingLineHasOverdue31Plus({
        days31To60: 100,
        days61To90: 0,
        days90Plus: 0,
      })
    ).toBe(true);
    expect(
      agingLineHasOverdue31Plus({
        days31To60: 0,
        days61To90: 0,
        days90Plus: 0,
      })
    ).toBe(false);
  });
});

describe("parseTimeTrackingDrillParams", () => {
  it("hoursThisWeek drill stays on entries list and sets this-week range", () => {
    const href = roleKpiDrillHref("hoursThisWeek");
    expect(href).toContain("view=entries");
    expect(href).toContain("period=thisWeek");
    const qs = href.split("?")[1] ?? "";
    const p = parseTimeTrackingDrillParams(new URLSearchParams(qs));
    expect(p.viewEntries).toBe(true);
    expect(p.periodThisWeek).toBe(true);
    expect(p.startDate).toBeTruthy();
    expect(p.endDate).toBeTruthy();
    const range = thisWeekDateRangeUtc();
    expect(p.startDate).toBe(range.startDate);
    expect(p.endDate).toBe(range.endDate);
  });

  it("without view or period does not force entries (crew redirect)", () => {
    const p = parseTimeTrackingDrillParams(new URLSearchParams(""));
    expect(p.viewEntries).toBe(false);
  });
});

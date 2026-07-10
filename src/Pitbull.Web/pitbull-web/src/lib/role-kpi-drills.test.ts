import { describe, it, expect } from "vitest";
import { parseProjectsDrillParams, roleKpiDrillHref } from "./role-kpi-drills";

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

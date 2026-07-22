import { describe, expect, it } from "vitest";
import {
  MONEY_INSUFFICIENT_LABEL,
  SOV_PHONE_GLANCE_NOTE,
  SUBCONTRACT_LIST_EMPTY_DESCRIPTION,
  formatMoneyOrInsufficient,
  mapSubcontractMobileRow,
  parseMoneyField,
  subcontractMobileListUrl,
  subcontractSovHref,
  summarizeSubcontractListMoney,
} from "./subcontract-mobile-list";

describe("subcontract-mobile-list (band 3.6 / 3.5.6–3.5.7)", () => {
  it("builds mobile list URL with view=mobile", () => {
    expect(subcontractMobileListUrl("p1")).toContain("view=mobile");
    expect(subcontractMobileListUrl("p1")).toContain("/api/subcontracts");
    expect(subcontractMobileListUrl("p1")).toContain("projectId=p1");
  });

  it("empty copy rejects commercial health", () => {
    expect(SUBCONTRACT_LIST_EMPTY_DESCRIPTION.toLowerCase()).toMatch(/not a commercial health/);
  });

  it("SOV phone note is read-only", () => {
    expect(SOV_PHONE_GLANCE_NOTE.toLowerCase()).toMatch(/read-only|desktop/);
    expect(subcontractSovHref("abc")).toBe("/contracts/abc/sov");
  });

  it("parseMoneyField never invents 0 for missing", () => {
    expect(parseMoneyField(null)).toBeNull();
    expect(parseMoneyField(undefined)).toBeNull();
    expect(parseMoneyField(0)).toBe(0); // real zero from server is fine
    expect(parseMoneyField(1200)).toBe(1200);
  });

  it("mapSubcontractMobileRow maps paidToDate from server without invent", () => {
    const withPaid = mapSubcontractMobileRow({
      id: "1",
      number: "SC-1",
      title: "ABC",
      status: "InProgress",
      projectId: "p",
      amount: 100_000,
      paidToDate: 25_000,
      billedToDate: 30_000,
      retainageHeld: 2_500,
    });
    expect(withPaid.paidToDate).toBe(25_000);
    expect(withPaid.amount).toBe(100_000);

    const missingPaid = mapSubcontractMobileRow({
      id: "2",
      number: "SC-2",
      title: "XYZ",
      status: "Draft",
      projectId: "p",
      amount: 50_000,
      // paidToDate intentionally omitted
    });
    expect(missingPaid.paidToDate).toBeNull();
    expect(missingPaid.billedToDate).toBeNull();
  });

  it("summarizeSubcontractListMoney: missing paid → insufficient, not $0 invent", () => {
    const summary = summarizeSubcontractListMoney([
      mapSubcontractMobileRow({
        id: "1",
        number: "SC-1",
        title: "A",
        status: "InProgress",
        projectId: "p",
        amount: 100_000,
        // no paidToDate
      }),
    ]);
    expect(summary.totalCommitted).toBe(100_000);
    expect(summary.totalPaidToDate).toBeNull();
    expect(summary.totalRemaining).toBeNull();
    expect(summary.moneyInsufficient).toBe(true);
    // Critical: remaining must NOT equal full committed when paid is missing
    expect(summary.totalRemaining).not.toBe(100_000);
  });

  it("summarizeSubcontractListMoney: paid present → correct remaining", () => {
    const summary = summarizeSubcontractListMoney([
      mapSubcontractMobileRow({
        id: "1",
        number: "SC-1",
        title: "A",
        status: "InProgress",
        projectId: "p",
        amount: 100_000,
        paidToDate: 40_000,
        retainageHeld: 4_000,
      }),
    ]);
    expect(summary.totalCommitted).toBe(100_000);
    expect(summary.totalPaidToDate).toBe(40_000);
    expect(summary.totalRemaining).toBe(60_000);
    expect(summary.totalRetentionHeld).toBe(4_000);
    expect(summary.moneyInsufficient).toBe(false);
  });

  it("formatMoneyOrInsufficient labels null as insufficient", () => {
    expect(formatMoneyOrInsufficient(null, (n) => `$${n}`)).toBe(MONEY_INSUFFICIENT_LABEL);
    expect(formatMoneyOrInsufficient(100, (n) => `$${n}`)).toBe("$100");
  });
});

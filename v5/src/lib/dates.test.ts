import { afterEach, describe, expect, it } from "vitest";
import { utcDay } from "./dates";

describe("utcDay", () => {
  const prev = process.env.TZ;

  afterEach(() => {
    if (prev === undefined) delete process.env.TZ;
    else process.env.TZ = prev;
  });

  it("formats a UTC midnight instant as Tue, Sep 15 under America/Los_Angeles", () => {
    process.env.TZ = "America/Los_Angeles";
    // 2026-09-15T00:00:00.000Z is 2026-09-14 17:00 PDT — local would show Mon Sep 14.
    expect(utcDay("2026-09-15T00:00:00.000Z")).toBe("Tue, Sep 15");
    expect(utcDay("2026-09-15")).toBe("Tue, Sep 15");
  });

  it("matches date-only and noon-UTC ISO for the same UTC day", () => {
    process.env.TZ = "America/Los_Angeles";
    expect(utcDay("2026-10-20")).toBe("Tue, Oct 20");
    expect(utcDay("2026-10-20T12:00:00.000Z")).toBe("Tue, Oct 20");
  });
});


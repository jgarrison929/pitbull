import { afterEach, describe, expect, it } from "vitest";
import { seedNow } from "./sandbox";

describe("seedNow", () => {
  const prev = process.env.V5_SEED_NOW;

  afterEach(() => {
    if (prev === undefined) delete process.env.V5_SEED_NOW;
    else process.env.V5_SEED_NOW = prev;
  });

  it("returns the fallback when V5_SEED_NOW is unset", () => {
    delete process.env.V5_SEED_NOW;
    const fallback = new Date("2026-01-15T12:00:00.000Z");
    expect(seedNow(fallback).toISOString()).toBe(fallback.toISOString());
  });

  it("parses V5_SEED_NOW for a frozen seed calendar", () => {
    process.env.V5_SEED_NOW = "2026-10-20T17:00:00.000Z";
    expect(seedNow().toISOString()).toBe("2026-10-20T17:00:00.000Z");
  });

  it("rejects an invalid V5_SEED_NOW", () => {
    process.env.V5_SEED_NOW = "not-a-date";
    expect(() => seedNow()).toThrow(/V5_SEED_NOW is not a valid date/);
  });
});

import { describe, expect, it } from "vitest";
import { SCHEDULE_EMPTY_GUIDANCE } from "./gantt";

describe("5.1.0-c schedule empty copy", () => {
  it("does not use the banned 'No activities yet' empty state", () => {
    expect(SCHEDULE_EMPTY_GUIDANCE).not.toMatch(/^No activities yet\b/i);
    expect(SCHEDULE_EMPTY_GUIDANCE).toMatch(/Add an activity to build the schedule/);
  });

  it("does not match the verify-v5 EMPTY_STATE pattern", () => {
    // Mirrors .cursor/skills/verify-v5/checks.mjs EMPTY_STATE.
    const EMPTY_STATE =
      /^(no\s.{0,40}?\b(yet|found|to show|available)\b|nothing\s(here|yet|to show)\b|no data\b|0 jobs\b)/i;
    expect(EMPTY_STATE.test(SCHEDULE_EMPTY_GUIDANCE)).toBe(false);
  });
});

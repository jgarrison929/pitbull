import { describe, it, expect } from "vitest";
import {
  SCHEDULE_EMPTY_CRITICAL_ONLY,
  SCHEDULE_EMPTY_NO_ACTIVITIES,
} from "./schedule-empty-copy";

describe("schedule empty copy (2.15.1)", () => {
  it("is honest and does not invent progress", () => {
    expect(SCHEDULE_EMPTY_NO_ACTIVITIES).toMatch(/do not invent/i);
    expect(SCHEDULE_EMPTY_CRITICAL_ONLY).toMatch(/empty means none/i);
  });
});

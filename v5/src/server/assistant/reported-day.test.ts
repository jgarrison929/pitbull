import { describe, expect, it } from "vitest";
import { reportedDayInSummary } from "@/lib/reported-day";

describe("reportedDayInSummary", () => {
  it("reads the day from a report summary", () => {
    expect(
      reportedDayInSummary(
        "Reported Culvert Crew A's work on I-5 Culverts for Tue, Oct 20: 110 man-hours pending.",
      ),
    ).toBe("Tue, Oct 20");
  });

  it("ignores the replay line and the return line", () => {
    expect(
      reportedDayInSummary(
        "Culvert Crew A's report for Tue, Oct 20 on I-5 Culverts was already saved.",
      ),
    ).toBeNull();
    expect(
      reportedDayInSummary(
        'Returned Culvert Crew A\'s report for Tue, Oct 20 on I-5 Culverts: "mark-out".',
      ),
    ).toBeNull();
  });
});

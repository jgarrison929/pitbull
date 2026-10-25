import { describe, expect, it } from "vitest";
import {
  buildDailyReportApiData,
  buildOfflineDailyReportPayload,
} from "./daily-report-offline";

describe("buildOfflineDailyReportPayload", () => {
  it("includes projectId and title used on sync", () => {
    const payload = buildOfflineDailyReportPayload({
      projectId: "proj-111",
      reportDate: "2026-07-11",
      reportType: "Foreman",
      workNarrative: "Poured foundation",
      asDraft: false,
    });
    expect(payload.projectId).toBe("proj-111");
    expect(payload.title).toBe("Daily Report - 2026-07-11");
    expect(payload.workNarrative).toContain("Poured foundation");
    expect(payload.status).toBe("Submitted");
  });

  it("maps pour chips and crew into offline payload for sync", () => {
    const payload = buildOfflineDailyReportPayload({
      projectId: "proj-pour",
      reportDate: "2026-07-11",
      reportType: "Foreman",
      fieldActivities: ["pour", "finish"],
      truckConditions: ["too_wet"],
      truckNotes: "Load 2 held",
      crewCounts: [{ trade: "Place", count: 6 }],
      photos: [
        {
          id: "p1",
          name: "slab.jpg",
          type: "image/jpeg",
          size: 100,
          dataUrl: "data:image/jpeg;base64,xx",
        },
      ],
    });
    expect(payload.fieldActivities).toEqual(["pour", "finish"]);
    expect(payload.truckConditions).toEqual(["too_wet"]);
    expect(payload.crewEntries).toEqual([{ trade: "Place", count: 6 }]);
    expect(payload.photos?.[0]?.dataUrl).toContain("data:image");
    expect(payload.workNarrative).toMatch(/Pour|Too wet|Place×6/);
  });

  it("throws without projectId", () => {
    expect(() =>
      buildOfflineDailyReportPayload({
        projectId: "",
        reportDate: "2026-07-11",
        reportType: "Foreman",
      })
    ).toThrow(/projectId/);
  });
});

describe("buildDailyReportApiData", () => {
  it("sends field chips the API data bag expects", () => {
    const data = buildDailyReportApiData({
      projectId: "p1",
      reportDate: "2026-07-11",
      reportType: "Foreman",
      fieldActivities: ["form"],
      truckConditions: ["ok"],
      crewCounts: [{ trade: "Form", count: 3 }],
    });
    expect(data.FieldActivities).toEqual(["form"]);
    expect(data.TruckConditions).toEqual(["ok"]);
    expect(data.CrewEntries).toEqual([{ trade: "Form", count: 3 }]);
  });
});

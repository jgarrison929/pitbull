import { describe, expect, it } from "vitest";
import { buildOfflineDailyReportSyncBody } from "./daily-report-offline";
import { MOBILE_REPORT_STEPS, nextReportStep } from "./pour-field";
import {
  buildQuickLogFormSnapshot,
  buildQuickLogHref,
  buildQuickLogOfflinePayload,
  initialFieldReportStep,
  isQuickLogMode,
  loadFieldLastDefaults,
  parseFieldLastDefaults,
  saveFieldLastDefaults,
} from "./field-quick-log";

describe("field last defaults", () => {
  it("round-trips project and plan sheet in storage", () => {
    const mem = new Map<string, string>();
    const storage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => {
        mem.set(k, v);
      },
    };
    saveFieldLastDefaults(
      { projectId: "proj-1", planSheetId: "sheet-9" },
      storage
    );
    const loaded = loadFieldLastDefaults(storage);
    expect(loaded.projectId).toBe("proj-1");
    expect(loaded.planSheetId).toBe("sheet-9");
    expect(parseFieldLastDefaults("not-json")).toEqual({});
  });
});

describe("quick log mode + href", () => {
  it("detects mode=quick", () => {
    expect(isQuickLogMode({ get: (n) => (n === "mode" ? "quick" : null) })).toBe(
      true
    );
    expect(isQuickLogMode({ get: () => null })).toBe(false);
    expect(buildQuickLogHref("abc")).toContain("mode=quick");
    expect(buildQuickLogHref("abc")).toContain("projectId=abc");
  });

  it("mode=quick lands on valid Field step with Photos/Review reachable", () => {
    const params = { get: (n: string) => (n === "mode" ? "quick" : null) };
    const quick = isQuickLogMode(params);
    expect(quick).toBe(true);

    const step = initialFieldReportStep(quick);
    // Must be a real wizard step — not "Work" or other invents
    expect(MOBILE_REPORT_STEPS.includes(step)).toBe(true);
    expect(step).toBe("Field");
    expect(step).not.toBe("Project");

    // Field → Photos → Review path is open (stepIndex never -1)
    const photos = nextReportStep(step);
    expect(photos).toBe("Photos");
    const review = nextReportStep(photos!);
    expect(review).toBe("Review");
    expect(nextReportStep("Review")).toBeNull();

    // Full wizard still starts on Project
    expect(initialFieldReportStep(false)).toBe("Project");
  });
});

describe("buildQuickLogOfflinePayload (real daily-report path)", () => {
  it("builds offline payload with project + narrative + PlanSheetId on sync body", () => {
    const payload = buildQuickLogOfflinePayload({
      projectId: "22222222-2222-2222-2222-222222222222",
      workNarrative: "Poured wall line 3",
      planSheetId: "plan-sheet-7",
      photos: [
        {
          id: "ph1",
          name: "wall.jpg",
          type: "image/jpeg",
          size: 100,
          dataUrl: "data:image/jpeg;base64,aaa",
        },
      ],
    });

    expect(payload.projectId).toBe("22222222-2222-2222-2222-222222222222");
    expect(payload.workNarrative).toMatch(/Poured wall/);
    expect(payload.planSheetId).toBe("plan-sheet-7");
    expect(payload.photos?.length).toBe(1);

    const sync = buildOfflineDailyReportSyncBody(payload);
    expect(sync.data.PlanSheetId).toBe("plan-sheet-7");
    expect(sync.data.WorkNarrative).toMatch(/Poured wall/);
    expect(sync.submitAfterCreate).toBe(true);
  });

  it("rejects empty quick log", () => {
    expect(() =>
      buildQuickLogFormSnapshot({ projectId: "p", workNarrative: "" })
    ).toThrow(/narrative or photos/i);
  });
});

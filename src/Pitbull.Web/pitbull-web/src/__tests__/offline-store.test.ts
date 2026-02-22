import { describe, it, expect, beforeEach, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import {
  enqueueForSync,
  enqueueDailyReportForSync,
  getPendingSyncItems,
  removeSyncItem,
  updateSyncItem,
  getSyncQueueCount,
  saveDraft,
  getDrafts,
  deleteDraft,
  cacheRefData,
  getCachedRefData,
  clearAllOfflineData,
  captureAuthContext,
  type OfflineTimeEntry,
  type OfflineDailyReport,
} from "../lib/offline-store";

// Give each test a completely fresh IndexedDB + localStorage
beforeEach(() => {
  vi.stubGlobal("indexedDB", new IDBFactory());

  const store: Record<string, string> = {};
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => { store[key] = val; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => Object.keys(store).forEach((k) => delete store[k]),
  });
});

function makeTimeEntry(overrides?: Partial<OfflineTimeEntry>): OfflineTimeEntry {
  return {
    id: `entry-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    date: "2026-02-22",
    employeeId: "emp-1",
    projectId: "proj-1",
    costCodeId: "cc-1",
    regularHours: 8,
    overtimeHours: 0,
    doubletimeHours: 0,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeDailyReport(overrides?: Partial<OfflineDailyReport>): OfflineDailyReport {
  return {
    id: `report-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    projectId: "proj-1",
    title: "Daily Report 2026-02-22",
    reportDate: "2026-02-22",
    reportType: "Standard",
    status: "Draft",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// --- Sync Queue ---

describe("enqueueForSync", () => {
  it("adds a time entry to the sync queue with pending status", async () => {
    const entry = makeTimeEntry();
    await enqueueForSync(entry);

    const items = await getPendingSyncItems();
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe("time-entry");
    expect(items[0].status).toBe("pending");
    expect(items[0].retryCount).toBe(0);
    expect(items[0].entry).toEqual(entry);
  });

  it("generates a UUID idempotency key", async () => {
    await enqueueForSync(makeTimeEntry());
    const items = await getPendingSyncItems();
    expect(items[0].idempotencyKey).toBeTruthy();
    expect(items[0].idempotencyKey).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });

  it("captures auth context from localStorage", async () => {
    localStorage.setItem("pitbull_token", "test-jwt-token");
    localStorage.setItem("pitbull_active_company_id", "company-123");

    await enqueueForSync(makeTimeEntry());
    const items = await getPendingSyncItems();
    expect(items[0].auth.token).toBe("test-jwt-token");
    expect(items[0].auth.companyId).toBe("company-123");
  });

  it("handles missing auth gracefully", async () => {
    await enqueueForSync(makeTimeEntry());
    const items = await getPendingSyncItems();
    expect(items[0].auth.token).toBe("");
    expect(items[0].auth.companyId).toBe("");
  });
});

describe("enqueueDailyReportForSync", () => {
  it("adds a daily report with crew/equipment/visitors", async () => {
    const report = makeDailyReport({
      weatherSummary: "Sunny",
      temperatureHigh: "85",
      temperatureLow: "65",
      workNarrative: "Poured foundation Section B",
      crewEntries: [{ trade: "Concrete", count: 6 }],
      equipment: [{ name: "Pump Truck", status: "Active" }],
      visitors: [{ name: "John Doe", company: "Acme", purpose: "Inspection" }],
    });
    await enqueueDailyReportForSync(report);

    const items = await getPendingSyncItems();
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe("daily-report");
    expect(items[0].status).toBe("pending");

    const stored = items[0].entry as OfflineDailyReport;
    expect(stored.crewEntries).toHaveLength(1);
    expect(stored.equipment).toHaveLength(1);
    expect(stored.visitors).toHaveLength(1);
  });
});

describe("getPendingSyncItems", () => {
  it("returns only pending and failed items", async () => {
    await enqueueForSync(makeTimeEntry({ id: "e1" }));
    await enqueueForSync(makeTimeEntry({ id: "e2" }));
    await enqueueForSync(makeTimeEntry({ id: "e3" }));

    await updateSyncItem("e2", { status: "syncing" });

    const items = await getPendingSyncItems();
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.id).sort()).toEqual(["e1", "e3"]);
  });

  it("includes failed items for retry", async () => {
    await enqueueForSync(makeTimeEntry({ id: "e1" }));
    await updateSyncItem("e1", { status: "failed", retryCount: 3, error: "Network error" });

    const items = await getPendingSyncItems();
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe("failed");
    expect(items[0].retryCount).toBe(3);
  });
});

describe("removeSyncItem", () => {
  it("removes an item from the queue", async () => {
    await enqueueForSync(makeTimeEntry({ id: "remove-me" }));
    expect(await getSyncQueueCount()).toBe(1);

    await removeSyncItem("remove-me");
    expect(await getSyncQueueCount()).toBe(0);
  });
});

describe("updateSyncItem", () => {
  it("updates status and error fields", async () => {
    await enqueueForSync(makeTimeEntry({ id: "u1" }));
    await updateSyncItem("u1", {
      status: "failed",
      retryCount: 2,
      error: "Server error 500",
      lastAttempt: "2026-02-22T12:00:00Z",
    });

    const items = await getPendingSyncItems();
    expect(items[0].status).toBe("failed");
    expect(items[0].retryCount).toBe(2);
    expect(items[0].error).toBe("Server error 500");
    expect(items[0].lastAttempt).toBe("2026-02-22T12:00:00Z");
  });

  it("is a no-op for non-existent items", async () => {
    await updateSyncItem("nonexistent", { status: "failed" });
    expect(await getSyncQueueCount()).toBe(0);
  });
});

describe("getSyncQueueCount", () => {
  it("counts only pending and failed items", async () => {
    await enqueueForSync(makeTimeEntry({ id: "c1" }));
    await enqueueForSync(makeTimeEntry({ id: "c2" }));
    await enqueueForSync(makeTimeEntry({ id: "c3" }));
    await updateSyncItem("c2", { status: "syncing" });

    expect(await getSyncQueueCount()).toBe(2);
  });
});

// --- Drafts ---

describe("drafts", () => {
  it("saves and retrieves draft entries", async () => {
    const entry = makeTimeEntry({ id: "draft-1", description: "Draft entry" });
    await saveDraft(entry);

    const drafts = await getDrafts();
    expect(drafts).toHaveLength(1);
    expect(drafts[0].id).toBe("draft-1");
  });

  it("deletes a draft by id", async () => {
    await saveDraft(makeTimeEntry({ id: "d1" }));
    await saveDraft(makeTimeEntry({ id: "d2" }));

    await deleteDraft("d1");
    const drafts = await getDrafts();
    expect(drafts).toHaveLength(1);
    expect(drafts[0].id).toBe("d2");
  });
});

// --- Reference Data Cache ---

describe("reference data cache", () => {
  it("caches and retrieves reference data", async () => {
    const projects = [
      { id: "p1", name: "Project Alpha" },
      { id: "p2", name: "Project Beta" },
    ];
    await cacheRefData("projects", projects);

    const cached = await getCachedRefData<{ id: string; name: string }>("projects");
    expect(cached).toHaveLength(2);
    expect(cached![0].name).toBe("Project Alpha");
  });

  it("returns null for uncached keys", async () => {
    const result = await getCachedRefData("employees");
    expect(result).toBeNull();
  });

  it("expires data older than 24 hours", async () => {
    await cacheRefData("costCodes", [{ id: "cc1" }]);

    const realDateNow = Date.now;
    Date.now = () => realDateNow() + 25 * 60 * 60 * 1000;

    const result = await getCachedRefData("costCodes");
    expect(result).toBeNull();

    Date.now = realDateNow;
  });
});

// --- captureAuthContext ---

describe("captureAuthContext", () => {
  it("reads token and companyId from localStorage", () => {
    localStorage.setItem("pitbull_token", "my-jwt");
    localStorage.setItem("pitbull_active_company_id", "comp-42");

    const ctx = captureAuthContext();
    expect(ctx.token).toBe("my-jwt");
    expect(ctx.companyId).toBe("comp-42");
  });

  it("returns empty strings when not set", () => {
    const ctx = captureAuthContext();
    expect(ctx.token).toBe("");
    expect(ctx.companyId).toBe("");
  });
});

// --- clearAllOfflineData ---

describe("clearAllOfflineData", () => {
  it("clears drafts, sync queue, and ref data", async () => {
    await saveDraft(makeTimeEntry({ id: "d1" }));
    await enqueueForSync(makeTimeEntry({ id: "s1" }));
    await cacheRefData("projects", [{ id: "p1" }]);

    await clearAllOfflineData();

    expect(await getDrafts()).toHaveLength(0);
    expect(await getSyncQueueCount()).toBe(0);
    expect(await getCachedRefData("projects")).toBeNull();
  });
});

// --- Mixed queue ---

describe("mixed sync queue", () => {
  it("handles both time entries and daily reports", async () => {
    await enqueueForSync(makeTimeEntry({ id: "te-1" }));
    await enqueueDailyReportForSync(makeDailyReport({ id: "dr-1" }));
    await enqueueForSync(makeTimeEntry({ id: "te-2" }));

    const items = await getPendingSyncItems();
    expect(items).toHaveLength(3);

    const types = items.map((i) => i.type).sort();
    expect(types).toEqual(["daily-report", "time-entry", "time-entry"]);
  });

  it("each item gets a unique idempotency key", async () => {
    await enqueueForSync(makeTimeEntry({ id: "a" }));
    await enqueueForSync(makeTimeEntry({ id: "b" }));
    await enqueueDailyReportForSync(makeDailyReport({ id: "c" }));

    const items = await getPendingSyncItems();
    const keys = items.map((i) => i.idempotencyKey);
    expect(new Set(keys).size).toBe(3);
  });
});

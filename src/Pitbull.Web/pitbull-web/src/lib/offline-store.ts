/**
 * IndexedDB offline store for time entries and cached reference data.
 * Supports draft entries, sync queue, and cached projects/cost codes/employees.
 */

const DB_NAME = "pitbull-offline";
const DB_VERSION = 1;

// Store names
const DRAFTS_STORE = "drafts";
const SYNC_QUEUE_STORE = "syncQueue";
const REF_DATA_STORE = "refData";

export interface OfflineTimeEntry {
  id: string;
  date: string;
  employeeId: string;
  projectId: string;
  costCodeId: string;
  regularHours: number;
  overtimeHours: number;
  doubletimeHours: number;
  description?: string;
  phaseId?: string;
  equipmentId?: string;
  equipmentHours?: number;
  latitude?: number;
  longitude?: number;
  locationAccuracy?: number;
  createdAt: string;
}

export interface OfflineDailyReportPhoto {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl?: string;
  latitude?: number;
  longitude?: number;
  caption?: string;
  skippedForSize?: boolean;
}

export interface OfflineDailyReport {
  id: string;
  projectId: string;
  title: string;
  reportDate: string;
  reportType: string;
  weatherSummary?: string;
  temperatureLow?: string;
  temperatureHigh?: string;
  precipitation?: string;
  wind?: string;
  workNarrative?: string;
  delaysNarrative?: string;
  safetyNarrative?: string;
  /** Structured field chips: pour, form, finish, … */
  fieldActivities?: string[];
  truckConditions?: string[];
  truckNotes?: string;
  crewEntries?: { trade: string; count: number }[];
  equipment?: { name: string; status: string }[];
  visitors?: { name: string; company: string; purpose: string }[];
  /** Embedded offline photos (small data URLs) for upload on sync */
  photos?: OfflineDailyReportPhoto[];
  /** Optional zone / spatial node (twin fuel) — omit when skipped */
  spatialNodeId?: string;
  status: string;
  createdAt: string;
}

/** Auth + company context captured at enqueue time for SW replay. */
export interface SyncAuthContext {
  token: string;
  companyId: string;
}

export interface SyncQueueItem {
  id: string;
  idempotencyKey: string;
  type: "time-entry" | "daily-report";
  entry: OfflineTimeEntry | OfflineDailyReport;
  auth: SyncAuthContext;
  status: "pending" | "syncing" | "failed";
  retryCount: number;
  lastAttempt?: string;
  error?: string;
}

export type RefDataKey = "projects" | "costCodes" | "employees";

interface RefDataRecord {
  key: RefDataKey;
  data: unknown[];
  cachedAt: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DRAFTS_STORE)) {
        db.createObjectStore(DRAFTS_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(SYNC_QUEUE_STORE)) {
        const syncStore = db.createObjectStore(SYNC_QUEUE_STORE, { keyPath: "id" });
        syncStore.createIndex("status", "status", { unique: false });
      }
      if (!db.objectStoreNames.contains(REF_DATA_STORE)) {
        db.createObjectStore(REF_DATA_STORE, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function tx<T>(
  storeName: string,
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(storeName, mode);
        const store = transaction.objectStore(storeName);
        const request = callback(store);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      })
  );
}

function txGetAll<T>(storeName: string): Promise<T[]> {
  return openDb().then(
    (db) =>
      new Promise<T[]>((resolve, reject) => {
        const transaction = db.transaction(storeName, "readonly");
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result as T[]);
        request.onerror = () => reject(request.error);
      })
  );
}

// --- Auth context helpers ---

/** Capture current auth token + company ID from localStorage for SW replay. */
export function captureAuthContext(): SyncAuthContext {
  try {
    if (typeof window === "undefined" || typeof localStorage === "undefined") {
      return { token: "", companyId: "" };
    }
    return {
      token: localStorage.getItem("pitbull_token") ?? "",
      companyId: localStorage.getItem("pitbull_active_company_id") ?? "",
    };
  } catch {
    return { token: "", companyId: "" };
  }
}

// --- Draft entries ---

export async function saveDraft(entry: OfflineTimeEntry): Promise<void> {
  await tx(DRAFTS_STORE, "readwrite", (store) => store.put(entry));
}

export async function getDrafts(): Promise<OfflineTimeEntry[]> {
  return txGetAll<OfflineTimeEntry>(DRAFTS_STORE);
}

export async function deleteDraft(id: string): Promise<void> {
  await tx(DRAFTS_STORE, "readwrite", (store) => store.delete(id));
}

// --- Sync queue ---

export async function enqueueForSync(entry: OfflineTimeEntry): Promise<void> {
  const item: SyncQueueItem = {
    id: entry.id,
    idempotencyKey: crypto.randomUUID(),
    type: "time-entry",
    entry,
    auth: captureAuthContext(),
    status: "pending",
    retryCount: 0,
  };
  await tx(SYNC_QUEUE_STORE, "readwrite", (store) => store.put(item));
}

export async function enqueueDailyReportForSync(report: OfflineDailyReport): Promise<void> {
  const item: SyncQueueItem = {
    id: report.id,
    idempotencyKey: crypto.randomUUID(),
    type: "daily-report",
    entry: report,
    auth: captureAuthContext(),
    status: "pending",
    retryCount: 0,
  };
  await tx(SYNC_QUEUE_STORE, "readwrite", (store) => store.put(item));
}

export async function getPendingSyncItems(): Promise<SyncQueueItem[]> {
  const all = await txGetAll<SyncQueueItem>(SYNC_QUEUE_STORE);
  return all.filter((item) => item.status === "pending" || item.status === "failed");
}

export async function getSyncQueueCount(): Promise<number> {
  const items = await getPendingSyncItems();
  return items.length;
}

export async function updateSyncItem(
  id: string,
  updates: Partial<Pick<SyncQueueItem, "status" | "retryCount" | "lastAttempt" | "error">>
): Promise<void> {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(SYNC_QUEUE_STORE, "readwrite");
    const store = transaction.objectStore(SYNC_QUEUE_STORE);
    const getRequest = store.get(id);
    getRequest.onsuccess = () => {
      const item = getRequest.result as SyncQueueItem | undefined;
      if (!item) {
        resolve();
        return;
      }
      const updated = { ...item, ...updates };
      const putRequest = store.put(updated);
      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(putRequest.error);
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
}

export async function removeSyncItem(id: string): Promise<void> {
  await tx(SYNC_QUEUE_STORE, "readwrite", (store) => store.delete(id));
}

// --- Reference data cache ---

export async function cacheRefData(key: RefDataKey, data: unknown[]): Promise<void> {
  const record: RefDataRecord = {
    key,
    data,
    cachedAt: new Date().toISOString(),
  };
  await tx(REF_DATA_STORE, "readwrite", (store) => store.put(record));
}

export async function getCachedRefData<T>(key: RefDataKey): Promise<T[] | null> {
  const record = await tx<RefDataRecord | undefined>(
    REF_DATA_STORE,
    "readonly",
    (store) => store.get(key) as IDBRequest<RefDataRecord | undefined>
  );
  if (!record) return null;

  // Expire after 24 hours
  const age = Date.now() - new Date(record.cachedAt).getTime();
  if (age > 24 * 60 * 60 * 1000) return null;

  return record.data as T[];
}

// --- Clear all offline data ---

export async function clearAllOfflineData(): Promise<void> {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(
      [DRAFTS_STORE, SYNC_QUEUE_STORE, REF_DATA_STORE],
      "readwrite"
    );
    transaction.objectStore(DRAFTS_STORE).clear();
    transaction.objectStore(SYNC_QUEUE_STORE).clear();
    transaction.objectStore(REF_DATA_STORE).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

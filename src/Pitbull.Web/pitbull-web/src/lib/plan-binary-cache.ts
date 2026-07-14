/**
 * Selected plan PDF/image binary offline cache (3.1.x).
 * Only sheets explicitly viewed or “Save for offline” are cached —
 * never imply the whole drawing set is available offline.
 */

export const PLAN_BINARY_CACHE_DB = "pitbull-plan-binary";
export const PLAN_BINARY_CACHE_STORE = "planBlobs";
export const PLAN_BINARY_CACHE_VERSION = 1;
/** Max sheets cached per project (evict oldest). */
export const MAX_PLAN_BINARIES_PER_PROJECT = 12;
/** Soft total budget across all projects (~40MB). */
export const MAX_PLAN_BINARY_TOTAL_BYTES = 40 * 1024 * 1024;

export interface PlanBinaryMeta {
  key: string;
  projectId: string;
  fileId: string;
  fileName: string;
  contentType: string;
  size: number;
  savedAt: string;
  /** How the sheet entered the cache */
  source: "view" | "save";
}

export interface PlanBinaryRecord extends PlanBinaryMeta {
  /** base64 data URL or raw base64 of the file bytes */
  dataUrl: string;
}

export function planBinaryCacheKey(projectId: string, fileId: string): string {
  if (!projectId || !fileId) {
    throw new Error("projectId and fileId are required for plan binary cache key");
  }
  return `${projectId}::${fileId}`;
}

export function isPlanBinaryCached(
  cachedKeys: Iterable<string>,
  projectId: string,
  fileId: string
): boolean {
  const key = planBinaryCacheKey(projectId, fileId);
  if (cachedKeys instanceof Set) return cachedKeys.has(key);
  for (const k of cachedKeys) {
    if (k === key) return true;
  }
  return false;
}

/**
 * Pure eviction: keep newest entries under count + total size budgets.
 * Returns keys to delete.
 */
export function planBinaryKeysToEvict(
  entries: Array<{ key: string; projectId: string; size: number; savedAt: string }>,
  options?: {
    maxPerProject?: number;
    maxTotalBytes?: number;
  }
): string[] {
  const maxPerProject = options?.maxPerProject ?? MAX_PLAN_BINARIES_PER_PROJECT;
  const maxTotalBytes = options?.maxTotalBytes ?? MAX_PLAN_BINARY_TOTAL_BYTES;
  const sorted = [...entries].sort(
    (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
  );

  const keep = new Set<string>();
  const perProject = new Map<string, number>();
  let total = 0;
  const drop: string[] = [];

  for (const e of sorted) {
    const count = perProject.get(e.projectId) ?? 0;
    if (count >= maxPerProject || total + e.size > maxTotalBytes) {
      drop.push(e.key);
      continue;
    }
    keep.add(e.key);
    perProject.set(e.projectId, count + 1);
    total += e.size;
  }

  // Anything not kept and not already dropped
  for (const e of entries) {
    if (!keep.has(e.key) && !drop.includes(e.key)) drop.push(e.key);
  }
  return drop;
}

/** Honest label for list UI. */
export function planOfflineAvailabilityLabel(cached: boolean): string {
  return cached
    ? "Saved offline on this device"
    : "Not offline — open online or tap Save for offline";
}

// --- IndexedDB implementation (browser) ---

function openPlanDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("indexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(PLAN_BINARY_CACHE_DB, PLAN_BINARY_CACHE_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(PLAN_BINARY_CACHE_STORE)) {
        const store = db.createObjectStore(PLAN_BINARY_CACHE_STORE, {
          keyPath: "key",
        });
        store.createIndex("projectId", "projectId", { unique: false });
        store.createIndex("savedAt", "savedAt", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("plan cache open failed"));
  });
}

export async function putPlanBinary(record: PlanBinaryRecord): Promise<void> {
  const db = await openPlanDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(PLAN_BINARY_CACHE_STORE, "readwrite");
      tx.objectStore(PLAN_BINARY_CACHE_STORE).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    await evictPlanBinariesIfNeeded();
  } finally {
    db.close();
  }
}

export async function getPlanBinary(
  projectId: string,
  fileId: string
): Promise<PlanBinaryRecord | null> {
  const key = planBinaryCacheKey(projectId, fileId);
  const db = await openPlanDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(PLAN_BINARY_CACHE_STORE, "readonly");
      const req = tx.objectStore(PLAN_BINARY_CACHE_STORE).get(key);
      req.onsuccess = () => resolve((req.result as PlanBinaryRecord) ?? null);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export async function listPlanBinaryMeta(
  projectId?: string
): Promise<PlanBinaryMeta[]> {
  const db = await openPlanDb();
  try {
    const all = await new Promise<PlanBinaryRecord[]>((resolve, reject) => {
      const tx = db.transaction(PLAN_BINARY_CACHE_STORE, "readonly");
      const req = tx.objectStore(PLAN_BINARY_CACHE_STORE).getAll();
      req.onsuccess = () => resolve((req.result as PlanBinaryRecord[]) ?? []);
      req.onerror = () => reject(req.error);
    });
    return all
      .filter((r) => !projectId || r.projectId === projectId)
      .map(({ dataUrl: _d, ...meta }) => meta);
  } finally {
    db.close();
  }
}

export async function listPlanBinaryKeys(projectId?: string): Promise<Set<string>> {
  const meta = await listPlanBinaryMeta(projectId);
  return new Set(meta.map((m) => m.key));
}

async function evictPlanBinariesIfNeeded(): Promise<void> {
  const db = await openPlanDb();
  try {
    const all = await new Promise<PlanBinaryRecord[]>((resolve, reject) => {
      const tx = db.transaction(PLAN_BINARY_CACHE_STORE, "readonly");
      const req = tx.objectStore(PLAN_BINARY_CACHE_STORE).getAll();
      req.onsuccess = () => resolve((req.result as PlanBinaryRecord[]) ?? []);
      req.onerror = () => reject(req.error);
    });
    const drop = planBinaryKeysToEvict(
      all.map((r) => ({
        key: r.key,
        projectId: r.projectId,
        size: r.size,
        savedAt: r.savedAt,
      }))
    );
    if (drop.length === 0) return;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(PLAN_BINARY_CACHE_STORE, "readwrite");
      const store = tx.objectStore(PLAN_BINARY_CACHE_STORE);
      for (const key of drop) store.delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/**
 * Cache a fetched Blob (from authenticated download) for offline open.
 */
export async function cachePlanFileBlob(input: {
  projectId: string;
  fileId: string;
  fileName: string;
  contentType: string;
  blob: Blob;
  source: "view" | "save";
}): Promise<PlanBinaryMeta> {
  const dataUrl = await blobToDataUrl(input.blob);
  const record: PlanBinaryRecord = {
    key: planBinaryCacheKey(input.projectId, input.fileId),
    projectId: input.projectId,
    fileId: input.fileId,
    fileName: input.fileName,
    contentType: input.contentType || input.blob.type || "application/pdf",
    size: input.blob.size,
    savedAt: new Date().toISOString(),
    source: input.source,
    dataUrl,
  };
  await putPlanBinary(record);
  const { dataUrl: _d, ...meta } = record;
  return meta;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Could not read plan blob"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("FileReader failed"));
    reader.readAsDataURL(blob);
  });
}

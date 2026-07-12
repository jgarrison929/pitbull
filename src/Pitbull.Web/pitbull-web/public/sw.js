// Pitbull Construction Solutions — Service Worker
// Caches app shell + API responses for offline time entry

// Bump when shipping shell changes so activate() drops stale precache (also
// keyed indirectly by VersionUpdateGuard hard-reload on product version).
const CACHE_VERSION = "v2.12.4";
const STATIC_CACHE = `pitbull-static-${CACHE_VERSION}`;
const API_CACHE = `pitbull-api-${CACHE_VERSION}`;

const SYNC_TAG = "pitbull-offline-sync";
const PERIODIC_SYNC_TAG = "pitbull-periodic-sync";
const DB_NAME = "pitbull-offline";
const SYNC_QUEUE_STORE = "syncQueue";

// App shell assets to precache (field report route for offline PWA shell)
const PRECACHE_URLS = [
  "/",
  "/time-tracking/mobile",
  "/daily-reports/mobile",
  "/offline.html",
];

// API routes to cache for offline reference data
const CACHEABLE_API_PATTERNS = [
  /\/api\/projects(\?|$)/,
  /\/api\/employees(\?|$)/,
  /\/api\/cost-codes(\?|$)/,
];

// Install: precache app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== API_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: strategy depends on request type
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests (POST time entries handled by IndexedDB queue)
  if (request.method !== "GET") return;

  // API requests: network-first with stale fallback
  if (url.pathname.startsWith("/api/")) {
    const isCacheable = CACHEABLE_API_PATTERNS.some((pattern) =>
      pattern.test(url.pathname + url.search)
    );

    if (isCacheable) {
      event.respondWith(networkFirstWithCache(request));
    }
    return;
  }

  // Static assets (JS, CSS, images): cache-first
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Navigation requests: network-first with offline fallback
  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }
});

// Listen for messages from the client
self.addEventListener("message", (event) => {
  if (!event.data) return;

  if (event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (event.data.type === "REGISTER_SYNC") {
    if (self.registration.sync) {
      self.registration.sync.register(SYNC_TAG).catch(() => {
        // Background Sync not supported — client-side sync handles it
      });
    }
  }
});

// --- Background Sync ---

self.addEventListener("sync", (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(syncPendingItems());
  }
});

// Periodic Background Sync (Chrome only, graceful degradation)
self.addEventListener("periodicsync", (event) => {
  if (event.tag === PERIODIC_SYNC_TAG) {
    event.waitUntil(syncPendingItems());
  }
});

/** Build request headers from stored auth context + idempotency key. */
function buildSyncHeaders(item) {
  var headers = { "Content-Type": "application/json" };
  if (item.idempotencyKey) {
    headers["X-Idempotency-Key"] = item.idempotencyKey;
  }
  if (item.auth && item.auth.token) {
    headers["Authorization"] = "Bearer " + item.auth.token;
  }
  if (item.auth && item.auth.companyId) {
    headers["X-Company-Id"] = item.auth.companyId;
  }
  return headers;
}

async function syncPendingItems() {
  let db;
  try {
    db = await openDb();
  } catch {
    return; // IndexedDB not available
  }

  const items = await getAllPending(db);
  if (items.length === 0) {
    db.close();
    return;
  }

  for (const item of items) {
    try {
      var res;
      if (item.type === "daily-report") {
        const report = item.entry;
        // Parity with buildOfflineDailyReportSyncBody (src/lib/daily-report-offline.ts).
        // SW is plain JS and cannot import TS — keep this object shape in lockstep.
        var dailyData = {
          ReportDate: report.reportDate,
          ReportType: report.reportType,
          WeatherSummary: report.weatherSummary || null,
          TemperatureLow: report.temperatureLow ? Number(report.temperatureLow) : null,
          TemperatureHigh: report.temperatureHigh ? Number(report.temperatureHigh) : null,
          Precipitation: report.precipitation || null,
          Wind: report.wind || null,
          WorkNarrative: report.workNarrative || null,
          DelaysNarrative: report.delaysNarrative || null,
          SafetyNarrative: report.safetyNarrative || null,
          FieldActivities: report.fieldActivities || null,
          TruckConditions: report.truckConditions || null,
          TruckNotes: report.truckNotes || null,
          CrewEntries: report.crewEntries || null,
          Equipment: report.equipment || null,
          Visitors: report.visitors || null,
        };
        if (report.spatialNodeId) {
          dailyData.SpatialNodeId = report.spatialNodeId;
        }
        if (report.planSheetId) {
          dailyData.PlanSheetId = report.planSheetId;
        }
        res = await fetch(`/api/projects/${report.projectId}/daily-reports`, {
          method: "POST",
          headers: buildSyncHeaders(item),
          body: JSON.stringify({
            title: report.title,
            status: report.status,
            data: dailyData,
          }),
        });

        if (res.ok || res.status === 409) {
          await removeItem(db, item.id);
        } else {
          await incrementRetry(db, item);
        }
      } else {
        // time-entry (default)
        const entry = item.entry;
        res = await fetch("/api/time-entries/batch", {
          method: "POST",
          headers: buildSyncHeaders(item),
          body: JSON.stringify({
            isDraft: false,
            allowPartialSuccess: false,
            submittedById: entry.employeeId,
            entries: [{
              date: entry.date,
              employeeId: entry.employeeId,
              projectId: entry.projectId,
              costCodeId: entry.costCodeId,
              regularHours: entry.regularHours,
              overtimeHours: entry.overtimeHours,
              doubletimeHours: entry.doubletimeHours,
              description: entry.description,
              phaseId: entry.phaseId,
              equipmentId: entry.equipmentId,
              equipmentHours: entry.equipmentHours,
              latitude: entry.latitude,
              longitude: entry.longitude,
              locationAccuracy: entry.locationAccuracy,
            }],
          }),
        });

        // 409 = idempotency conflict, server already processed — treat as success
        if (res.status === 409) {
          await removeItem(db, item.id);
        } else if (res.ok) {
          const result = await res.json();
          if (result.failureCount === 0) {
            await removeItem(db, item.id);
          } else {
            await incrementRetry(db, item);
          }
        } else {
          await incrementRetry(db, item);
        }
      }
    } catch {
      await incrementRetry(db, item);
    }
  }

  db.close();

  // Notify clients that sync completed
  const clients = await self.clients.matchAll();
  for (const client of clients) {
    client.postMessage({ type: "SYNC_COMPLETE" });
  }
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getAllPending(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SYNC_QUEUE_STORE, "readonly");
    const store = tx.objectStore(SYNC_QUEUE_STORE);
    const request = store.getAll();
    request.onsuccess = () => {
      const items = request.result.filter(
        (item) => item.status === "pending" || item.status === "failed"
      );
      resolve(items);
    };
    request.onerror = () => reject(request.error);
  });
}

function removeItem(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SYNC_QUEUE_STORE, "readwrite");
    const store = tx.objectStore(SYNC_QUEUE_STORE);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function incrementRetry(db, item) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SYNC_QUEUE_STORE, "readwrite");
    const store = tx.objectStore(SYNC_QUEUE_STORE);
    const updated = {
      ...item,
      retryCount: item.retryCount + 1,
      status: item.retryCount + 1 >= 5 ? "failed" : "pending",
      lastAttempt: new Date().toISOString(),
    };
    const request = store.put(updated);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// --- Strategies ---

async function networkFirstWithCache(request) {
  const cache = await caches.open(API_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: "Offline", items: [] }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("Offline", { status: 503 });
  }
}

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Return cached root as fallback for SPA navigation
    const root = await caches.match("/");
    if (root) return root;
    // Last resort: show offline page
    const offlinePage = await caches.match("/offline.html");
    if (offlinePage) return offlinePage;
    return new Response("Offline", { status: 503 });
  }
}

function isStaticAsset(pathname) {
  return /\.(js|css|png|jpg|jpeg|svg|ico|woff2?|ttf|eot)$/i.test(pathname) ||
    pathname.startsWith("/_next/");
}

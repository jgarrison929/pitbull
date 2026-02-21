// Pitbull Construction Solutions — Service Worker
// Caches app shell + API responses for offline time entry

const CACHE_VERSION = "v1";
const STATIC_CACHE = `pitbull-static-${CACHE_VERSION}`;
const API_CACHE = `pitbull-api-${CACHE_VERSION}`;

// App shell assets to precache
const PRECACHE_URLS = ["/", "/time-tracking/mobile"];

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

// Listen for sync messages from the client
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

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
    return new Response("Offline", { status: 503 });
  }
}

function isStaticAsset(pathname) {
  return /\.(js|css|png|jpg|jpeg|svg|ico|woff2?|ttf|eot)$/i.test(pathname) ||
    pathname.startsWith("/_next/");
}

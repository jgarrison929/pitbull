import "fake-indexeddb/auto";

// Ensure `window` exists for code that checks `typeof window !== "undefined"`
if (typeof globalThis.window === "undefined") {
  // @ts-expect-error — minimal window shim for offline-store
  globalThis.window = globalThis;
}

import { describe, it, expect, beforeEach, vi } from "vitest";
import { buildAuthCookie, setToken, getToken, removeToken } from "@/lib/auth";

function installBrowserShim(protocol: "http:" | "https:") {
  const store = new Map<string, string>();
  let cookie = "";

  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
  });

  vi.stubGlobal("document", {
    get cookie() {
      return cookie;
    },
    set cookie(value: string) {
      cookie = value;
    },
  });

  vi.stubGlobal("window", {
    location: { protocol },
    localStorage: globalThis.localStorage,
    document: globalThis.document,
  });
}

describe("auth cookie handoff", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("buildAuthCookie omits Secure on http localhost", () => {
    installBrowserShim("http:");
    const cookie = buildAuthCookie("jwt-token");
    expect(cookie).toContain("pitbull_token=jwt-token");
    expect(cookie).not.toContain("Secure");
  });

  it("buildAuthCookie includes Secure on https", () => {
    installBrowserShim("https:");
    const cookie = buildAuthCookie("jwt-token");
    expect(cookie).toContain("; Secure");
  });

  it("setToken writes localStorage and cookie for middleware", () => {
    installBrowserShim("http:");
    setToken("abc123");
    expect(getToken()).toBe("abc123");
    expect(globalThis.document.cookie).toContain("pitbull_token=abc123");
    removeToken();
    expect(getToken()).toBeNull();
  });
});
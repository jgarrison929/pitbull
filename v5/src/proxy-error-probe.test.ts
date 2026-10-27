/**
 * /app/error-probe must return HTTP 404 when V5_ERROR_PROBE is unset.
 * Page-level notFound() alone can still commit 200 under the app shell.
 */
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("proxy error-probe gate", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    delete process.env.V5_ERROR_PROBE;
  });

  it("returns HTTP 404 when V5_ERROR_PROBE is unset (no session)", async () => {
    delete process.env.V5_ERROR_PROBE;
    const { proxy } = await import("@/proxy");
    const res = await proxy(new NextRequest("http://localhost/app/error-probe"));
    expect(res.status).toBe(404);
    expect(await res.text()).toContain("This page could not be found");
  });

  it("passes through when V5_ERROR_PROBE=1", async () => {
    process.env.V5_ERROR_PROBE = "1";
    const { proxy } = await import("@/proxy");
    const res = await proxy(new NextRequest("http://localhost/app/error-probe"));
    // next() is opaque; status 200 with empty body is the pass-through shape.
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });
});

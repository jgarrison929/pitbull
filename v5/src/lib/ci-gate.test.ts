import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CI_GATE_CACHE_TTL_MS,
  clearCiGateCache,
  fetchCiGate,
  resolveCiGate,
} from "./ci-gate";

afterEach(() => {
  clearCiGateCache();
});

function passFetch() {
  return vi.fn(async () =>
    Response.json({
      check_runs: [
        { name: "ci-gate", status: "completed", conclusion: "success" },
      ],
    }),
  );
}

describe("resolveCiGate", () => {
  it("honors CI_GATE_RESULT override", async () => {
    expect(await resolveCiGate("abc", { CI_GATE_RESULT: "pass" })).toBe("pass");
    expect(await resolveCiGate("abc", { CI_GATE_RESULT: "fail" })).toBe("fail");
  });

  it("is unknown without a commit", async () => {
    expect(await fetchCiGate("unknown")).toBe("unknown");
    expect(await fetchCiGate("")).toBe("unknown");
  });

  it("maps a successful ci-gate check-run to pass", async () => {
    const fetchFn = passFetch();
    expect(await fetchCiGate("0123456789ab", {}, fetchFn)).toBe("pass");
    expect(fetchFn).toHaveBeenCalledOnce();
    const url = String(fetchFn.mock.calls.at(0)?.at(0) ?? "");
    expect(url).toContain("/commits/0123456789ab/check-runs");
    expect(url).toContain("check_name=ci-gate");
  });

  it("maps failure conclusions to fail and incomplete to pending", async () => {
    const fail = vi.fn(async () =>
      Response.json({
        check_runs: [
          { name: "ci-gate", status: "completed", conclusion: "failure" },
        ],
      }),
    );
    expect(await fetchCiGate("abc", {}, fail)).toBe("fail");
    clearCiGateCache();
    const pending = vi.fn(async () =>
      Response.json({
        check_runs: [
          { name: "ci-gate", status: "in_progress", conclusion: null },
        ],
      }),
    );
    expect(await fetchCiGate("abc", {}, pending)).toBe("pending");
  });

  it("is unknown when GitHub errors", async () => {
    const fetchFn = vi.fn(async () => new Response("nope", { status: 403 }));
    expect(await fetchCiGate("abc", {}, fetchFn)).toBe("unknown");
  });

  it("sends Authorization when GITHUB_TOKEN is set", async () => {
    const fetchFn = passFetch();
    await fetchCiGate("abc", { GITHUB_TOKEN: "ghs_test" }, fetchFn);
    expect(fetchFn).toHaveBeenCalledWith(
      expect.stringContaining("/commits/abc/check-runs"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer ghs_test",
        }),
      }),
    );
  });
});

describe("ci-gate server cache", () => {
  it("does not call GitHub again for the same commit within the TTL", async () => {
    const fetchFn = passFetch();
    const now = 1_000_000;
    const clock = () => now;

    expect(await fetchCiGate("deadbeef", {}, fetchFn, clock)).toBe("pass");
    expect(await fetchCiGate("deadbeef", {}, fetchFn, clock)).toBe("pass");
    expect(await resolveCiGate("deadbeef", {}, fetchFn, clock)).toBe("pass");
    expect(fetchFn).toHaveBeenCalledOnce();
  });

  it("looks up again after the TTL expires", async () => {
    const fetchFn = passFetch();
    let now = 1_000_000;
    const clock = () => now;

    await fetchCiGate("cafe", {}, fetchFn, clock);
    now += CI_GATE_CACHE_TTL_MS + 1;
    await fetchCiGate("cafe", {}, fetchFn, clock);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("keys the cache by commit (different SHAs fetch separately)", async () => {
    const fetchFn = passFetch();
    const clock = () => 1_000_000;
    await fetchCiGate("aaa", {}, fetchFn, clock);
    await fetchCiGate("bbb", {}, fetchFn, clock);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});

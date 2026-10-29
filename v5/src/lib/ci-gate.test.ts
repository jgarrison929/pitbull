import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CI_GATE_CACHE_TTL_MS,
  CI_GATE_ERROR_TTL_MS,
  ciGateForRequest,
  clearCiGateCache,
  fetchCiGate,
  formatCiGateLabel,
  rememberCiGate,
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
    expect(await resolveCiGate("abc", { CI_GATE_RESULT: "pass" })).toEqual({
      result: "pass",
      stale: false,
      ageMs: 0,
    });
    expect(await resolveCiGate("abc", { CI_GATE_RESULT: "fail" })).toEqual({
      result: "fail",
      stale: false,
      ageMs: 0,
    });
  });

  it("is unknown without a commit", async () => {
    expect(await fetchCiGate("unknown")).toMatchObject({ result: "unknown" });
    expect(await fetchCiGate("")).toMatchObject({ result: "unknown" });
  });

  it("maps a successful ci-gate check-run to pass", async () => {
    const fetchFn = passFetch();
    expect(await fetchCiGate("0123456789ab", {}, fetchFn)).toMatchObject({
      result: "pass",
      stale: false,
    });
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
    expect(await fetchCiGate("abc", {}, fail)).toMatchObject({ result: "fail" });
    clearCiGateCache();
    const pending = vi.fn(async () =>
      Response.json({
        check_runs: [
          { name: "ci-gate", status: "in_progress", conclusion: null },
        ],
      }),
    );
    expect(await fetchCiGate("abc", {}, pending)).toMatchObject({
      result: "pending",
    });
  });

  it("is unknown when GitHub errors and there is no last good", async () => {
    const fetchFn = vi.fn(async () => new Response("nope", { status: 403 }));
    expect(await fetchCiGate("abc", {}, fetchFn)).toMatchObject({
      result: "unknown",
      stale: false,
    });
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

    expect(await fetchCiGate("deadbeef", {}, fetchFn, clock)).toMatchObject({
      result: "pass",
    });
    expect(await fetchCiGate("deadbeef", {}, fetchFn, clock)).toMatchObject({
      result: "pass",
    });
    expect(await resolveCiGate("deadbeef", {}, fetchFn, clock)).toMatchObject({
      result: "pass",
    });
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

  it("returns the known result after the TTL without waiting on GitHub", async () => {
    let now = 1_000_000;
    const clock = () => now;
    const fetchFn = passFetch();
    await fetchCiGate("page", {}, fetchFn, clock);
    now += CI_GATE_CACHE_TTL_MS + 1;
    let release!: () => void;
    const hung = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          release = () =>
            resolve(
              Response.json({
                check_runs: [
                  {
                    name: "ci-gate",
                    status: "completed",
                    conclusion: "success",
                  },
                ],
              }),
            );
        }),
    );
    const started = Date.now();
    const gate = await ciGateForRequest("page", {}, hung, clock);
    expect(Date.now() - started).toBeLessThan(200);
    // Overdue: the last pass is served immediately, and it is stale.
    expect(gate.result).toBe("pass");
    expect(gate.stale).toBe(true);
    expect(gate.ageMs).toBe(CI_GATE_CACHE_TTL_MS + 1);
    expect(formatCiGateLabel(gate)).toBe(
      `pass (stale ${Math.round((CI_GATE_CACHE_TTL_MS + 1) / 1000)}s)`,
    );
    expect(hung).toHaveBeenCalledOnce();
    release();
    await vi.waitFor(() => expect(hung).toHaveBeenCalledOnce());
  });

  it("outage after a pass reports stale=true and pass (stale Ns)", async () => {
    let now = 1_000_000;
    const clock = () => now;
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          check_runs: [
            { name: "ci-gate", status: "completed", conclusion: "success" },
          ],
        }),
      )
      .mockResolvedValue(new Response("unavailable", { status: 503 }));

    const fresh = await fetchCiGate("outage-sha", {}, fetchFn, clock);
    expect(fresh).toMatchObject({ result: "pass", stale: false, ageMs: 0 });

    now += CI_GATE_CACHE_TTL_MS + 1_500;
    const samples = [];
    for (let i = 0; i < 4; i++) {
      samples.push(await ciGateForRequest("outage-sha", {}, fetchFn, clock));
      now += CI_GATE_ERROR_TTL_MS;
    }
    await vi.waitFor(() => expect(fetchFn.mock.calls.length).toBeGreaterThan(1));

    for (const gate of samples) {
      expect(gate.result).toBe("pass");
      expect(gate.stale).toBe(true);
      expect(gate.ageMs).toBeGreaterThan(0);
      expect(formatCiGateLabel(gate)).toMatch(/^pass \(stale \d+s\)$/);
    }

    // After the failed refresh is recorded, a later read is still stale.
    const settled = await ciGateForRequest("outage-sha", {}, fetchFn, clock);
    expect(settled).toMatchObject({ result: "pass", stale: true });
    expect(formatCiGateLabel(settled)).toMatch(/^pass \(stale \d+s\)$/);
  });

  it("an observation with an unknown age is stale", async () => {
    rememberCiGate("no-age", "pass", null, () => 5_000_000);
    const fetchFn = vi.fn(async () => new Response("down", { status: 503 }));
    const gate = await ciGateForRequest("no-age", {}, fetchFn, () => 5_000_000);
    expect(gate).toMatchObject({ result: "pass", stale: true, ageMs: null });
    expect(formatCiGateLabel(gate)).toBe("pass (stale)");
    await vi.waitFor(() => expect(fetchFn).toHaveBeenCalledOnce());
  });

  it("keys the cache by commit (different SHAs fetch separately)", async () => {
    const fetchFn = passFetch();
    const clock = () => 1_000_000;
    await fetchCiGate("aaa", {}, fetchFn, clock);
    await fetchCiGate("bbb", {}, fetchFn, clock);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("single-flights concurrent refreshes (100 → 1 GitHub call)", async () => {
    let resolveFetch!: (r: Response) => void;
    const fetchFn = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    let now = 1_000_000;
    const clock = () => now;

    // Warm cache with a completed pass first.
    const warm = passFetch();
    await fetchCiGate("stampede", {}, warm, clock);
    now += CI_GATE_CACHE_TTL_MS + 1;

    const pending = Array.from({ length: 100 }, () =>
      fetchCiGate("stampede", {}, fetchFn, clock),
    );
    // Only one in-flight lookup should have started.
    expect(fetchFn).toHaveBeenCalledTimes(1);

    resolveFetch!(
      Response.json({
        check_runs: [
          { name: "ci-gate", status: "completed", conclusion: "success" },
        ],
      }),
    );
    const results = await Promise.all(pending);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(results.every((r) => r.result === "pass")).toBe(true);
  });

  it("stale-while-error keeps last good and uses short error TTL", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          check_runs: [
            { name: "ci-gate", status: "completed", conclusion: "success" },
          ],
        }),
      )
      .mockResolvedValue(new Response("rate limited", { status: 403 }));

    let now = 1_000_000;
    const clock = () => now;

    const first = await fetchCiGate("stale", {}, fetchFn, clock);
    expect(first).toMatchObject({ result: "pass", stale: false });

    now += CI_GATE_CACHE_TTL_MS + 1;
    const second = await fetchCiGate("stale", {}, fetchFn, clock);
    expect(second).toMatchObject({ result: "pass", stale: true });
    expect(second.ageMs).toBeGreaterThan(0);
    expect(fetchFn).toHaveBeenCalledTimes(2);

    // Still within error TTL: no third GitHub call; still pass/stale.
    now += CI_GATE_ERROR_TTL_MS - 1;
    const third = await fetchCiGate("stale", {}, fetchFn, clock);
    expect(third).toMatchObject({ result: "pass", stale: true });
    expect(fetchFn).toHaveBeenCalledTimes(2);

    // After short error TTL, retries GitHub (still 403) but keeps last good.
    now += 2;
    const fourth = await fetchCiGate("stale", {}, fetchFn, clock);
    expect(fourth).toMatchObject({ result: "pass", stale: true });
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it("does not cache unknown for the full success TTL", async () => {
    const fetchFn = vi.fn(async () => new Response("nope", { status: 403 }));
    let now = 1_000_000;
    const clock = () => now;

    await fetchCiGate("short-unknown", {}, fetchFn, clock);
    now += CI_GATE_ERROR_TTL_MS + 1;
    await fetchCiGate("short-unknown", {}, fetchFn, clock);
    expect(fetchFn).toHaveBeenCalledTimes(2);

    // Still well under the 5-minute success TTL — would be 1 call if unknown
    // were cached for CI_GATE_CACHE_TTL_MS.
    expect(now - 1_000_000).toBeLessThan(CI_GATE_CACHE_TTL_MS);
  });
});

import { describe, expect, it, vi } from "vitest";
import { fetchCiGate, resolveCiGate } from "./ci-gate";

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
    const fetchFn = vi.fn(async () =>
      Response.json({
        check_runs: [
          { name: "ci-gate", status: "completed", conclusion: "success" },
        ],
      }),
    );
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
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { clearCiGateCache } from "./ci-gate";
import { getDeployStatus } from "./deploy-status";

afterEach(() => {
  clearCiGateCache();
});

describe("getDeployStatus ci-gate traffic", () => {
  it("does not call GitHub on every status read for the same commit", async () => {
    const fetchFn = vi.fn(async () =>
      Response.json({
        check_runs: [
          { name: "ci-gate", status: "completed", conclusion: "success" },
        ],
      }),
    );
    const env = {
      RAILWAY_GIT_COMMIT_SHA: "0123456789abcdef",
      // Force GitHub path (no CI_GATE_RESULT override).
      LAST_VERIFY_AT: "2026-10-20T17:00:00.000Z",
    };

    const a = await getDeployStatus(env, fetchFn);
    const b = await getDeployStatus(env, fetchFn);

    expect(a.ciGate).toBe("pass");
    expect(b.ciGate).toBe("pass");
    expect(a.ciGateStale).toBe(false);
    expect(a.lastVerifyAt).toBe("2026-10-20T17:00:00.000Z");
    expect(fetchFn).toHaveBeenCalledOnce();
  });
});

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
    const full = "0123456789abcdef0123456789abcdef01234567";
    const verifyCommit = "0057a2c9b0e7ffff0057a2c9b0e7ffff0057a2c9";
    const env = {
      RAILWAY_GIT_COMMIT_SHA: full,
      // Force GitHub path (no CI_GATE_RESULT override).
      LAST_VERIFY_AT: "2026-10-20T17:00:00.000Z",
      LAST_VERIFY_COMMIT: verifyCommit,
    };

    // Pass db=null so a developer machine with DATABASE_URL set does not hit Postgres.
    const a = await getDeployStatus(env, fetchFn, null);
    const b = await getDeployStatus(env, fetchFn, null);

    expect(a.ciGate).toBe("pass");
    expect(b.ciGate).toBe("pass");
    expect(a.ciGateStale).toBe(false);
    expect(a.commit).toBe(full);
    expect(a.lastVerifyAt).toBe("2026-10-20T17:00:00.000Z");
    expect(a.lastVerifyCommit).toBe(verifyCommit);
    expect(a.lastVerifyCommit).toHaveLength(40);
    expect(b.lastVerifyCommit).toBe(verifyCommit);
    expect(a.migrations).toBeNull();
    expect(fetchFn).toHaveBeenCalledOnce();
  });

  it("exposes null lastVerifyCommit when unset", async () => {
    const status = await getDeployStatus(
      {
        RAILWAY_GIT_COMMIT_SHA: "0123456789abcdef0123456789abcdef01234567",
        CI_GATE_RESULT: "pass",
        LAST_VERIFY_AT: "2026-10-20T17:00:00.000Z",
      },
      vi.fn(),
      null,
    );
    expect(status.lastVerifyAt).toBe("2026-10-20T17:00:00.000Z");
    expect(status.lastVerifyCommit).toBeNull();
    expect(status.migrations).toBeNull();
  });
});


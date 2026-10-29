import { afterEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/db";
import {
  CI_GATE_CACHE_TTL_MS,
  clearCiGateCache,
  formatCiGateLabel,
} from "./ci-gate";
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

  it("a stored pass inside the TTL is not stale", async () => {
    const full = "0123456789abcdef0123456789abcdef01234567";
    const observedAt = new Date(Date.now() - 2_000);
    const fetchFn = vi.fn(async () => new Response("down", { status: 503 }));
    const status = await getDeployStatus(
      { RAILWAY_GIT_COMMIT_SHA: full },
      fetchFn,
      mockStoredDb({ value: `${full} pass`, updatedAt: observedAt }),
    );
    expect(status.ciGate).toBe("pass");
    expect(status.ciGateStale).toBe(false);
    expect(status.ciGateAgeMs).toBeGreaterThanOrEqual(1_000);
    expect(status.ciGateAgeMs).toBeLessThan(CI_GATE_CACHE_TTL_MS);
    expect(fetchFn).not.toHaveBeenCalled();
    expect(
      formatCiGateLabel({
        result: status.ciGate,
        stale: status.ciGateStale,
        ageMs: status.ciGateAgeMs,
      }),
    ).toBe("pass");
  });

  it("outage after a stored pass reports stale=true and pass (stale Ns)", async () => {
    const full = "abcdef0123456789abcdef0123456789abcdef01";
    const observedAt = new Date(Date.now() - CI_GATE_CACHE_TTL_MS - 4_000);
    const fetchFn = vi.fn(async () => new Response("down", { status: 503 }));
    const db = mockStoredDb({ value: `${full} pass`, updatedAt: observedAt });
    const env = { RAILWAY_GIT_COMMIT_SHA: full };

    const started = Date.now();
    const status = await getDeployStatus(env, fetchFn, db);
    expect(Date.now() - started).toBeLessThan(200);
    expect(status.ciGate).toBe("pass");
    expect(status.ciGateStale).toBe(true);
    expect(status.ciGateAgeMs).toBeGreaterThanOrEqual(CI_GATE_CACHE_TTL_MS);
    expect(
      formatCiGateLabel({
        result: status.ciGate,
        stale: status.ciGateStale,
        ageMs: status.ciGateAgeMs,
      }),
    ).toMatch(/^pass \(stale \d+s\)$/);

    await vi.waitFor(() => expect(fetchFn).toHaveBeenCalled());
    const again = await getDeployStatus(env, fetchFn, db);
    expect(again.ciGate).toBe("pass");
    expect(again.ciGateStale).toBe(true);
    expect(again.ciGateAgeMs).toBeGreaterThan(0);
    expect(
      formatCiGateLabel({
        result: again.ciGate,
        stale: again.ciGateStale,
        ageMs: again.ciGateAgeMs,
      }),
    ).toMatch(/^pass \(stale \d+s\)$/);
  });
});

function mockStoredDb(row: { value: string; updatedAt: Date } | null): Db {
  return {
    select() {
      return {
        from() {
          return {
            where() {
              return {
                limit: async () => (row ? [row] : []),
              };
            },
          };
        },
      };
    },
    async execute() {
      throw new Error("no migrations table");
    },
    insert() {
      throw new Error("stale read must not rewrite ci_gate_latest");
    },
  } as unknown as Db;
}


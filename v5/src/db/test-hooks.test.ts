/**
 * Wrap-off must-fail: query budgets must not pass vacuously when the test wrap
 * is unregistered. Production import boundary is enforced by ESLint
 * `no-restricted-imports` in eslint.config.mjs (not source-grep).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  getDbQueryCount,
  installDbTestHooks,
  resetDbClient,
  uninstallDbTestHooks,
} from "@/db/test-hooks";

describe("db test hooks wrap gating", () => {
  beforeAll(async () => {
    // Ensure a known installed baseline for sibling files in the same worker.
    installDbTestHooks();
    await resetDbClient();
  });

  afterAll(async () => {
    installDbTestHooks();
    await resetDbClient();
  });

  it("must-fail: getDbQueryCount throws when wrap is unregistered", async () => {
    uninstallDbTestHooks();
    await resetDbClient();
    try {
      expect(() => getDbQueryCount()).toThrow(/wrap is not installed/);
    } finally {
      installDbTestHooks();
      await resetDbClient();
    }
  });

  it("getDbQueryCount returns a number once wrap is reinstalled", async () => {
    installDbTestHooks();
    await resetDbClient();
    expect(getDbQueryCount()).toBe(0);
  });
});

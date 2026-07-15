import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

/** 3.2.8 - ensure prod band pure helpers keep tests on disk */
const required = [
  "sw-cache-version.test.ts",
  "fetch-retry.test.ts",
  "deploy-recovery.test.ts",
  "plan-pin-flush.test.ts",
  "plans-open-copy.test.ts",
  "posthog-session-recording.test.ts",
  "help-deploy-offline.test.ts",
];

describe("3.2.8 prod helper test coverage", () => {
  it("ships vitest files for band helpers", () => {
    const dir = join(__dirname);
    for (const f of required) {
      expect(existsSync(join(dir, f)), f).toBe(true);
    }
  });
});

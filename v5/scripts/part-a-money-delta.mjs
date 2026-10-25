#!/usr/bin/env node
/**
 * Print the 5.0.2 Part A money-delta markdown table from live rollups.
 *
 *   cd v5 && V5_SEED_NOW=2026-10-20T17:00:00.000Z \
 *     npx vitest run src/server/part-a-money-delta.test.ts --reporter=verbose
 *
 * The test seeds a throwaway sandbox, reads jobRollupSql (same path as
 * job-eac data-cents), reconstructs the flat-$85 before column, and prints
 * the markdown table. Requires DATABASE_URL.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
process.env.V5_SEED_NOW ??= "2026-10-20T17:00:00.000Z";
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}
const r = spawnSync(
  "npx",
  [
    "vitest",
    "run",
    "src/server/part-a-money-delta.test.ts",
    "--reporter=verbose",
  ],
  { cwd: root, env: process.env, encoding: "utf8" },
);
process.stdout.write(r.stdout);
process.stderr.write(r.stderr);
process.exit(r.status ?? 1);

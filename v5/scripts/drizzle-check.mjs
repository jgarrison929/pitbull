#!/usr/bin/env node
/**
 * Fails when drizzle-kit would emit a new migration — keeps journal + snapshots
 * in sync with src/db/schema.ts (Pitbull #645: missing 0003_snapshot recreates 0003).
 */
import { execSync } from "node:child_process";
import { readdirSync, existsSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const drizzleDir = path.join(root, "drizzle");

const before = new Set(readdirSync(drizzleDir).filter((f) => f.endsWith(".sql")));
const metaBefore = new Set(
  readdirSync(path.join(drizzleDir, "meta")).filter((f) => f.endsWith(".json")),
);

const out = execSync("npx drizzle-kit generate --name ci_schema_probe", {
  cwd: root,
  encoding: "utf8",
});

const after = readdirSync(drizzleDir).filter((f) => f.endsWith(".sql"));
const metaAfter = readdirSync(path.join(drizzleDir, "meta")).filter((f) =>
  f.endsWith(".json"),
);
const newSql = after.filter((f) => !before.has(f));
const newMeta = metaAfter.filter((f) => !metaBefore.has(f));

for (const f of newSql) rmSync(path.join(drizzleDir, f), { force: true });
for (const f of newMeta) {
  const p = path.join(drizzleDir, "meta", f);
  if (f !== "_journal.json") rmSync(p, { force: true });
}

// Restore journal if generate appended a probe entry.
const journalPath = path.join(drizzleDir, "meta", "_journal.json");
if (existsSync(journalPath) && (newSql.length || out.includes("migration file"))) {
  // Re-read and drop probe tags.
  const { readFileSync, writeFileSync } = await import("node:fs");
  const j = JSON.parse(readFileSync(journalPath, "utf8"));
  const cleaned = {
    ...j,
    entries: j.entries.filter((e) => !String(e.tag).includes("ci_schema_probe")),
  };
  cleaned.entries.forEach((e, i) => {
    e.idx = i;
  });
  writeFileSync(journalPath, JSON.stringify(cleaned, null, 2) + "\n");
}

if (newSql.length || !out.includes("No schema changes")) {
  if (newSql.length === 0 && out.includes("No schema changes")) {
    console.log("drizzle-check: schema in sync with migrations");
    process.exit(0);
  }
  console.error("drizzle-check FAIL: schema drift — run drizzle-kit generate and commit.");
  console.error(out);
  if (newSql.length) console.error("would add:", newSql.join(", "));
  process.exit(1);
}

console.log("drizzle-check: schema in sync with migrations");

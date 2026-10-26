#!/usr/bin/env node
// Must-fail test for the stress-seed DATABASE_URL leak: with a '/' (or ? # @ %) in the password, the old
// stress-seed.mjs handed the raw URL to postgres(), which threw Invalid URL and printed the whole URL,
// password included. Uses the real postgres.js from v5/node_modules and spawns the real script.
//   1. parse: parsePostgresUrl yields the right user / password / host / port / database, and postgres.js
//      itself, given the connection string, reads the same parts (sql.options; no network).
//   2. leak: stress-seed.mjs against a closed local port must FAIL by trying exactly that host:port
//      (ECONNREFUSED 127.0.0.1:<port>) and print neither the password nor the user info.
//   3. connect (when STRESS_SEED_TEST_PG is a postgres:// admin URL for a throwaway database): a role
//      with each password really connects through the parsed string, and stress-seed.mjs gets past the
//      connection (it fails later on the empty database, never on the URL) with no password in output.
// Passwords are made up for this test.
// Run: node .cursor/skills/verify-v5/stress-seed-mustfail.test.mjs
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parsePostgresUrl } from "./db-url.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, "../../../v5/package.json"));
const postgres = require("postgres");
const script = path.join(here, "stress-seed.mjs");

// ab"cd\ef: a quote and a backslash come out escaped in JSON (lead review on PR #20).
export const TEST_PASSWORDS = ["ab/cd", "p@ss/word", "Zq:/?#@%x", String.raw`ab"cd\ef`];
const USER = "pvskill_user";
const DB = "pv_skill_db";
const lines = [];

// A port with nothing listening (bound, then closed).
const closedPort = await new Promise((r) => {
  const s = net.createServer();
  s.listen(0, "127.0.0.1", () => {
    const { port } = s.address();
    s.close(() => r(port));
  });
});

/** Every way the secret could show up in output or evidence: raw, URL-encoded, JSON-escaped (once, twice), HTML-escaped. */
const jsonEsc = (x) => JSON.stringify(x).slice(1, -1);
const leaks = (out, pw) => [...new Set([pw, encodeURIComponent(pw), `${USER}:${pw}`, jsonEsc(pw), jsonEsc(jsonEsc(pw)), jsonEsc(`${USER}:${pw}`), pw.replace(/"/g, "&quot;")])].filter((x) => out.includes(x));

const runSeed = (url, extraArgs = []) => {
  const r = spawnSync(process.execPath, [script, "--url", `http://127.0.0.1:${closedPort}`, ...extraArgs], {
    encoding: "utf8",
    env: { PATH: process.env.PATH, HOME: process.env.HOME, DATABASE_URL: url },
    timeout: 60_000,
  });
  return { status: r.status, out: `${r.stdout}\n${r.stderr}` };
};

for (const pw of TEST_PASSWORDS) {
  const url = `postgres://${USER}:${pw}@127.0.0.1:${closedPort}/${DB}`;
  // 1. parse
  const p = parsePostgresUrl(url);
  assert.ok(p, `parsePostgresUrl must accept ${JSON.stringify(pw)}`);
  assert.deepEqual({ user: p.user, password: p.password, host: p.host, port: p.port, database: p.database }, { user: USER, password: pw, host: "127.0.0.1", port: String(closedPort), database: DB }, `parts for ${JSON.stringify(pw)}`);
  const sql = postgres(p.connectionString, { max: 1 });
  const o = sql.options;
  assert.deepEqual({ user: o.user, pass: o.pass, host: o.host, port: o.port, database: o.database }, { user: USER, pass: pw, host: ["127.0.0.1"], port: [closedPort], database: DB }, `postgres.js reads the same parts for ${JSON.stringify(pw)}`);
  await sql.end({ timeout: 1 });
  lines.push(`passes: ${JSON.stringify(pw)} → user ${USER}, host 127.0.0.1:${closedPort}, db ${DB}; postgres.js options agree`);
  // 2. leak (stdout/stderr and the --out evidence file)
  const outDir = mkdtempSync(path.join(os.tmpdir(), "stress-seed-out-"));
  const outFile = path.join(outDir, "stress-seed.json");
  const r = runSeed(url, ["--out", outFile]);
  const written = readFileSync(outFile, "utf8");
  rmSync(outDir, { recursive: true, force: true });
  assert.equal(r.status, 1, `stress-seed must exit 1 on a closed port; got ${r.status}: ${r.out.slice(0, 300)}`);
  assert.deepEqual(leaks(r.out, pw), [], `stress-seed output must not contain the password ${JSON.stringify(pw)}: ${JSON.stringify(r.out.slice(0, 400))}`);
  assert.deepEqual(leaks(written, pw), [], `stress-seed --out must not contain the password ${JSON.stringify(pw)} in any form: ${written.slice(0, 400)}`);
  assert.doesNotThrow(() => JSON.parse(written), "--out is valid JSON");
  assert.match(r.out, new RegExp(`FAIL stress seed .*ECONNREFUSED 127\\.0\\.0\\.1:${closedPort}`), `must fail by connecting to the parsed host:port; got ${JSON.stringify(r.out.slice(0, 400))}`);
  lines.push(`FAILS as expected (no leak): ${JSON.stringify(pw)} → ${r.out.trim().split("\n")[0].slice(0, 160)}`);
}
{
  // An unusable URL is refused without echoing it.
  const bad = "postgres://only-user-no-host@";
  const r = runSeed(bad);
  assert.equal(r.status, 2);
  assert.ok(!r.out.includes("only-user-no-host"), `unusable URL must not be echoed: ${r.out}`);
  lines.push(`FAILS as expected (no echo): unusable DATABASE_URL → ${r.out.trim().split("\n")[0]}`);
}

// 3. real connect, when a throwaway Postgres is provided.
const admin = process.env.STRESS_SEED_TEST_PG;
if (admin) {
  const a = parsePostgresUrl(admin);
  assert.ok(a, "STRESS_SEED_TEST_PG must be a postgres:// URL");
  const asql = postgres(a.connectionString, { max: 1, onnotice: () => {} });
  try {
    await asql.unsafe(`drop database if exists ${DB}`);
    await asql.unsafe(`create database ${DB}`);
    for (const [i, pw] of TEST_PASSWORDS.entries()) {
      const role = `${USER}${i}`;
      await asql.unsafe(`drop role if exists ${role}`);
      await asql.unsafe(`create role ${role} login password '${pw.replace(/'/g, "''")}'`);
      await asql.unsafe(`grant all on database ${DB} to ${role}`);
      const url = `postgres://${role}:${pw}@${a.host}:${a.port || 5432}/${DB}`;
      const u = postgres(parsePostgresUrl(url).connectionString, { max: 1 });
      const [{ who }] = await u`select current_user as who`;
      await u.end({ timeout: 5 });
      assert.equal(who, role);
      const r = runSeed(url);
      assert.deepEqual(leaks(r.out, pw), [], `stress-seed output must not contain ${JSON.stringify(pw)}: ${r.out.slice(0, 400)}`);
      assert.match(r.out, /relation "companies" does not exist/, `stress-seed must get past the connection (empty db) for ${JSON.stringify(pw)}; got ${r.out.slice(0, 300)}`);
      lines.push(`passes: real Postgres login as ${role} with ${JSON.stringify(pw)}; stress-seed connects (fails later on the empty db), no password in output`);
    }
  } finally {
    for (const i of TEST_PASSWORDS.keys()) await asql.unsafe(`drop owned by ${USER}${i}`).catch(() => {});
    await asql.unsafe(`drop database if exists ${DB}`).catch(() => {});
    for (const i of TEST_PASSWORDS.keys()) await asql.unsafe(`drop role if exists ${USER}${i}`).catch(() => {});
    await asql.end({ timeout: 5 });
  }
} else {
  lines.push("note: STRESS_SEED_TEST_PG unset, real-connect cases not run (parse + no-leak cases above ran)");
}
for (const l of lines) console.log(l);
console.log(`ok: stress-seed-mustfail.test.mjs (${lines.filter((l) => !l.startsWith("note")).length} cases)`);

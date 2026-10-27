// Must-fails for the remote-target gate (target-guard.mjs) and for "importing verify.mjs runs nothing".
// Every child runs under fixtures/net-block.cjs, which records and blocks any non-local network attempt before DNS
// or connect, and any browser launch, so no case here can reach a remote host even if the gate regressed.
// PV_GUARD_VERIFY=<path> points the process cases at another verify.mjs (used to show the pre-guard file FAILS).
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, existsSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isLocalDbUrl, isLocalHost, isLocalUrl, remoteTargetGate, REMOTE_REFUSED_EXIT, TARGET_ENV } from "./target-guard.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const verify = path.resolve(process.env.PV_GUARD_VERIFY ?? path.join(here, "verify.mjs"));
const preload = path.join(here, "fixtures", "net-block.cjs");
const lines = [];
const pass = (m) => lines.push(`passes: ${m}`);

// --- unit: hosts and the gate
for (const h of ["localhost", "LOCALHOST", "app.localhost", "127.0.0.1", "127.9.8.7", "::1", "[::1]"]) assert.ok(isLocalHost(h), h);
for (const h of ["pitbull-web-staging.up.railway.app", "demo.pcserp.app", "localhost.evil.example", "127.0.0.1.nip.io", "0.0.0.0", "10.0.0.1", ""]) assert.ok(!isLocalHost(h), h);
assert.ok(isLocalUrl("http://127.0.0.1:3100") && !isLocalUrl("file:///etc/passwd") && !isLocalUrl("not a url"));
pass("isLocalHost / isLocalUrl: localhost, *.localhost, 127/8, ::1 only");
const S = "https://pitbull-web-staging.up.railway.app";
assert.deepEqual(remoteTargetGate({ url: "http://localhost:3100" }), { ok: true, flag: "auto" });
assert.match(remoteTargetGate({ url: S }).error, /refused: .* is not localhost/);
assert.match(remoteTargetGate({ url: S, flag: "auto" }).error, /refused/);
assert.deepEqual(remoteTargetGate({ url: S, flag: "staging" }), { ok: true, flag: "staging" });
assert.deepEqual(remoteTargetGate({ url: S, env: { [TARGET_ENV]: "staging" } }), { ok: true, flag: "staging" });
assert.match(remoteTargetGate({ url: S, flag: "staging", env: { [TARGET_ENV]: "production" } }).error, /disagree/);
assert.match(remoteTargetGate({ url: S, env: { [TARGET_ENV]: "prod" } }).error, /must be staging or production/);
assert.deepEqual(remoteTargetGate({ url: S, selfCheck: true }), { ok: true, flag: "auto" });
pass("remoteTargetGate: remote needs --target or PV_VERIFY_TARGET; local and --self-check pass; conflicts refused");

assert.ok(isLocalDbUrl("postgres://u:p@127.0.0.1:5432/db") && isLocalDbUrl("postgresql://u@localhost/db"));
assert.ok(!isLocalDbUrl("postgres://u@/db?host=/var/run/postgresql"), "a URL the WHATWG parser rejects is not local (strict)");
assert.ok(!isLocalDbUrl("postgres://u:p@db.railway.internal:5432/db") && !isLocalDbUrl("postgres://u:p@10.1.2.3/db") && !isLocalDbUrl("mysql://u@localhost/db") && !isLocalDbUrl("nope"));
pass("isLocalDbUrl: local host only; unparseable is refused");

// --- processes under the blocker
const tmp = mkdtempSync(path.join(os.tmpdir(), "pv-guard-"));
let n = 0;
function run(args, { env = {}, code = null } = {}) {
  const log = path.join(tmp, `net-${++n}.jsonl`);
  const cleanEnv = { ...process.env, PV_NETLOG: log, VERIFY_TOKEN: "", ...env };
  delete cleanEnv[TARGET_ENV];
  if (env[TARGET_ENV]) cleanEnv[TARGET_ENV] = env[TARGET_ENV];
  const r = spawnSync(process.execPath, ["--require", preload, ...(code ? ["--input-type=module", "-e", code] : [verify, ...args])], { env: cleanEnv, encoding: "utf8", timeout: 60000 });
  const events = existsSync(log) ? readFileSync(log, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, events, remote: events.filter((e) => e.blocked) };
}
const noRemote = (name, r) => assert.deepEqual(r.remote, [], `${name}: blocked remote/browser attempts ${JSON.stringify(r.remote)}`);

// Positive control: the blocker sees and blocks a remote attempt (a .invalid host never resolves; nothing leaves).
{
  const r = run([], { code: `try { await fetch("https://verify-guard.invalid/health"); } catch {}` });
  assert.ok(r.remote.some((e) => e.host === "verify-guard.invalid"), `blocker missed a remote fetch: ${JSON.stringify(r.events)}`);
  pass("control: net-block records and blocks a remote fetch");
}
// 1. Import runs nothing.
{
  const r = run([], { code: `await import(${JSON.stringify(pathToFileURL(verify).href)});` });
  assert.equal(r.status, 0, `import exited ${r.status}: ${r.stderr.slice(0, 300)}`);
  noRemote("import verify.mjs", r);
  assert.deepEqual(r.events, [], `import made network/browser calls: ${JSON.stringify(r.events)}`);
  assert.equal(r.stdout.trim(), "", `import printed: ${r.stdout.slice(0, 200)}`);
  pass("import verify.mjs: 0 network calls, 0 browser launches, no output");
}
// 2. No target, default URL (staging): refused before any network.
{
  const r = run([]);
  assert.equal(r.status, REMOTE_REFUSED_EXIT, `no-target run exited ${r.status}: ${r.stderr.slice(0, 300)}`);
  assert.match(r.stderr, /refused: https:\/\/pitbull-web-staging\.up\.railway\.app is not localhost/);
  noRemote("no-target default run", r);
  pass(`node verify.mjs (no target): exit ${REMOTE_REFUSED_EXIT}, 0 remote calls`);
}
// 3. No target, other remote URLs (production host too).
for (const url of ["https://demo.pcserp.app", "https://verify-guard.invalid"]) {
  const r = run(["--url", url, "--rc", "a".repeat(40)]);
  assert.equal(r.status, REMOTE_REFUSED_EXIT, `${url}: exit ${r.status}`);
  noRemote(`no-target ${url}`, r);
  pass(`node verify.mjs --url ${url} (no target): exit ${REMOTE_REFUSED_EXIT}, 0 remote calls`);
}
// 4. A bad PV_VERIFY_TARGET is refused, also before any network.
{
  const r = run([], { env: { [TARGET_ENV]: "prod" } });
  assert.equal(r.status, REMOTE_REFUSED_EXIT);
  assert.match(r.stderr, /must be staging or production/);
  noRemote("bad env target", r);
  pass("PV_VERIFY_TARGET=prod: refused, 0 remote calls");
}
// 5. --self-check stays network-free (and needs no target).
{
  const r = run(["--self-check"]);
  assert.equal(r.status, 0, `self-check exit ${r.status}: ${r.stderr.slice(0, 300)}`);
  noRemote("self-check", r);
  pass("--self-check: exit 0, 0 remote calls, no browser");
}
// 6. The gate is what stops it: with an explicit target and a never-resolving host, the run proceeds and its first
//    remote call is caught by the blocker (proves the cases above are not passing because verify.mjs is inert).
{
  const r = run(["--url", "https://verify-guard.invalid", "--target", "staging", "--main-ci", "off", "--commit", "b".repeat(40)]);
  assert.ok(r.remote.some((e) => e.host === "verify-guard.invalid"), `explicit target made no remote attempt: ${JSON.stringify(r.events).slice(0, 300)} ${r.stderr.slice(0, 200)}`);
  assert.ok(!r.remote.some((e) => e.host && e.host !== "verify-guard.invalid" && !String(e.kind).startsWith("browser")), `explicit target reached another host: ${JSON.stringify(r.remote)}`);
  pass("--target staging on verify-guard.invalid: the run proceeds and only that host is attempted (blocked)");
}
// 7. The local-only must-fail tools refuse a remote URL or a remote DATABASE_URL before any network.
const tool = (f) => path.join(here, f);
const TOOLS = [
  ["confirm-dialog.mustfail.mjs", ["--mode", "control"]],
  ["job-confirm.mustfail.mjs", ["--target", "estimate", "--mode", "control"]],
  ["journeys.mustfail.mjs", ["--journey", "co", "--mode", "control"]],
  ["stress-seed.mjs", []],
];
const LOCAL_DB = "postgres://pv:madeup@127.0.0.1:1/pv";
for (const [f, extra] of TOOLS) {
  const log = path.join(tmp, `tool-${++n}.jsonl`);
  const r = spawnSync(process.execPath, ["--require", preload, tool(f), "--url", "https://pitbull-web-staging.up.railway.app", ...extra], { env: { ...process.env, PV_NETLOG: log, DATABASE_URL: LOCAL_DB }, encoding: "utf8", timeout: 60000 });
  const ev = existsSync(log) ? readFileSync(log, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
  assert.equal(r.status, 2, `${f} remote URL: exit ${r.status} ${r.stderr.slice(0, 200)}`);
  assert.match(r.stderr, /refused: .* is not localhost/);
  assert.deepEqual(ev.filter((e) => e.blocked), [], `${f}: remote attempts ${JSON.stringify(ev)}`);
  pass(`${f} --url <staging>: refused (exit 2), 0 remote calls`);
}
for (const [f, extra] of TOOLS.filter(([f]) => /job-confirm|stress-seed/.test(f))) {
  const r = spawnSync(process.execPath, ["--require", preload, tool(f), "--url", "http://127.0.0.1:1", ...extra], { env: { ...process.env, PV_NETLOG: path.join(tmp, `tooldb-${++n}.jsonl`), DATABASE_URL: "postgres://pv:madeup@db.example.invalid:5432/pv" }, encoding: "utf8", timeout: 60000 });
  assert.equal(r.status, 2, `${f} remote DB: exit ${r.status} ${r.stderr.slice(0, 200)}`);
  assert.match(r.stderr, /DATABASE_URL is not a local database/);
  assert.doesNotMatch(r.stderr, /db\.example\.invalid|madeup/, "the DB host/password is not printed");
  pass(`${f} with a remote DATABASE_URL: refused (exit 2), host not printed`);
}
rmSync(tmp, { recursive: true, force: true });
console.log(lines.join("\n"));
console.log(`target-guard: ${lines.length} cases OK (${path.relative(here, verify) || "verify.mjs"})`);

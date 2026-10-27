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
import { isLocalDbUrl, isLocalHost, isLocalUrl, isPrivateAddress, localDbGate, LOCAL_DB_HOSTS_ENV, remoteTargetGate, REMOTE_REFUSED_EXIT, TARGET_ENV } from "./target-guard.mjs";

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
assert.ok(isLocalDbUrl("postgres://pvskill_user:ab/cd@127.0.0.1:5/pv") && isLocalDbUrl("postgres://u:Zq:/?#@%x@127.0.0.1:5/pv"), "a password with / ? # @ % parses (db-url.mjs), CI stress-seed must-fail regression");
assert.ok(!isLocalDbUrl("postgres://u@/db?host=/var/run/postgresql"), "no host is not local (strict)");
assert.ok(!isLocalDbUrl("postgres://u:p@db.railway.internal:5432/db") && !isLocalDbUrl("postgres://u:p@10.1.2.3/db") && !isLocalDbUrl("postgres://u:p@postgres:5432/db") && !isLocalDbUrl("mysql://u@localhost/db") && !isLocalDbUrl("nope"));
pass("isLocalDbUrl (sync): loopback only; passwords with / ? # @ % parse; postgres / private / internal hosts are not loopback");
for (const a of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.17.0.2", "172.31.255.255", "192.168.1.5", "::1", "fd00::1", "fc12::1", "::ffff:172.18.0.3"]) assert.ok(isPrivateAddress(a), a);
for (const a of ["93.184.216.34", "172.15.0.1", "172.32.0.1", "8.8.8.8", "100.64.0.1", "169.254.1.1", "0.0.0.0", "2606:4700::1111", "fe80::1", ""]) assert.ok(!isPrivateAddress(a), a);
pass("isPrivateAddress: loopback, 10/8, 172.16/12 (docker bridges), 192.168/16, ::1, fc00::/7 only");
{
  const PG = "postgres://pcs:madeup-pw@postgres:5432/pcs_v5_verify";
  const PUB = "postgres://pcs:madeup-pw@db.example.com:5432/pv";
  const AL = { [LOCAL_DB_HOSTS_ENV]: "postgres" };
  const look = (map) => async (h) => { if (!(h in map)) throw Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" }); return map[h].map((address) => ({ address })); };
  const dns = look({ postgres: ["172.18.0.2"], "db.example.com": ["93.184.216.34"], "evil-pg": ["10.0.0.5", "93.184.216.34"] });
  const reasonClean = (r) => assert.ok(!/madeup|pcs:|db\.example\.com|postgres:5432/.test(r.reason ?? ""), `reason leaks: ${r.reason}`);
  // control
  assert.deepEqual(await localDbGate(PG, { env: AL, lookup: dns }), { ok: true }, "postgres + allowlist + 172.18.0.2 passes");
  assert.deepEqual(await localDbGate("postgres://u:p@localhost:5432/db", { env: {}, lookup: dns }), { ok: true }, "localhost passes with no allowlist");
  assert.deepEqual(await localDbGate("postgres://u:ab/cd@127.0.0.1:5/pv", { env: {} }), { ok: true }, "127.0.0.1 with a / in the password passes");
  // must-fail
  let r = await localDbGate(PG, { env: {}, lookup: dns }); assert.equal(r.ok, false, "postgres with no allowlist env"); assert.match(r.reason, /not in VERIFY_LOCAL_DB_HOSTS/); reasonClean(r);
  r = await localDbGate(PG, { env: { CI: "true" }, lookup: dns }); assert.equal(r.ok, false, "CI=true is not a bypass");
  r = await localDbGate(PUB, { env: {}, lookup: dns }); assert.equal(r.ok, false, "public DB host, no allowlist"); reasonClean(r);
  r = await localDbGate(PUB, { env: { [LOCAL_DB_HOSTS_ENV]: "postgres,db.example.com" }, lookup: dns }); assert.equal(r.ok, false, "public DB host on the allowlist (resolves public)"); assert.match(r.reason, /non-private/); reasonClean(r);
  r = await localDbGate("postgres://u:p@evil-pg:5432/db", { env: { [LOCAL_DB_HOSTS_ENV]: "evil-pg" }, lookup: dns }); assert.equal(r.ok, false, "allowlisted name with one public address among private ones");
  r = await localDbGate("postgres://u:p@postgres:5432/db", { env: AL, lookup: look({ postgres: ["93.184.216.34"] }) }); assert.equal(r.ok, false, "allowlisted postgres that resolves public"); assert.match(r.reason, /non-private/);
  r = await localDbGate("postgres://u:p@postgres:5432/db", { env: AL, lookup: look({}) }); assert.equal(r.ok, false, "allowlisted name that does not resolve"); assert.match(r.reason, /does not resolve/);
  r = await localDbGate("postgres://u:p@93.184.216.34:5432/db", { env: { [LOCAL_DB_HOSTS_ENV]: "93.184.216.34" }, lookup: async (h) => [{ address: h }] }); assert.equal(r.ok, false, "a public IP literal on the allowlist");
  r = await localDbGate("postgres://u:p@pg2:5432/db", { env: { [LOCAL_DB_HOSTS_ENV]: "postgres" }, lookup: look({ pg2: ["172.18.0.9"] }) }); assert.equal(r.ok, false, "a private name not on the allowlist (no single-label wildcard)");
  r = await localDbGate("mysql://u@postgres/db", { env: AL, lookup: dns }); assert.equal(r.ok, false, "not postgres://");
  pass("localDbGate: control postgres+allowlist(172.18.0.2), localhost, 127.0.0.1 pass; FAIL as required: postgres without allowlist, CI=true, public host with and without allowlist, allowlisted name resolving public (also mixed), unresolvable, public IP literal, unlisted private name, non-postgres; reasons never show the host or userinfo");
}
// The base-URL gate takes no allowlist: a public base URL stays refused whatever VERIFY_LOCAL_DB_HOSTS says.
assert.match(remoteTargetGate({ url: "https://db.example.com", env: { [LOCAL_DB_HOSTS_ENV]: "db.example.com" } }).error, /refused/);
assert.match(remoteTargetGate({ url: "http://postgres:3100", env: { [LOCAL_DB_HOSTS_ENV]: "postgres" } }).error, /refused/);
assert.match(remoteTargetGate({ url: "https://db.example.com" }).error, /refused/);
pass("remoteTargetGate ignores VERIFY_LOCAL_DB_HOSTS: public base URL refused with and without it; the app base URL stays loopback-only");

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
  assert.match(r.stderr, /refused: DATABASE_URL host is not loopback and not in VERIFY_LOCAL_DB_HOSTS .*only against a local DB/);
  assert.doesNotMatch(r.stderr, /db\.example\.invalid|madeup/, "the DB host/password is not printed");
  pass(`${f} with a remote DATABASE_URL: refused (exit 2), host not printed`);
}
// The CI shape: DATABASE_URL on the service hostname `postgres`. No allowlist → refused with 0 network events; with
// VERIFY_LOCAL_DB_HOSTS=postgres under the blocker the only event is the blocked DNS lookup of that name (it cannot
// resolve here), so it is refused too and nothing connects.
for (const [f, extra] of TOOLS.filter(([f]) => /job-confirm|stress-seed/.test(f))) {
  const DBU = "postgres://pcs:madeup-pw@postgres:5432/pcs_v5_verify";
  const log1 = path.join(tmp, `toolpg-${++n}.jsonl`);
  const env1 = { ...process.env, PV_NETLOG: log1, DATABASE_URL: DBU };
  delete env1[LOCAL_DB_HOSTS_ENV];
  const r1 = spawnSync(process.execPath, ["--require", preload, tool(f), "--url", "http://127.0.0.1:1", ...extra], { env: env1, encoding: "utf8", timeout: 60000 });
  assert.equal(r1.status, 2, `${f} postgres host, no allowlist: exit ${r1.status} ${r1.stderr.slice(0, 200)}`);
  assert.match(r1.stderr, /not in VERIFY_LOCAL_DB_HOSTS/);
  assert.equal(existsSync(log1) ? readFileSync(log1, "utf8").trim() : "", "", `${f}: network events with no allowlist`);
  const log2 = path.join(tmp, `toolpg-${++n}.jsonl`);
  const r2 = spawnSync(process.execPath, ["--require", preload, tool(f), "--url", "http://127.0.0.1:1", ...extra], { env: { ...process.env, PV_NETLOG: log2, DATABASE_URL: "postgres://pcs:madeup-pw@db.example.invalid:5432/pv", [LOCAL_DB_HOSTS_ENV]: "db.example.invalid" }, encoding: "utf8", timeout: 60000 });
  assert.equal(r2.status, 2, `${f} allowlisted public-or-unresolvable host: exit ${r2.status} ${r2.stderr.slice(0, 200)}`);
  const ev2 = existsSync(log2) ? readFileSync(log2, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
  assert.ok(ev2.every((e) => e.kind === "dns" || /lookup/.test(String(e.kind))), `${f}: only a DNS lookup may be attempted: ${JSON.stringify(ev2)}`);
  assert.doesNotMatch(r2.stderr, /db\.example\.invalid|madeup/);
  pass(`${f}: DATABASE_URL on host postgres with no allowlist → exit 2, 0 network events; an allowlisted name that does not resolve to a private address → exit 2, nothing connects`);
}
rmSync(tmp, { recursive: true, force: true });
console.log(lines.join("\n"));
console.log(`target-guard: ${lines.length} cases OK (${path.relative(here, verify) || "verify.mjs"})`);

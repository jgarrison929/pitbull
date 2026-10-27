// Preload (`node --require`) for target-guard.test.mjs: records and BLOCKS every network attempt to a non-local host
// before DNS or connect, and records/blocks every browser launch. Writes one JSON line per event to $PV_NETLOG.
const fs = require("node:fs");
const net = require("node:net");
const tls = require("node:tls");
const dns = require("node:dns");
const http = require("node:http");
const https = require("node:https");
const cp = require("node:child_process");
const LOG = process.env.PV_NETLOG;
const local = (h) => { const x = String(h ?? "").toLowerCase().replace(/^\[|\]$/g, ""); return x === "localhost" || x.endsWith(".localhost") || x === "::1" || /^127(\.\d{1,3}){3}$/.test(x) || x === ""; };
const note = (e) => { if (LOG) fs.appendFileSync(LOG, JSON.stringify({ pid: process.pid, ...e }) + "\n"); };
const block = (kind, host) => { note({ kind, host, blocked: !local(host) }); if (!local(host)) { const err = new Error(`net-block: ${kind} to ${host} blocked`); err.code = "ENETBLOCKED"; throw err; } };
const hostOf = (a) => { if (!a) return ""; if (typeof a === "string") { try { return new URL(a).hostname; } catch { return a; } } if (a instanceof URL) return a.hostname; return a.hostname ?? a.host ?? ""; };
const realFetch = globalThis.fetch;
globalThis.fetch = function (input, init) { block("fetch", hostOf(typeof input === "object" && input && "url" in input ? input.url : input)); return realFetch.call(this, input, init); };
const realLookup = dns.lookup; dns.lookup = function (h, ...r) { block("dns.lookup", h); return realLookup.call(this, h, ...r); };
const realPLookup = dns.promises.lookup; dns.promises.lookup = function (h, ...r) { block("dns.promises.lookup", h); return realPLookup.call(this, h, ...r); };
const realSockConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...a) { const o = a[0]; if (o && typeof o === "object" && !o.path) block("socket.connect", o.host ?? "localhost"); else if (typeof o === "number") block("socket.connect", a[1] ?? "localhost"); return realSockConnect.apply(this, a); };
const realTls = tls.connect; tls.connect = function (...a) { const o = typeof a[0] === "object" ? a[0] : { host: a[1] }; block("tls.connect", o.host ?? o.servername ?? "localhost"); return realTls.apply(this, a); };
for (const [name, mod] of [["http", http], ["https", https]]) for (const fn of ["request", "get"]) { const real = mod[fn]; mod[fn] = function (u, ...r) { block(`${name}.${fn}`, hostOf(u)); return real.call(this, u, ...r); }; }
const BROWSER = /chrom|headless_shell|firefox|webkit|msedge/i;
for (const fn of ["spawn", "execFile"]) { const real = cp[fn]; cp[fn] = function (file, ...r) { if (BROWSER.test(String(file))) { note({ kind: `browser.${fn}`, file: String(file).slice(-60), blocked: true }); throw new Error(`net-block: browser launch blocked (${file})`); } return real.call(this, file, ...r); }; }
require("node:module").syncBuiltinESMExports();

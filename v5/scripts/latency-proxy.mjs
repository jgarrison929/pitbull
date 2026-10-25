#!/usr/bin/env node
/**
 * TCP proxy: add LATENCY_MS before each client→server write (approx one RTT
 * contribution per postgres message / query).
 *
 * Usage:
 *   LATENCY_MS=3 LISTEN_PORT=65432 TARGET=127.0.0.1:5432 node scripts/latency-proxy.mjs
 */
import net from "node:net";

const latencyMs = Number(process.env.LATENCY_MS ?? 3);
const listenPort = Number(process.env.LISTEN_PORT ?? 65432);
const [targetHost, targetPortStr] = (process.env.TARGET ?? "127.0.0.1:5432").split(
  ":",
);
const targetPort = Number(targetPortStr ?? 5432);

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function pipeDelayed(src, dest) {
  let chain = Promise.resolve();
  src.on("data", (chunk) => {
    chain = chain.then(async () => {
      await delay(latencyMs);
      if (!dest.destroyed) dest.write(chunk);
    });
  });
  src.on("end", () => {
    chain = chain.then(() => {
      if (!dest.destroyed) dest.end();
    });
  });
  src.on("error", () => dest.destroy());
}

const server = net.createServer((client) => {
  const upstream = net.connect({ host: targetHost, port: targetPort }, () => {
    // Delay client→server (query path). Server→client is immediate so total
    // added RTT ≈ LATENCY_MS per query message.
    pipeDelayed(client, upstream);
    upstream.pipe(client);
  });
  upstream.on("error", () => client.destroy());
  client.on("error", () => upstream.destroy());
});

server.listen(listenPort, "127.0.0.1", () => {
  console.log(
    JSON.stringify({
      listen: `127.0.0.1:${listenPort}`,
      target: `${targetHost}:${targetPort}`,
      latencyMs,
    }),
  );
});

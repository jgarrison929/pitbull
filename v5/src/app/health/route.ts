import { connection } from "next/server";
import {
  classifyDatabaseUrl,
  databaseConnectionString,
  dbPing,
} from "@/db";
import { getDeployStatus } from "@/lib/deploy-status";
import { checkHealth } from "@/lib/health";

/**
 * /health must never 500 or log credentials when DATABASE_URL has special-char
 * passwords. A degraded / unreachable DB still returns **503** (Railway
 * healthcheck). Unparseable but set DATABASE_URL is degraded/error — never
 * ok/not-configured.
 */
export async function GET() {
  await connection();
  const dbNetwork = classifyDatabaseUrl();
  try {
    const url = process.env.DATABASE_URL;
    if (url && !databaseConnectionString(url)) {
      // Set but broken — do not hide as not-configured.
      const deploy = await getDeployStatus();
      return Response.json(
        {
          status: "degraded",
          db: "error",
          ...deploy,
          dbNetwork,
        },
        { status: 503, headers: { "cache-control": "no-store" } },
      );
    }

    const [health, deploy] = await Promise.all([
      checkHealth(dbPing()),
      getDeployStatus(),
    ]);
    return Response.json(
      { ...health, ...deploy, dbNetwork },
      {
        status: health.status === "ok" ? 200 : 503,
        headers: { "cache-control": "no-store" },
      },
    );
  } catch (err) {
    // Last resort: never surface connection-string text (Invalid URL.input).
    const msg = err instanceof Error ? err.message : "health check failed";
    const safe = msg.replace(/postgres(ql)?:\/\/\S+/gi, "postgres://[redacted]");
    console.error(`[health] ${safe}`);
    return Response.json(
      {
        status: "degraded",
        db: process.env.DATABASE_URL ? "error" : "not-configured",
        dbNetwork,
      },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}

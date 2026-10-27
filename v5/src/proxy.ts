import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import postgres from "postgres";
import { databaseConnectionString } from "@/db/database-url";
import { PROXY_DB_POOL_MAX } from "@/db/pool-config";
import { isErrorProbeAllowed } from "@/lib/error-probe";
import { parseJobDrillPath } from "@/lib/job-drill-path";
import { isUuid } from "@/lib/uuid";

const SESSION_COOKIE = "pcs_session";
const ERROR_PROBE_PATH = "/app/error-probe";

/**
 * Shared pool for drill-down 404 checks. Opening+closing a connection on every
 * /app/jobs/* request paid a full TCP handshake before the page could start —
 * ~37 ms p50 even with only 3 ms RTT. Keep the pool warm for the process life.
 *
 * Always open with `databaseConnectionString` — raw env URLs with `/` in the
 * password throw Invalid URL and Next logs the full DATABASE_URL (Verify FAIL).
 */
let sql: ReturnType<typeof postgres> | null = null;
let sqlConnectionString: string | null = null;

/** Tests only — drop the warm proxy pool between cases. */
export async function resetProxySqlForTests() {
  if (sql) {
    await sql.end({ timeout: 5 }).catch(() => {});
  }
  sql = null;
  sqlConnectionString = null;
}

function proxySql(rawDatabaseUrl: string) {
  const connectionString = databaseConnectionString(rawDatabaseUrl);
  if (!connectionString) {
    // Never pass the raw URL to postgres.js (password lands in error.input).
    throw new Error("database unavailable");
  }
  // idle_timeout: 0 — do not drop the pool between Verify crawls; reconnect
  // cost on Railway (even private) dwarfs the 404 lookup itself.
  if (!sql || sqlConnectionString !== connectionString) {
    sql = postgres(connectionString, {
      max: PROXY_DB_POOL_MAX,
      idle_timeout: 0,
      max_lifetime: 60 * 30,
      connect_timeout: 10,
    });
    sqlConnectionString = connectionString;
  }
  return sql;
}

function withServerTiming(res: NextResponse, proxyMs: number) {
  // Append — never overwrite other Server-Timing metrics from the app.
  // Job/cost/plan drills: only emit v5proxy;dur=… (no other metric names).
  const prior = res.headers.get("Server-Timing");
  const metric = `v5proxy;dur=${Math.round(proxyMs * 100) / 100}`;
  res.headers.set(
    "Server-Timing",
    prior ? `${prior}, ${metric}` : metric,
  );
  res.headers.set("x-v5-proxy-ms", String(Math.round(proxyMs)));
  return res;
}

/**
 * Paths that must be HTTP 404 before the app shell streams. Under Cache
 * Components, Suspense boundaries commit 200 before page-level notFound() can
 * run, so the check happens here.
 *
 * Covers:
 * - /app/error-probe when V5_ERROR_PROBE is unset (e2e-only probe)
 * - /app/jobs/:number
 * - /app/jobs/:number/changes
 * - /app/jobs/:number/cost-items/:code  (not …/search)
 * - /app/jobs/:number/plans/:id
 */
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Dev/e2e probe — unreachable in production builds (flag off → real 404).
  if (path === ERROR_PROBE_PATH) {
    if (!isErrorProbeAllowed()) return notFoundResponse();
    return NextResponse.next();
  }

  const parsed = parseJobDrillPath(path);
  if (!parsed) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.next(); // requireUser will send them to /login

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return NextResponse.next();

  if (parsed.kind === "plan" && !isUuid(parsed.planId)) {
    return notFoundResponse();
  }

  const sessionId = createHash("sha256").update(token).digest("hex");
  const db = proxySql(databaseUrl);
  const t0 = performance.now();
  try {
    if (parsed.kind === "plan") {
      // One round-trip for plan drills: session + job + plan (was session⋈job
      // then a second plan select — two serial RTTs on every plan navigation).
      const rows = await db<{ job_id: string; plan_id: string | null }[]>`
        select j.id as job_id, p.id as plan_id
        from sessions s
        inner join jobs j on j.company_id = s.company_id
        left join daily_plans p
          on p.job_id = j.id
         and p.id = ${parsed.planId}::uuid
        where s.id = ${sessionId}
          and s.expires_at > now()
          and j.number = ${parsed.number}
        limit 1`;
      const row = rows[0];
      if (!row) {
        const sessions = await db<{ company_id: string }[]>`
          select company_id from sessions
          where id = ${sessionId} and expires_at > now()
          limit 1`;
        if (!sessions[0]) {
          return withServerTiming(NextResponse.next(), performance.now() - t0);
        }
        return withServerTiming(notFoundResponse(), performance.now() - t0);
      }
      if (!row.plan_id) {
        return withServerTiming(notFoundResponse(), performance.now() - t0);
      }
      return withServerTiming(NextResponse.next(), performance.now() - t0);
    }

    // One round-trip: session + job (was two serial queries after a fresh connect).
    const rows = await db<{ job_id: string }[]>`
      select j.id as job_id
      from sessions s
      inner join jobs j on j.company_id = s.company_id
      where s.id = ${sessionId}
        and s.expires_at > now()
        and j.number = ${parsed.number}
      limit 1`;
    const jobId = rows[0]?.job_id;
    if (!jobId) {
      // Distinguish unknown job (404) from missing/expired session (fall through).
      const sessions = await db<{ company_id: string }[]>`
        select company_id from sessions
        where id = ${sessionId} and expires_at > now()
        limit 1`;
      if (!sessions[0]) {
        return withServerTiming(NextResponse.next(), performance.now() - t0);
      }
      return withServerTiming(notFoundResponse(), performance.now() - t0);
    }

    if (parsed.kind === "job" || parsed.kind === "changes") {
      return withServerTiming(NextResponse.next(), performance.now() - t0);
    }

    if (parsed.kind === "cost-item") {
      const items = await db<{ id: string }[]>`
        select id from cost_items
        where job_id = ${jobId}
          and code = ${parsed.code}
          and is_leaf = true
        limit 1`;
      if (items.length === 0) {
        return withServerTiming(notFoundResponse(), performance.now() - t0);
      }
      return withServerTiming(NextResponse.next(), performance.now() - t0);
    }

    return withServerTiming(NextResponse.next(), performance.now() - t0);
  } catch {
    return withServerTiming(NextResponse.next(), performance.now() - t0);
  }
}

export const config = {
  matcher: [
    "/app/error-probe",
    "/app/jobs/:number",
    "/app/jobs/:number/changes",
    "/app/jobs/:number/cost-items/:code",
    "/app/jobs/:number/plans/:id",
  ],
};

function notFoundResponse() {
  return new NextResponse(notFoundHtml(), {
    status: 404,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function notFoundHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><title>404 · Pitbull</title></head>
<body>
  <h1>404</h1>
  <p>This page could not be found.</p>
</body>
</html>`;
}

import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import postgres from "postgres";
import { databaseConnectionString } from "@/db/database-url";
import { PROXY_DB_POOL_MAX } from "@/db/pool-config";
import { parseJobDrillPath } from "@/lib/job-drill-path";
import { isUuid } from "@/lib/uuid";

const SESSION_COOKIE = "pcs_session";

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

/**
 * Unknown / invalid drill-down paths must be HTTP 404. Under Cache Components the
 * app shell Suspense boundaries commit 200 before page-level notFound() can run,
 * so the check happens here before the page streams.
 *
 * Covers:
 * - /app/jobs/:number
 * - /app/jobs/:number/changes
 * - /app/jobs/:number/cost-items/:code  (not …/search)
 * - /app/jobs/:number/plans/:id
 */
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
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
  try {
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
      if (!sessions[0]) return NextResponse.next();
      return notFoundResponse();
    }

    if (parsed.kind === "job" || parsed.kind === "changes") {
      return NextResponse.next();
    }

    if (parsed.kind === "cost-item") {
      const items = await db<{ id: string }[]>`
        select id from cost_items
        where job_id = ${jobId}
          and code = ${parsed.code}
          and is_leaf = true
        limit 1`;
      if (items.length === 0) return notFoundResponse();
      return NextResponse.next();
    }

    // plan
    const plans = await db<{ id: string }[]>`
      select id from daily_plans
      where job_id = ${jobId}
        and id = ${parsed.planId}::uuid
      limit 1`;
    if (plans.length === 0) return notFoundResponse();
    return NextResponse.next();
  } catch {
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
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

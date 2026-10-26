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

function withServerTiming(res: NextResponse, proxyMs: number) {
  // Append — never overwrite other Server-Timing metrics from the app.
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

  // Prefetch / PPR segment flights re-hit this matcher and stampede the proxy
  // pool under crawl bursts (Verify #60: v5proxy tails to 440 ms). Document
  // navigations and soft navigations still run the 404 check.
  if (
    request.headers.get("Next-Router-Prefetch") === "1" ||
    request.headers.get("Next-Router-Segment-Prefetch") === "1" ||
    request.headers.get("Purpose") === "prefetch" ||
    request.headers.get("Sec-Purpose") === "prefetch"
  ) {
    return NextResponse.next();
  }

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
<<<<<<< HEAD
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
=======
    if (parsed.kind === "cost-item") {
      // One round-trip: session + job + leaf cost item (was session⋈job then
      // a second cost_items select — two serial RTTs on every cost-item nav).
      const rows = await db<
        { job_id: string; item_id: string | null }[]
      >`
        select j.id as job_id, ci.id as item_id
        from sessions s
        inner join jobs j on j.company_id = s.company_id
        left join cost_items ci
          on ci.job_id = j.id
         and ci.code = ${parsed.code}
         and ci.is_leaf = true
>>>>>>> 5842cf8 (perf(v5): cut cost-item TTFB tail under crawl burst)
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
<<<<<<< HEAD
        if (!sessions[0]) return NextResponse.next();
        return notFoundResponse();
      }
      if (!row.plan_id) return notFoundResponse();
      return NextResponse.next();
=======
        if (!sessions[0]) {
          return withServerTiming(NextResponse.next(), performance.now() - t0);
        }
        return withServerTiming(notFoundResponse(), performance.now() - t0);
      }
      if (!row.item_id) {
        return withServerTiming(notFoundResponse(), performance.now() - t0);
      }
      return withServerTiming(NextResponse.next(), performance.now() - t0);
>>>>>>> 5842cf8 (perf(v5): cut cost-item TTFB tail under crawl burst)
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

    // plan — kept as a follow-up select here so this PR does not dual-write
    // the plan one-query fold owned by #59. After #59 merges, rebase folds both.
    if (parsed.kind === "plan") {
      const plans = await db<{ id: string }[]>`
        select id from daily_plans
        where job_id = ${jobId}
          and id = ${parsed.planId}::uuid
        limit 1`;
      if (plans.length === 0) {
        return withServerTiming(notFoundResponse(), performance.now() - t0);
      }
      return withServerTiming(NextResponse.next(), performance.now() - t0);
    }

<<<<<<< HEAD
    return NextResponse.next();
=======
    return withServerTiming(NextResponse.next(), performance.now() - t0);
>>>>>>> 5842cf8 (perf(v5): cut cost-item TTFB tail under crawl burst)
  } catch {
    return withServerTiming(NextResponse.next(), performance.now() - t0);
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

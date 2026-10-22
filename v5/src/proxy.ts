import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import postgres from "postgres";

const SESSION_COOKIE = "pcs_session";

/**
 * Unknown job numbers must be HTTP 404. Under Cache Components the app shell
 * Suspense boundaries commit 200 before page-level notFound() can run, so the
 * check happens here before the page streams.
 */
export async function proxy(request: NextRequest) {
  const match = request.nextUrl.pathname.match(/^\/app\/jobs\/([^/]+)\/?$/);
  if (!match) return NextResponse.next();

  const number = decodeURIComponent(match[1] ?? "");
  if (!number) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.next(); // requireUser will send them to /login

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return NextResponse.next();

  const sessionId = createHash("sha256").update(token).digest("hex");
  const sql = postgres(databaseUrl, { max: 1, idle_timeout: 5, connect_timeout: 5 });
  try {
    const rows = await sql<{ company_id: string }[]>`
      select company_id from sessions
      where id = ${sessionId} and expires_at > now()
      limit 1`;
    const companyId = rows[0]?.company_id;
    if (!companyId) return NextResponse.next();

    const jobs = await sql<{ id: string }[]>`
      select id from jobs
      where company_id = ${companyId} and number = ${number}
      limit 1`;
    if (jobs.length > 0) return NextResponse.next();

    return new NextResponse(notFoundHtml(), {
      status: 404,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch {
    return NextResponse.next();
  } finally {
    await sql.end({ timeout: 1 });
  }
}

export const config = {
  matcher: ["/app/jobs/:number"],
};

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

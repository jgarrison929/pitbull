import { connection } from "next/server";
import { writeLastVerifyAt } from "@/lib/last-verify";
import { resolveVerifyToken } from "@/lib/verify-token";

/**
 * verify-v5 posts here after a successful run so /status can show last-verify.
 * Authorization: Bearer $VERIFY_TOKEN (must be set on the deploy).
 */
export async function POST(req: Request) {
  await connection();
  const expected = resolveVerifyToken();
  if (!expected) {
    return Response.json(
      { error: "VERIFY_TOKEN is not configured" },
      { status: 503 },
    );
  }
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token || token !== expected) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { at?: string; commit?: string };
  try {
    body = (await req.json()) as { at?: string; commit?: string };
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const commit = (body.commit ?? "").trim();
  if (!commit) {
    return Response.json({ error: "commit required" }, { status: 400 });
  }
  const at = body.at ? new Date(body.at) : new Date();
  if (!Number.isFinite(at.getTime())) {
    return Response.json({ error: "invalid at" }, { status: 400 });
  }

  try {
    const lastVerifyAt = await writeLastVerifyAt(at, commit);
    return Response.json({ ok: true, lastVerifyAt, commit: commit.slice(0, 12) });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "stamp failed" },
      { status: 500 },
    );
  }
}

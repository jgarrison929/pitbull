import { connection } from "next/server";
import { getBuildInfo } from "@/lib/build-info";
import { writeLastVerifyAt } from "@/lib/last-verify";
import {
  commitsMatchDeployed,
  isFullCommitSha,
  stampTimestampRejectReason,
} from "@/lib/stamp-guards";
import { tokensEqual } from "@/lib/tokens-equal";
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
  if (!token || !tokensEqual(token, expected)) {
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
  if (!isFullCommitSha(commit)) {
    return Response.json(
      { error: "commit must be a full 40-character SHA" },
      { status: 400 },
    );
  }

  const deployed = getBuildInfo().commit;
  if (!commitsMatchDeployed(commit, deployed)) {
    return Response.json(
      {
        error: "commit does not match deployed commit",
        deployed,
      },
      { status: 400 },
    );
  }

  const at = body.at ? new Date(body.at) : new Date();
  const atReject = stampTimestampRejectReason(at);
  if (atReject) {
    return Response.json({ error: atReject }, { status: 400 });
  }

  try {
    const lastVerifyAt = await writeLastVerifyAt(at, commit);
    return Response.json({ ok: true, lastVerifyAt, commit });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "stamp failed" },
      { status: 500 },
    );
  }
}

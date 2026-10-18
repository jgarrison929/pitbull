import { connection } from "next/server";
import { dbPing } from "@/db";
import { getBuildInfo } from "@/lib/build-info";
import { checkHealth } from "@/lib/health";

export async function GET() {
  await connection();
  const health = await checkHealth(dbPing());
  return Response.json(
    { ...health, ...getBuildInfo() },
    { status: health.status === "ok" ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}

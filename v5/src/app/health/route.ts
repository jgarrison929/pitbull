import { connection } from "next/server";
import { dbPing } from "@/db";
import { getDeployStatus } from "@/lib/deploy-status";
import { checkHealth } from "@/lib/health";

export async function GET() {
  await connection();
  const [health, deploy] = await Promise.all([
    checkHealth(dbPing()),
    getDeployStatus(),
  ]);
  return Response.json(
    { ...health, ...deploy },
    {
      status: health.status === "ok" ? 200 : 503,
      headers: { "cache-control": "no-store" },
    },
  );
}

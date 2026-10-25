import { connection } from "next/server";
import { classifyDatabaseUrl, dbPing } from "@/db";
import { getDeployStatus } from "@/lib/deploy-status";
import { checkHealth } from "@/lib/health";

export async function GET() {
  await connection();
  const [health, deploy] = await Promise.all([
    checkHealth(dbPing()),
    getDeployStatus(),
  ]);
  // Host only — no credentials. Flags whether staging is on private Railway
  // networking vs the public TCP proxy (DATABASE_PUBLIC_URL).
  const dbNetwork = classifyDatabaseUrl();
  return Response.json(
    { ...health, ...deploy, dbNetwork },
    {
      status: health.status === "ok" ? 200 : 503,
      headers: { "cache-control": "no-store" },
    },
  );
}

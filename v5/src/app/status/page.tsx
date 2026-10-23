import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { dbPing } from "@/db";
import { getDeployStatus } from "@/lib/deploy-status";
import { checkHealth } from "@/lib/health";

export const metadata: Metadata = { title: "Status · Pitbull" };

export default function StatusPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 px-6 py-16">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Pitbull status</CardTitle>
          <CardDescription>
            Build, CI gate, last verify, and database health for this deployment.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<p className="text-sm text-muted-foreground">Checking…</p>}>
            <StatusDetails />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}

function ciLabel(v: string) {
  if (v === "pass") return "pass";
  if (v === "fail") return "fail";
  if (v === "pending") return "pending";
  return "unknown";
}

async function StatusDetails() {
  await connection();
  const [deploy, health] = await Promise.all([
    getDeployStatus(),
    checkHealth(dbPing()),
  ]);
  const ciGateValue = (() => {
    const label = ciLabel(deploy.ciGate);
    if (!deploy.ciGateStale) return label;
    const age =
      deploy.ciGateAgeMs == null
        ? "stale"
        : `stale ${Math.round(deploy.ciGateAgeMs / 1000)}s`;
    return `${label} (${age})`;
  })();
  const rows: [string, string, string][] = [
    ["Version", deploy.version, "status-version"],
    ["Commit", deploy.commit, "status-commit"],
    ["CI gate", ciGateValue, "status-ci-gate"],
    [
      "Last verify",
      deploy.lastVerifyAt ?? "not recorded",
      "status-last-verify",
    ],
    ["Built", deploy.buildTime, "status-built"],
    ["Database", health.db, "status-database"],
  ];
  return (
    <div className="flex flex-col gap-4">
      <Badge
        variant={health.status === "ok" ? "default" : "destructive"}
        data-testid="health-status"
      >
        {health.status === "ok" ? "Operational" : "Degraded"}
      </Badge>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        {rows.map(([label, value, testId]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-mono" data-testid={testId}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

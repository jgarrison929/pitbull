import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { PageHeader } from "@/components/app/page";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { dbPing } from "@/db";
import { formatMigrationsLabel } from "@/lib/applied-migrations";
import { getDeployStatus } from "@/lib/deploy-status";
import { checkHealth } from "@/lib/health";
import { formatLastVerify } from "@/lib/last-verify-format";

export const metadata: Metadata = { title: "Status · Pitbull" };

export default function StatusPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 px-6 py-16">
      <PageHeader
        title="Status"
        purpose="Which build is live, and whether its checks passed."
      />
      <Card>
        <CardContent className="pt-6">
          <Suspense fallback={<p className="text-sm text-muted-foreground">Checking…</p>}>
            <StatusDetails />
          </Suspense>
          <p className="mt-4 text-sm text-muted-foreground">
            <Link href="/roadmap" className="underline hover:no-underline">
              Roadmap
            </Link>
            {" · "}
            <Link href="/changelog" className="underline hover:no-underline">
              Changelog
            </Link>
          </p>
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
  const migrationsLabel = formatMigrationsLabel(deploy.migrations);
  const rows: [string, string, string][] = [
    ["Version", deploy.version, "status-version"],
    ["Commit", deploy.commit, "status-commit"],
    ["CI gate", ciGateValue, "status-ci-gate"],
    [
      "Last verify",
      formatLastVerify(deploy.lastVerifyAt, deploy.lastVerifyCommit),
      "status-last-verify",
    ],
    ["Built", deploy.buildTime, "status-built"],
    ["Database", health.db, "status-database"],
    ["Migrations", migrationsLabel, "status-migrations"],
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
            <dd className="font-mono break-all" data-testid={testId}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

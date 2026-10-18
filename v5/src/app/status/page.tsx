import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { dbPing } from "@/db";
import { getBuildInfo } from "@/lib/build-info";
import { checkHealth } from "@/lib/health";

export const metadata: Metadata = { title: "Status · Pitbull" };

export default function StatusPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 px-6 py-16">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Pitbull status</CardTitle>
          <CardDescription>Build and service health for this deployment.</CardDescription>
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

async function StatusDetails() {
  await connection();
  const build = getBuildInfo();
  const health = await checkHealth(dbPing());
  const rows: [string, string][] = [
    ["Version", build.version],
    ["Commit", build.commit],
    ["Built", build.buildTime],
    ["Database", health.db],
  ];
  return (
    <div className="flex flex-col gap-4">
      <Badge variant={health.status === "ok" ? "default" : "destructive"} data-testid="health-status">
        {health.status === "ok" ? "Operational" : "Degraded"}
      </Badge>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-mono" data-testid={`status-${label.toLowerCase()}`}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

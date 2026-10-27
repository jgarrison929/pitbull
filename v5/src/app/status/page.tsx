import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { MetricCard } from "@/components/app/metric-card";
import { PageHeader } from "@/components/app/page";
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
      <Suspense
        fallback={
          <p className="text-body text-muted-foreground">Checking…</p>
        }
      >
        <StatusDetails />
      </Suspense>
      <p className="text-body text-muted-foreground">
        <a
          href="/roadmap"
          className="tap-target inline-flex min-h-11 min-w-11 items-center underline hover:no-underline"
        >
          Roadmap
        </a>
        {" · "}
        <a
          href="/changelog"
          className="tap-target inline-flex min-h-11 min-w-11 items-center underline hover:no-underline"
        >
          Changelog
        </a>
      </p>
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
  const operational = health.status === "ok";
  const lastVerify = formatLastVerify(
    deploy.lastVerifyAt,
    deploy.lastVerifyCommit,
  );

  return (
    <div className="card-stack grid grid-cols-1 sm:grid-cols-2">
      <MetricCard
        label="Health"
        value={operational ? "Operational" : "Degraded"}
        secondary={[
          <span key="db" className="break-all">
            Database {health.db}
          </span>,
          <span key="mig" className="break-all">
            Migrations {migrationsLabel}
          </span>,
        ]}
        testId="health-status"
      />
      <MetricCard
        label="Version"
        value={deploy.version}
        secondary={[
          <span
            key="commit"
            data-clip="secondary"
            title={`Commit ${deploy.commit}`}
            className="block max-w-full truncate max-[639px]:max-w-[16rem] sm:max-w-[12rem]"
          >
            Commit {deploy.commit}
          </span>,
          `CI gate ${ciGateValue}`,
        ]}
        testId="status-version"
      />
      <MetricCard
        className="sm:col-span-2"
        label="Last verify"
        value={
          <span className="block max-w-full break-all text-body font-semibold tracking-normal">
            {lastVerify}
          </span>
        }
        secondary={[`Built ${deploy.buildTime}`]}
        testId="status-last-verify"
      />
      <dl className="sr-only">
        <div>
          <dt>Commit</dt>
          <dd data-testid="status-commit">{deploy.commit}</dd>
        </div>
        <div>
          <dt>CI gate</dt>
          <dd data-testid="status-ci-gate">{ciGateValue}</dd>
        </div>
        <div>
          <dt>Built</dt>
          <dd data-testid="status-built">{deploy.buildTime}</dd>
        </div>
        <div>
          <dt>Database</dt>
          <dd data-testid="status-database">{health.db}</dd>
        </div>
        <div>
          <dt>Migrations</dt>
          <dd data-testid="status-migrations">{migrationsLabel}</dd>
        </div>
      </dl>
    </div>
  );
}

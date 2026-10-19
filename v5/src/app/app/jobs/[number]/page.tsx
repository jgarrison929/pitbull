import { Suspense } from "react";
import { notFound } from "next/navigation";
import { CostTable } from "@/components/app/cost-table";
import { HealthPill, IndexValue, Money } from "@/components/app/format";
import { Kpi, KpiStrip, PageHeader, Section } from "@/components/app/page";
import { DataSource } from "@/components/app/shell";
import { PlanCard } from "@/components/app/plan-card";
import { pct, usdShort } from "@/lib/ev";
import { getJob, getPlansForJob } from "@/server/data";
import { requireUser } from "@/server/session";
import { runAction } from "@/app/app/assistant/actions";
import { actions, jobChanges } from "@/server/assistant/actions";
import { LocalTime } from "@/components/app/local-time";

export default function JobPage({ params }: PageProps<"/app/jobs/[number]">) {
  return (
    <Suspense
      fallback={
        <div
          className="h-96 animate-pulse rounded-lg bg-muted"
          aria-busy="true"
        />
      }
    >
      <Job params={params} />
    </Suspense>
  );
}

async function Job({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const user = await requireUser();
  const p = await getJob(user.companyId, number);
  if (!p) notFound();
  const [plans, changes] = await Promise.all([
    getPlansForJob(user.companyId, p.job.id),
    jobChanges(user.companyId, p.job.number),
  ]);
  return (
    <>
      <PageHeader
        title={p.job.name}
        meta={`${p.job.number} · ${p.job.owner} · PM ${p.job.pmName} · finish ${new Date(`${p.job.finishOn}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })}`}
        actions={<HealthPill value={p.status} />}
      />
      <KpiStrip>
        <Kpi
          label="Earned to date"
          value={<Money cents={p.earnedCents} />}
          sub={`${pct(p.percent)} of ${usdShort(p.budgetCents)} budget`}
        />
        <Kpi
          label="Actual cost"
          value={<Money cents={p.actualCents} />}
          sub={
            <>
              variance <Money cents={p.costVarianceCents} signed />
            </>
          }
        />
        <Kpi
          label="CPI"
          value={<IndexValue value={p.cpi} />}
          sub={`EAC ${usdShort(p.eacCents)}`}
          testId="job-cpi"
        />
        <Kpi
          label="SPI"
          value={<IndexValue value={p.spi} />}
          sub={`vs ${usdShort(p.plannedCents)} planned`}
        />
      </KpiStrip>
      {plans.map((plan) => (
        <PlanCard
          key={plan.id}
          plan={plan}
          actions={
            plan.status === "draft" &&
            actions["dailyPlan.submit"].roles?.includes(user.role) ? (
              <form action={runAction}>
                <input type="hidden" name="action" value="dailyPlan.submit" />
                <input type="hidden" name="job" value={p.job.number} />
                <input type="hidden" name="label" value="Submit plan" />
                <button
                  type="submit"
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                  data-testid="submit-plan"
                >
                  Submit plan
                </button>
              </form>
            ) : undefined
          }
        />
      ))}
      <Section
        title="Budget vs earned value by cost code"
        meta="Rows under CPI 0.80 are tinted"
      >
        <CostTable lines={p.lines} />
      </Section>
      <Section
        title="Changes on this job"
        meta="Every change, by anyone in this sandbox"
      >
        {changes.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">
            No changes yet.
          </p>
        ) : (
          <ul className="divide-y px-4 text-sm" data-testid="job-changes">
            {changes.map((c) => (
              <li key={c.id} className="py-2">
                <span className="font-medium">{c.userName}</span> · {c.summary}{" "}
                <span className="text-xs text-muted-foreground">
                  <LocalTime iso={c.createdAt} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <DataSource />
    </>
  );
}

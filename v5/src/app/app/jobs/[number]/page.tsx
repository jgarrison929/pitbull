import { Suspense } from "react";
import { notFound } from "next/navigation";
import { CostTable } from "@/components/app/cost-table";
import { Money, StatusIndex, StatusPill } from "@/components/app/format";
import { Kpi, KpiStrip, PageHeader, Section } from "@/components/app/page";
import { DataSource } from "@/components/app/shell";
import { PlanCard } from "@/components/app/plan-card";
import { pct, usdShort } from "@/lib/ev";
import { getJob, getPlansForJob } from "@/server/data";
import { requireUser } from "@/server/session";
import { runAction } from "@/app/app/assistant/actions";
import { actions } from "@/server/assistant/actions";

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
  const plans = await getPlansForJob(user.companyId, p.job.id);
  return (
    <>
      <PageHeader
        title={p.job.name}
        meta={`${p.job.number} · ${p.job.owner} · PM ${p.job.pmName} · finish ${new Date(`${p.job.finishOn}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })}`}
        actions={
          <StatusPill value={p.status} varianceCents={p.costVarianceCents} />
        }
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
          sub={`vs ${usdShort(p.earnedCents)} earned`}
        />
        <Kpi
          label="CPI"
          value={
            <StatusIndex index={p.cpi} varianceCents={p.costVarianceCents} />
          }
          sub={`cost variance · EAC ${usdShort(p.eacCents)}`}
          testId="job-cpi"
        />
        <Kpi
          label="SPI"
          value={
            <StatusIndex
              index={p.spi}
              varianceCents={p.scheduleVarianceCents}
            />
          }
          sub={`schedule variance · ${usdShort(p.plannedCents)} planned`}
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
        meta="CPI ≥ 1.00 green, 0.95 to 1.00 amber, under 0.95 red. A cost overrun is never green. At-risk rows are tinted."
      >
        <CostTable lines={p.lines} />
      </Section>
      <DataSource />
    </>
  );
}

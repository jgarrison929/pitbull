import { Suspense } from "react";
import { notFound } from "next/navigation";
import { CostTable } from "@/components/app/cost-table";
import { Money, StatusIndex, StatusPill } from "@/components/app/format";
import { Kpi, KpiStrip, PageHeader, Section } from "@/components/app/page";
import { EvMethodControls } from "@/components/app/ev-method-controls";
import { PlanCard } from "@/components/app/plan-card";
import { ReportWorkForm } from "@/components/app/report-work-form";
import { pct, usdShort } from "@/lib/ev";
import { getJob, getJobEvControls, getPlansForJob } from "@/server/data";
import {
  draftClaimForJob,
  getReportedActualsForPlan,
} from "@/server/progress";
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
  // Proxy already returns HTTP 404 for unknown jobs; this covers soft navigations.
  if (!p) notFound();
  const [plans, changes, draftClaim, evControls] = await Promise.all([
    getPlansForJob(user.companyId, p.job.id),
    jobChanges(user.companyId, p.job.number),
    draftClaimForJob(user.companyId, p.job.id),
    getJobEvControls(user.companyId, p.job.id),
  ]);
  const reportedByPlan = Object.fromEntries(
    await Promise.all(
      plans
        .filter((pl) => pl.status === "submitted")
        .map(async (pl) => [
          pl.id,
          await getReportedActualsForPlan(user.companyId, pl.id),
        ]),
    ),
  ) as Record<
    string,
    Awaited<ReturnType<typeof getReportedActualsForPlan>>
  >;
  const canEdit = actions["dailyPlan.updateLine"].roles?.includes(user.role);
  const canReport = actions["dailyReport.post"].roles?.includes(user.role);
  const canLock = actions["progressClaim.lock"].roles?.includes(user.role);
  const canApprove = actions["estimate.approve"].roles?.includes(user.role);
  const canEvEdit = actions["costItem.setPmPercent"].roles?.includes(user.role);
  const estimateDraft = p.job.estimateStatus === "draft";
  // Initial combobox options: first leaves only. Large WBS uses server search.
  const costItems = p.lines.slice(0, 40).map((l) => ({
    value: l.id,
    label: `${l.code} ${l.description}`,
    hint: l.unit,
    unit: l.unit,
  }));
  const byId = new Map(p.lines.map((l) => [l.id, l]));
  const nodes = p.items.map((i) => ({
    id: i.id,
    code: i.code,
    description: i.description,
    unit: i.unit,
    depth: i.depth,
    isLeaf: i.isLeaf,
    path: i.path,
    line: i.isLeaf ? byId.get(i.id) : undefined,
  }));
  return (
    <>
      <PageHeader
        title={p.job.name}
        meta={`${p.job.number} · ${p.job.owner} · PM ${p.job.pmName} · finish ${new Date(`${p.job.finishOn}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })}`}
        actions={
          <div className="flex items-center gap-2">
            {estimateDraft && canApprove ? (
              <form action={runAction}>
                <input
                  type="hidden"
                  name="action"
                  value="estimate.approve"
                />
                <input type="hidden" name="job" value={p.job.number} />
                <input
                  type="hidden"
                  name="label"
                  value="Approve estimate"
                />
                <button
                  type="submit"
                  className="rounded-md border px-3 py-1.5 text-xs font-medium"
                  data-testid="approve-estimate"
                >
                  Approve estimate
                </button>
              </form>
            ) : null}
            {draftClaim && canLock ? (
              <form action={runAction}>
                <input
                  type="hidden"
                  name="action"
                  value="progressClaim.lock"
                />
                <input type="hidden" name="job" value={p.job.number} />
                <input
                  type="hidden"
                  name="label"
                  value={`Lock ${draftClaim.periodLabel}`}
                />
                <button
                  type="submit"
                  className="rounded-md border px-3 py-1.5 text-xs font-medium"
                  data-testid="lock-claim"
                >
                  Lock {draftClaim.periodLabel}
                </button>
              </form>
            ) : null}
            <StatusPill value={p.status} varianceCents={p.costVarianceCents} />
          </div>
        }
      />
      <p
        className="mb-3 text-xs text-muted-foreground"
        data-testid="estimate-status"
        data-status={p.job.estimateStatus}
      >
        Estimate:{" "}
        {estimateDraft
          ? "draft — Approve freezes Original Budget from the Current Estimate"
          : "approved — Original Budget frozen; Current Budget equals Original until change orders"}
      </p>
      <KpiStrip>
        <Kpi
          label="Current budget"
          value={<Money cents={p.budgetCents} />}
          sub={
            estimateDraft
              ? "Zero until the estimate is approved"
              : `${pct(p.percent)} earned`
          }
          testId="job-budget"
        />
        <Kpi
          label="Earned to date"
          value={<Money cents={p.earnedCents} />}
          sub={`${pct(p.percent)} of ${usdShort(p.budgetCents)} budget`}
          testId="job-earned"
        />
        <Kpi
          label="Actual cost"
          value={<Money cents={p.actualCents} />}
          sub={`vs ${usdShort(p.earnedCents)} earned`}
          testId="job-actual"
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
          costItems={canEdit ? costItems : undefined}
          searchUrl={
            canEdit
              ? `/app/jobs/${p.job.number}/cost-items/search`
              : undefined
          }
          actions={
            <div className="flex flex-wrap gap-2">
              {plan.status === "draft" &&
              actions["dailyPlan.submit"].roles?.includes(user.role) ? (
                <form action={runAction}>
                  <input type="hidden" name="action" value="dailyPlan.submit" />
                  <input type="hidden" name="job" value={p.job.number} />
                  <input type="hidden" name="label" value="Submit plan" />
                  <button
                    type="submit"
                    className="rounded-md border px-3 py-1.5 text-xs font-medium"
                    data-testid="submit-plan"
                  >
                    Submit plan
                  </button>
                </form>
              ) : null}
            </div>
          }
          report={
            canReport && plan.status === "submitted" ? (
              <ReportWorkForm
                jobNumber={p.job.number}
                lines={plan.lines.map((l) => {
                  const reported = reportedByPlan[plan.id]?.[l.id];
                  return {
                    id: l.id,
                    code: l.code,
                    activity: l.activity,
                    unit: l.unit,
                    manHours: l.manHours,
                    qtyMilli: l.qtyMilli,
                    reportedManHours: reported?.manHours,
                    reportedQtyMilli: reported?.qtyMilli,
                  };
                })}
              />
            ) : undefined
          }
        />
      ))}
      {canEvEdit ? (
        <Section
          title="Field measurement methods"
          meta="PM percent (with who/why) and weighted milestones — enterable on screen and via the assistant."
        >
          <EvMethodControls
            jobNumber={p.job.number}
            milestones={evControls.milestones}
            pmItems={evControls.pmItems}
          />
        </Section>
      ) : null}
      <Section
        title="Budget vs earned value by cost code"
        meta={
          <span className="block whitespace-normal">
            Earned uses the locked claim (claimed installed for units). Live
            installs above that show as pending until the PM locks. CPI ≥ 1.00
            green, 0.95 to 1.00 amber, under 0.95 red. A cost overrun is never
            green.
          </span>
        }
      >
        <CostTable nodes={nodes} />
      </Section>
      <Section
        title="Changes on this job"
        meta="Every edit and submit, by anyone on this job"
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
    </>
  );
}

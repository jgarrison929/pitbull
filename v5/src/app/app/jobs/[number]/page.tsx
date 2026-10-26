import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ApproveReportForm,
  ReturnReportForm,
} from "@/components/app/approve-return-forms";
import { ChangeOrdersSection } from "@/components/app/change-orders";
import { CostTable } from "@/components/app/cost-table";
import { Money, StatusIndex, StatusPill } from "@/components/app/format";
import { Kpi, KpiStrip, PageHeader, Section } from "@/components/app/page";
import { EvMethodControls } from "@/components/app/ev-method-controls";
import { ImportEstimateForm } from "@/components/app/import-estimate-form";
import { NewPlanForm } from "@/components/app/new-plan-form";
import { PlanCard } from "@/components/app/plan-card";
import { ReportWorkForm } from "@/components/app/report-work-form";
import { mh, pct, usdShort } from "@/lib/ev";
import { planDateToday, timeZoneForJob } from "@/lib/plan-date";
import { getJob, getJobEvControls, getPlansForJob } from "@/server/data";
import {
  draftClaimForJob,
  getApprovalPendingByCostItem,
  getReportedActualsForPlans,
} from "@/server/progress";
import { listChangeOrders } from "@/server/change-orders";
import { listCrews } from "@/server/plans";
import { seedNow } from "@/server/seed-clock";
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
  const [
    plans,
    changes,
    draftClaim,
    evControls,
    approvalPending,
    coData,
    crewRows,
  ] = await Promise.all([
    getPlansForJob(user.companyId, p.job.id),
    jobChanges(user.companyId, p.job.number),
    draftClaimForJob(user.companyId, p.job.id),
    getJobEvControls(user.companyId, p.job.id),
    getApprovalPendingByCostItem(user.companyId, p.job.id),
    listChangeOrders(user.companyId, p.job.number),
    listCrews(user.companyId),
  ]);
  const todayPlan = planDateToday(seedNow(), timeZoneForJob());
  // Working surface: today and any future plan (seed tomorrow draft included).
  // Past days (any status) collapse into field history — not peer primary cards.
  const openPlans = plans
    .filter((pl) => pl.planDate >= todayPlan)
    .sort((a, b) => a.planDate.localeCompare(b.planDate));
  const historyPlans = plans
    .filter((pl) => pl.planDate < todayPlan)
    .slice()
    .sort((a, b) => b.planDate.localeCompare(a.planDate));
  const historyDay = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  const reportable = openPlans.filter(
    (pl) => pl.status === "issued" || pl.status === "reported",
  );
  const reportedByPlan = await getReportedActualsForPlans(
    user.companyId,
    reportable.map((pl) => pl.id),
  );
  const canEdit = actions["dailyPlan.updateLine"].roles?.includes(user.role);
  const canCreatePlan =
    actions["dailyPlan.create"].roles?.includes(user.role) ?? false;
  const canAddRemove =
    (actions["dailyPlan.addLine"].roles?.includes(user.role) ?? false) &&
    (actions["dailyPlan.removeLine"].roles?.includes(user.role) ?? false);
  const canReport = actions["dailyReport.post"].roles?.includes(user.role);
  const canApproveReport = actions["dailyPlan.approve"].roles?.includes(
    user.role,
  );
  const canReturn = actions["dailyPlan.return"].roles?.includes(user.role);
  const canLock = actions["progressClaim.lock"].roles?.includes(user.role);
  const canApprove = actions["estimate.approve"].roles?.includes(user.role);
  const coCan = {
    create: actions["changeOrder.create"].roles?.includes(user.role) ?? false,
    price: actions["changeOrder.price"].roles?.includes(user.role) ?? false,
    approve: actions["changeOrder.approve"].roles?.includes(user.role) ?? false,
    reject: actions["changeOrder.reject"].roles?.includes(user.role) ?? false,
    void: actions["changeOrder.void"].roles?.includes(user.role) ?? false,
  };
  const canImport = actions["estimate.importCsv"].roles?.includes(user.role);
  const canEvEdit = actions["costItem.setPmPercent"].roles?.includes(user.role);
  const estimateDraft = p.job.estimateStatus === "draft";
  const jobMoney = p.money.job;
  // Initial combobox options: first leaves only. Large WBS uses server search.
  const costItems = p.lines.slice(0, 40).map((l) => ({
    value: l.id,
    label: `${l.code} ${l.description}`,
    hint: l.unit,
    unit: l.unit,
  }));
  const byId = new Map(
    p.lines.map((l) => {
      const pend = approvalPending[l.id];
      return [
        l.id,
        {
          ...l,
          approvalPendingQtyMilli: pend?.qtyMilli ?? 0,
          approvalPendingCents: pend?.cents ?? 0,
        },
      ];
    }),
  );
  const nodes = p.items.map((i) => ({
    id: i.id,
    code: i.code,
    description: i.description,
    unit: i.unit,
    depth: i.depth,
    isLeaf: i.isLeaf,
    path: i.path,
    line: i.isLeaf ? byId.get(i.id) : undefined,
    money: p.money.byId[i.id]!,
  }));
  return (
    <>
      <PageHeader
        title={p.job.name}
        meta={
          <>
            {p.job.number} · {p.job.owner} · PM {p.job.pmName} · finish{" "}
            <time dateTime={p.job.finishOn} data-testid="job-finish">
              {new Date(`${p.job.finishOn}T00:00:00Z`).toLocaleDateString(
                "en-US",
                { month: "short", year: "numeric", timeZone: "UTC" },
              )}
            </time>
          </>
        }
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
            {draftClaim && canLock && !estimateDraft ? (
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
            {estimateDraft ? (
              <span
                className="inline-flex shrink-0 items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                data-status="draft"
                data-testid="draft-label"
              >
                Draft
              </span>
            ) : (
              <StatusPill
                value={p.status!}
                varianceCents={p.costVarianceCents}
              />
            )}
          </div>
        }
      />
      <p
        className="mb-3 text-xs text-muted-foreground"
        data-testid="estimate-status"
        data-status={p.job.estimateStatus}
        data-source={p.job.estimateSource}
      >
        Estimate:{" "}
        {estimateDraft
          ? "draft — Approve freezes Original Budget from the Current Estimate"
          : "approved — Original Budget frozen; Current Budget equals Original until change orders"}
      </p>
      {estimateDraft && canImport ? (
        <ImportEstimateForm jobNumber={p.job.number} />
      ) : null}
      {/* Plans lead so Submit + crew footer stay reachable after KPI growth (#662). */}
      {canCreatePlan && !estimateDraft ? (
        <div className="mb-3" data-testid="new-plan-slot">
          <NewPlanForm
            jobNumber={p.job.number}
            crews={crewRows.map((c) => ({ id: c.id, name: c.name }))}
            defaultDate={todayPlan}
          />
        </div>
      ) : null}
      {openPlans.map((plan) => (
        <PlanCard
          key={plan.id}
          plan={plan}
          jobNumber={p.job.number}
          canAddRemove={canAddRemove}
          costItems={canEdit || canAddRemove ? costItems : undefined}
          searchUrl={
            canEdit || canAddRemove
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
                  <input type="hidden" name="planId" value={plan.id} />
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
            canReport &&
            (plan.status === "issued" || plan.status === "reported") ? (
              <div className="flex flex-col gap-3">
                <ReportWorkForm
                  jobNumber={p.job.number}
                  planId={plan.id}
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
                {plan.status === "reported" &&
                (canApproveReport || canReturn) ? (
                  <div
                    className="flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-start"
                    data-testid="approve-return-panel"
                  >
                    {canApproveReport ? (
                      <ApproveReportForm
                        jobNumber={p.job.number}
                        planId={plan.id}
                      />
                    ) : null}
                    {canReturn ? (
                      <ReturnReportForm
                        jobNumber={p.job.number}
                        planId={plan.id}
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : undefined
          }
        />
      ))}
      {historyPlans.length > 0 ? (
        <details
          className="mb-3 rounded-xl border bg-card"
          data-testid="plan-history"
        >
          <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium">
            Approved field history · {historyPlans.length} working days
          </summary>
          <ul className="divide-y border-t text-sm">
            {historyPlans.map((pl) => {
              const mh = pl.lines.reduce((s, l) => s + l.manHours, 0);
              return (
                <li
                  key={pl.id}
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2"
                  data-testid="plan-history-row"
                  data-plan-date={pl.planDate}
                  data-plan-id={pl.id}
                >
                  <span className="font-medium">{historyDay(pl.planDate)}</span>
                  <span className="text-muted-foreground">{pl.crew}</span>
                  <span className="text-muted-foreground">
                    {pl.lines.length}{" "}
                    {pl.lines.length === 1 ? "line" : "lines"} · {mh} MH
                  </span>
                  {pl.returnReason ? (
                    <span className="text-xs text-caution">
                      Returned: {pl.returnReason}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </details>
      ) : null}
      <KpiStrip>
        <Kpi
          label="Original budget"
          value={
            estimateDraft ? (
              <span className="text-muted-foreground" data-testid="metric-dash">
                —
              </span>
            ) : (
              <Money cents={jobMoney.obCents} />
            )
          }
          sub={
            estimateDraft
              ? "Approve freezes the estimate here"
              : "Frozen at approve"
          }
          testId="job-original-budget"
        />
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
          label="Current estimate"
          value={<Money cents={jobMoney.ceCents} />}
          sub={`${mh(jobMoney.mhMilli)} MH budgeted`}
          testId="job-estimate"
        />
        <Kpi
          label="Earned to date"
          value={
            estimateDraft ? (
              <span className="text-muted-foreground" data-testid="metric-dash">
                —
              </span>
            ) : (
              <Money cents={p.earnedCents} />
            )
          }
          sub={
            estimateDraft
              ? "After estimate approval"
              : p.lockAt
                ? `${pct(p.percent)} of ${usdShort(p.budgetCents)} · as of last lock`
                : `${pct(p.percent)} of ${usdShort(p.budgetCents)} budget`
          }
          testId="job-earned"
        />
        <Kpi
          label="Actual cost"
          value={
            estimateDraft ? (
              <span className="text-muted-foreground" data-testid="metric-dash">
                —
              </span>
            ) : (
              <Money cents={p.actualCents} />
            )
          }
          sub={
            estimateDraft
              ? "After estimate approval"
              : p.sinceLockActualCents !== 0 ? (
                  <>
                    vs {usdShort(p.earnedCents)} earned ·{" "}
                    <span data-testid="job-actual-since-lock">
                      <Money cents={p.sinceLockActualCents} /> since lock
                    </span>
                  </>
                ) : (
                  `vs ${usdShort(p.earnedCents)} earned`
                )
          }
          testId="job-actual"
        />
        <Kpi
          label="CPI"
          value={
            estimateDraft ? (
              <span className="text-muted-foreground" data-testid="metric-dash">
                —
              </span>
            ) : (
              <StatusIndex index={p.cpi} varianceCents={p.costVarianceCents} />
            )
          }
          sub={
            estimateDraft ? (
              "EAC — · ETC —"
            ) : (
              <>
                EAC{" "}
                <span data-testid="job-eac" data-cents={p.eacCents}>
                  {usdShort(p.eacCents)}
                </span>
                {" · ETC "}
                {usdShort(p.etcCents)}
              </>
            )
          }
          testId="job-cpi"
        />
        <Kpi
          label="SPI"
          value={
            estimateDraft ? (
              <span className="text-muted-foreground" data-testid="metric-dash">
                —
              </span>
            ) : (
              <StatusIndex
                index={p.spi}
                varianceCents={p.scheduleVarianceCents}
              />
            )
          }
          sub={
            estimateDraft
              ? "After estimate approval"
              : p.sinceLockPlannedCents !== 0
                ? `${usdShort(p.plannedCents)} planned · ${usdShort(p.sinceLockPlannedCents)} PV since lock`
                : `schedule variance · ${usdShort(p.plannedCents)} planned`
          }
          testId="job-spi"
        />
      </KpiStrip>
      <p
        className="mt-2 text-xs text-muted-foreground"
        data-testid="estimate-categories"
        data-source={p.job.estimateSource}
      >
        {p.job.estimateSource === "csv" ? (
          <>
            Current estimate by category: labor{" "}
            <span data-testid="estimate-labor">
              <Money cents={jobMoney.ce.laborCents} />
            </span>{" "}
            · material{" "}
            <span data-testid="estimate-material">
              <Money cents={jobMoney.ce.materialCents} />
            </span>{" "}
            · equipment{" "}
            <span data-testid="estimate-equipment">
              <Money cents={jobMoney.ce.equipmentCents} />
            </span>{" "}
            · subcontract{" "}
            <span data-testid="estimate-sub">
              <Money cents={jobMoney.ce.subCents} />
            </span>{" "}
            ·{" "}
            <span data-testid="estimate-mh" data-milli={jobMoney.mhMilli}>
              {mh(jobMoney.mhMilli)} MH
            </span>
          </>
        ) : (
          "Lump budget — each cost item is one seeded total, with no labor, material, equipment, or subcontract split."
        )}
      </p>
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
            EV, AC, and PV share the last locked period; cost posted since that
            lock shows separately. Foreman reports stay pending until the
            superintendent approves; approved installs above the claim stay
            pending lock until the PM locks. Job EAC is the sum of per-item
            forecasts. CPI ≥ 1.00 green, 0.95 to 1.00 amber, under 0.95 red. A
            cost overrun is never green.
          </span>
        }
      >
        <CostTable
          key={p.job.estimateStatus}
          nodes={nodes}
          jobMoney={jobMoney}
          defaultValueSet={estimateDraft ? "ce" : "cb"}
          estimateDraft={estimateDraft}
          jobNumber={p.job.number}
        />
      </Section>
      {coData ? (
        <ChangeOrdersSection
          jobNumber={p.job.number}
          data={coData}
          can={coCan}
          costItems={costItems}
          searchUrl={`/app/jobs/${p.job.number}/cost-items/search`}
        />
      ) : null}
      <Section
        title="Changes on this job"
        meta="Every edit, report, approve, return, and change order, by anyone on this job"
        actions={
          <Link
            href={`/app/jobs/${p.job.number}/changes`}
            className="text-xs font-medium underline hover:no-underline"
            data-testid="job-changes-full-link"
          >
            Full change list
          </Link>
        }
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

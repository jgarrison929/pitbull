import type { getPlansForJob } from "@/server/data";
import { AddPlanLineForm } from "@/components/app/add-plan-line-form";
import { PlanLineEditor } from "@/components/app/plan-line-editor";
import { runAction } from "@/app/app/assistant/actions";
import type { Option } from "@/components/form/form";
import { utcDay } from "@/lib/dates";
import { qty } from "@/lib/ev";
import { formatMhPerUnit } from "@/lib/plan-line";
import { cn } from "@/lib/utils";

type Plan = Awaited<ReturnType<typeof getPlansForJob>>[number];

/** A crew's daily plan, each line checked against the cost item's budgeted unit rate. */
export function PlanCard({
  plan,
  jobNumber,
  actions,
  costItems,
  searchUrl,
  report,
  canAddRemove,
}: {
  plan: Plan;
  /** Job number — required for drill-down links and remove-line forms. */
  jobNumber: string;
  actions?: React.ReactNode;
  /** This job's cost items. Pass them only when the viewer may edit this plan's lines. */
  costItems?: (Option & { unit: string })[];
  /** Server typeahead for large WBS. */
  searchUrl?: string;
  /** After submit: enter actual MH/qty without changing the plan. */
  report?: React.ReactNode;
  /** Superintendent may add/remove lines on a draft. */
  canAddRemove?: boolean;
}) {
  const manHours = plan.lines.reduce((s, l) => s + l.manHours, 0);
  const draft = plan.status === "draft";
  const showAdd =
    Boolean(canAddRemove) &&
    draft &&
    Boolean(costItems && costItems.length > 0);
  return (
    <section
      className={cn(
        "rounded-xl border",
        draft ? "border-brand bg-caution-soft/40" : "bg-card",
      )}
      data-testid="plan-card"
      data-status={plan.status}
      data-plan-id={plan.id}
      data-plan-date={plan.planDate}
    >
      <header className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
        <h2 className="min-w-0 text-sm font-semibold">
          {/* Plain <a>: next/link ?_rsc= prefetch after paint holds job-page networkidle. */}
          <a
            href={`/app/jobs/${jobNumber}/plans/${plan.id}`}
            className="hover:underline"
            data-testid="plan-detail-link"
          >
            <span className="whitespace-nowrap">Daily plan</span>
            <span className="text-muted-foreground"> · </span>
            <span className="whitespace-nowrap">{plan.crew}</span>
            <span className="text-muted-foreground"> · </span>
            <span className="whitespace-nowrap">{utcDay(plan.planDate)}</span>
          </a>
        </h2>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-medium",
            statusBadgeClass(plan.status),
          )}
          data-testid="plan-status"
        >
          {statusLabel(plan.status)}
        </span>
        <span className="text-xs text-muted-foreground">
          Foreman {plan.foreman}
          {plan.weather ? ` · ${plan.weather}` : ""}
        </span>
        {actions ? (
          <div className="ml-auto flex flex-wrap gap-2">{actions}</div>
        ) : null}
      </header>
      {plan.returnReason ? (
        <p
          className="border-b bg-caution-soft/50 px-4 py-2 text-xs"
          data-testid="return-reason-banner"
        >
          Returned: {plan.returnReason}
        </p>
      ) : null}
      {plan.lines.length === 0 ? (
        <p
          className="px-4 py-3 text-sm text-muted-foreground"
          data-testid="plan-empty"
        >
          Add a cost item to plan the day
        </p>
      ) : (
        <ul className="divide-y px-4">
          {plan.lines.map((l) => (
            <li
              key={l.id}
              className="py-2.5 text-sm"
              data-testid="plan-line"
              data-code={l.code}
            >
              {costItems && draft ? (
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <PlanLineEditor
                      line={l}
                      costItems={costItems}
                      searchUrl={searchUrl}
                    >
                      <LineView l={l} />
                    </PlanLineEditor>
                  </div>
                  {canAddRemove ? (
                    <form action={runAction}>
                      <input
                        type="hidden"
                        name="action"
                        value="dailyPlan.removeLine"
                      />
                      <input type="hidden" name="job" value={jobNumber} />
                      <input type="hidden" name="planId" value={plan.id} />
                      <input type="hidden" name="lineId" value={l.id} />
                      <input type="hidden" name="label" value="Remove line" />
                      <button
                        type="submit"
                        className="rounded-md border px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                        data-testid="remove-plan-line"
                        aria-label={`Remove ${l.code}`}
                      >
                        Remove
                      </button>
                    </form>
                  ) : null}
                </div>
              ) : (
                <LineView l={l} />
              )}
            </li>
          ))}
        </ul>
      )}
      {showAdd && costItems ? (
        <AddPlanLineForm
          jobNumber={jobNumber}
          planId={plan.id}
          costItems={costItems}
          searchUrl={searchUrl}
        />
      ) : null}
      <Footer plan={plan} manHours={manHours} />
      {report ? (
        <div className="border-t px-4 py-3" data-testid="report-panel">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Report day&apos;s work — pending until superintendent approves
          </h3>
          {report}
        </div>
      ) : null}
    </section>
  );
}

function statusLabel(status: Plan["status"]) {
  switch (status) {
    case "draft":
      return "Draft";
    case "issued":
      return "Issued";
    case "reported":
      return "Reported";
    case "approved":
      return "Approved";
    default:
      return status;
  }
}

function statusBadgeClass(status: Plan["status"]) {
  switch (status) {
    case "draft":
      return "bg-brand/30";
    case "issued":
      return "bg-positive-soft text-positive";
    case "reported":
      return "bg-caution-soft text-caution";
    case "approved":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-muted";
  }
}

/** Keep a trailing short token (e.g. "lift 2") with its word — no orphan digit wrap. */
export function activityLabel(activity: string) {
  return activity.replace(/(\S+)\s+(\S{1,3})$/u, "$1\u00A0$2");
}

function LineView({ l }: { l: Plan["lines"][number] }) {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
      <div className="min-w-0">
        <div className="font-medium text-pretty">
          <span className="mr-2 font-mono text-xs text-muted-foreground">
            {l.code}
          </span>
          {activityLabel(l.activity)}
        </div>
        <div className="text-xs text-muted-foreground">
          {l.location} · {l.description}
        </div>
      </div>
      <div className="text-right tabular-nums">
        {qty(l.qtyMilli)} {l.unit}
      </div>
      <div className="col-span-2 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
        <span>
          {l.workers} {l.workers === 1 ? "worker" : "workers"} ×{" "}
          {l.hoursTenths / 10} h ={" "}
          <span className="font-medium text-foreground">
            <span data-testid="line-mh">{l.manHours}</span> MH
          </span>
        </span>
        <span className={l.withinRate ? "text-positive" : "text-negative"}>
          {l.withinRate ? "Within" : "Over"} budget rate (
          {formatMhPerUnit(l.plannedRate)} vs{" "}
          {formatMhPerUnit(l.budgetRate)} MH/{l.unit})
        </span>
      </div>
      {l.notes && (
        <p
          className="col-span-2 text-xs text-muted-foreground"
          data-testid="line-notes"
        >
          Note: {l.notes}
        </p>
      )}
    </div>
  );
}

function Footer({
  plan,
  manHours,
}: {
  plan: Plan;
  manHours: number;
}) {
  if (plan.equipment.length === 0 && plan.lines.length === 0) return null;
  return (
    <footer
      className="flex flex-wrap items-center gap-2 border-t px-4 py-3 text-xs"
      data-testid="plan-footer"
    >
      {plan.equipment.map((e) => (
        <span
          key={e.name}
          className="rounded-md border bg-background px-2 py-1"
        >
          {e.name} <span className="text-muted-foreground">{e.hours} h</span>
        </span>
      ))}
      {plan.lines.length > 0 ? (
        <span className="font-medium tabular-nums">{manHours} MH</span>
      ) : null}
    </footer>
  );
}

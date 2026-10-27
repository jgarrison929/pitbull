import Link from "next/link";
import type { getPlansForJob } from "@/server/data";
import { AddPlanLineForm } from "@/components/app/add-plan-line-form";
import { Figure } from "@/components/app/format";
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
  const plannedMh = plan.lines.reduce((s, l) => s + l.manHours, 0);
  const reportedMh = plan.lines.reduce((s, l) => {
    if (l.reportedHoursTenths == null) return s;
    return s + l.reportedHoursTenths / 10;
  }, 0);
  const hasReported = plan.lines.some((l) => l.reportedHoursTenths != null);
  const useReported =
    (plan.status === "reported" || plan.status === "approved") && hasReported;
  const primaryMh = useReported ? reportedMh : plannedMh;
  const primaryLabel = useReported ? "Reported man-hours" : "Planned man-hours";
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
      <header className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2 sm:py-2.5">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <h2 className="min-w-0 text-section font-semibold text-pretty break-words">
            <Link
              href={`/app/jobs/${jobNumber}/plans/${plan.id}`}
              className="hover:underline"
              data-testid="plan-detail-link"
            >
              Daily plan
              <span className="text-muted-foreground"> · </span>
              {plan.crew}
              <span className="text-muted-foreground"> · </span>
              {utcDay(plan.planDate)}
            </Link>
          </h2>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-label font-medium",
              statusBadgeClass(plan.status),
            )}
            data-testid="plan-status"
            data-text="label"
          >
            {statusLabel(plan.status)}
          </span>
          <span
            className="min-w-0 text-label text-pretty break-words whitespace-normal text-muted-foreground"
            data-text="label"
            data-testid="plan-foreman-weather"
          >
            Foreman {plan.foreman}
            {plan.weather ? ` · ${plan.weather}` : ""}
          </span>
        </div>
        {plan.lines.length > 0 ? (
          <div
            data-card
            className="min-w-0 sm:ml-auto"
            data-testid="plan-primary-mh"
          >
            <div
              data-text="label"
              className="text-label font-medium text-muted-foreground"
            >
              {primaryLabel}
            </div>
            <Figure variant="primary" className="block">
              {formatMh(primaryMh)} MH
            </Figure>
          </div>
        ) : null}
        {actions ? (
          <div
            className={cn(
              "flex w-full flex-wrap gap-2 sm:w-auto",
              // Primary card action (Submit plan): full-width brand on phones.
              "max-sm:[&_button]:tap-target max-sm:[&_button]:w-full max-sm:[&_button]:border-0 max-sm:[&_button]:bg-brand max-sm:[&_button]:text-body max-sm:[&_button]:font-medium max-sm:[&_button]:text-brand-foreground",
              "sm:ml-auto",
            )}
          >
            {actions}
          </div>
        ) : null}
      </header>
      {plan.returnReason ? (
        <p
          className="border-b bg-caution-soft/50 px-4 py-2 text-body"
          data-testid="return-reason-banner"
        >
          Returned: {plan.returnReason}
        </p>
      ) : null}
      {plan.lines.length === 0 ? (
        <p
          className="px-4 py-3 text-body text-muted-foreground"
          data-testid="plan-empty"
        >
          Add a cost item to plan the day
        </p>
      ) : (
        <ul className="divide-y px-4">
          {plan.lines.map((l) => (
            <li
              key={l.id}
              className="py-3 text-body"
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
                        className="tap-target rounded-md border px-3 py-2 text-label font-medium text-muted-foreground hover:text-foreground"
                        data-testid="remove-plan-line"
                        data-text="label"
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
      <Footer plan={plan} />
      {report ? (
        <div className="border-t px-4 py-3" data-testid="report-panel">
          <h3
            className="mb-3 text-label font-semibold text-muted-foreground"
            data-text="label"
          >
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

/** One decimal MH for plan card figures (matches field intel G/L display). */
function formatMh(n: number) {
  return (Math.round(n * 10) / 10).toLocaleString("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function LineView({ l }: { l: Plan["lines"][number] }) {
  const rateText = `${l.withinRate ? "Within" : "Over"} budget rate (${formatMhPerUnit(l.plannedRate)} vs ${formatMhPerUnit(l.budgetRate)} MH/${l.unit})`;
  const detailSummary = `${l.workers} ${l.workers === 1 ? "worker" : "workers"} · ${l.hoursTenths / 10} h each`;
  const placeDesc = `${l.location} · ${l.description}`;
  return (
    <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
      <div className="min-w-0">
        <div className="font-medium text-pretty">
          <span className="mr-2 font-mono text-label text-muted-foreground">
            {l.code}
          </span>
          {activityLabel(l.activity)}
        </div>
        <div className="min-w-0 text-label text-pretty break-words whitespace-normal text-muted-foreground">
          <span className="sm:hidden">{l.location}</span>
          <span className="hidden sm:inline">{placeDesc}</span>
        </div>
      </div>
      <div className="text-right tabular-nums">
        {qty(l.qtyMilli)} {l.unit}
      </div>
      <div className="col-span-2 flex flex-wrap items-baseline gap-x-3 text-label text-muted-foreground">
        <span>
          <span className="hidden sm:inline">
            {l.workers} {l.workers === 1 ? "worker" : "workers"} ×{" "}
            {l.hoursTenths / 10} h ={" "}
          </span>
          <span className="font-medium text-foreground">
            <span data-testid="line-mh">{l.manHours}</span> MH
          </span>
        </span>
        <span
          className={cn(
            "hidden sm:inline",
            l.withinRate ? "text-positive" : "text-negative",
          )}
        >
          {rateText}
        </span>
      </div>
      {/* Phone: read-only extras behind a tap — never required report fields. */}
      <details className="col-span-2 sm:hidden">
        <summary
          data-text="label"
          className="tap-target flex cursor-pointer list-none items-center text-label font-medium text-pretty break-words whitespace-normal text-muted-foreground [&::-webkit-details-marker]:hidden"
        >
          {detailSummary}
        </summary>
        <div className="space-y-1 pt-2 text-label text-pretty break-words whitespace-normal text-muted-foreground">
          <p>{placeDesc}</p>
          <p className={l.withinRate ? "text-positive" : "text-negative"}>
            {rateText}
          </p>
        </div>
      </details>
      {l.notes ? (
        <p
          className="col-span-2 text-label text-muted-foreground"
          data-testid="line-notes"
        >
          Note: {l.notes}
        </p>
      ) : null}
    </div>
  );
}

function Footer({ plan }: { plan: Plan }) {
  if (plan.equipment.length === 0) return null;
  return (
    <footer
      className="flex flex-wrap items-center gap-2 border-t px-4 py-3 text-label"
      data-testid="plan-footer"
      data-text="label"
    >
      {plan.equipment.map((e) => (
        <span
          key={e.name}
          className="rounded-md border bg-background px-2 py-1"
        >
          {e.name}{" "}
          <span className="whitespace-nowrap text-muted-foreground">
            {e.hours} h
          </span>
        </span>
      ))}
    </footer>
  );
}

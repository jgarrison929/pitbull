"use client";

import { useActionState, useMemo, useState } from "react";
import { runActionState, type ActionState } from "@/app/app/assistant/actions";
import { Figure } from "@/components/app/format";
import { qty } from "@/lib/ev";
import { REPORT_LIMITS } from "@/lib/plan-line";
import { cn } from "@/lib/utils";

export type ReportLine = {
  id: string;
  code: string;
  activity: string;
  unit: string;
  /** Planned man-hours (workers × hours). */
  manHours: number;
  qtyMilli: number;
  /** Budget MH per unit — drives live earned MH / gain-loss. */
  budgetRate: number;
  /** Last reported values for this plan line, when a report exists. */
  reportedManHours?: number | null;
  reportedQtyMilli?: number | null;
};

/** Round to 0.1 MH for live G/L display (field intel check 3). */
export function roundMh(n: number) {
  return Math.round(n * 10) / 10;
}

/**
 * Earned MH = reported quantity × budget MH per unit.
 * G/L = earned − actual (negative is a loss).
 */
export function reportGainLoss(args: {
  qty: number;
  actualMh: number;
  budgetRate: number;
}) {
  const earned = roundMh(args.qty * args.budgetRate);
  const actual = roundMh(args.actualMh);
  const gl = roundMh(earned - actual);
  return { earned, actual, gl };
}

function formatGl(n: number) {
  const abs = Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  if (n === 0) return "0.0";
  return `${n < 0 ? "\u2212" : "+"}${abs}`;
}

function formatMh(n: number) {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

/**
 * After a plan is submitted, the foreman enters actual MH and quantity per line.
 * Defaults = last report for that line, else the plan. The submitted plan is unchanged.
 * Required qty/MH stay outside any collapsed region (5.0.4-d).
 */
export function ReportWorkForm({
  jobNumber,
  planId,
  lines,
}: {
  jobNumber: string;
  planId: string;
  lines: ReportLine[];
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    runActionState,
    {},
  );
  // Remount after report so defaultValues pick up server-rendered reported values.
  const formKey = lines
    .map(
      (l) =>
        `${l.id}:${l.reportedManHours ?? ""}:${l.reportedQtyMilli ?? ""}`,
    )
    .join("|");
  return (
    <form
      key={formKey}
      action={action}
      className="flex w-full flex-col gap-3"
      data-testid="report-work-form"
    >
      <input type="hidden" name="action" value="dailyReport.post" />
      <input type="hidden" name="job" value={jobNumber} />
      <input type="hidden" name="planId" value={planId} />
      <input type="hidden" name="label" value="Report day's work" />
      <ul className="flex flex-col gap-3">
        {lines.map((l) => (
          <ReportLineRow key={l.id} line={l} />
        ))}
      </ul>
      <button
        type="submit"
        disabled={pending}
        className="tap-target w-full rounded-md bg-brand px-3 py-2 text-body font-medium text-brand-foreground disabled:opacity-60 max-sm:-mx-4 max-sm:w-[calc(100%+2rem)] sm:mx-0 sm:w-auto sm:self-end"
        data-testid="report-work"
      >
        {pending ? "Reporting…" : "Report day's work"}
      </button>
      {state.summary && (
        <p
          className="text-label text-muted-foreground"
          data-testid="report-summary"
          data-text="label"
        >
          {state.summary}
        </p>
      )}
    </form>
  );
}

function ReportLineRow({ line: l }: { line: ReportLine }) {
  const defaultMh = l.reportedManHours ?? l.manHours;
  const defaultQty = (l.reportedQtyMilli ?? l.qtyMilli) / 1000;
  const hasReport = l.reportedManHours != null || l.reportedQtyMilli != null;
  const [actualMh, setActualMh] = useState(String(defaultMh));
  const [actualQty, setActualQty] = useState(String(defaultQty));

  const live = useMemo(() => {
    const mhN = Number(actualMh);
    const qtyN = Number(actualQty);
    if (!Number.isFinite(mhN) || !Number.isFinite(qtyN)) {
      return null;
    }
    return reportGainLoss({
      qty: qtyN,
      actualMh: mhN,
      budgetRate: l.budgetRate,
    });
  }, [actualMh, actualQty, l.budgetRate]);

  return (
    <li
      data-card
      className="rounded-lg border bg-background px-3 py-3"
      data-testid={`report-line-${l.code}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-body font-medium text-foreground">
            <span className="mr-1 font-mono text-label text-muted-foreground">
              {l.code}
            </span>
            <span
              className="max-[480px]:truncate inline-block max-w-full align-bottom"
              title={l.activity}
            >
              {l.activity}
            </span>
          </div>
          <div
            className="text-label text-muted-foreground"
            data-text="label"
          >
            Plan {formatMh(l.manHours)} MH · {qty(l.qtyMilli)} {l.unit}
            {hasReport ? (
              <span data-testid={`report-last-${l.code}`}>
                {" "}
                · Last report {formatMh(defaultMh)} MH · {qty(l.reportedQtyMilli ?? l.qtyMilli)}{" "}
                {l.unit}
              </span>
            ) : null}
          </div>
        </div>
        {live ? (
          <div className="min-w-0 text-right" data-testid={`report-gl-${l.code}`}>
            <div
              data-text="label"
              className="text-label font-medium text-muted-foreground"
            >
              Gain / loss
            </div>
            <Figure
              variant="primary"
              className={cn(
                "block",
                live.gl < 0
                  ? "text-negative"
                  : live.gl > 0
                    ? "text-positive"
                    : undefined,
              )}
            >
              {formatGl(live.gl)} MH
            </Figure>
            <div className="mt-0.5 flex flex-wrap justify-end gap-x-3">
              <Figure variant="secondary">
                Earned {formatMh(live.earned)} MH
              </Figure>
              <Figure variant="secondary">
                Actual {formatMh(live.actual)} MH
              </Figure>
            </div>
          </div>
        ) : null}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-label font-medium">
          Actual MH
          <input
            name={`actualMh[${l.id}]`}
            type="number"
            min={REPORT_LIMITS.manHours.min}
            max={REPORT_LIMITS.manHours.max}
            step={0.1}
            value={actualMh}
            onChange={(ev) => setActualMh(ev.target.value)}
            required
            className="tap-target rounded-md border bg-background px-3 py-2 text-body tabular-nums"
            data-testid={`report-mh-${l.code}`}
          />
        </label>
        <label className="flex flex-col gap-1 text-label font-medium">
          Actual {l.unit}
          <input
            name={`actualQty[${l.id}]`}
            type="number"
            min={REPORT_LIMITS.qty.min}
            max={REPORT_LIMITS.qty.max}
            step={0.001}
            value={actualQty}
            onChange={(ev) => setActualQty(ev.target.value)}
            required
            className="tap-target rounded-md border bg-background px-3 py-2 text-body tabular-nums"
            data-testid={`report-qty-${l.code}`}
          />
        </label>
      </div>
    </li>
  );
}

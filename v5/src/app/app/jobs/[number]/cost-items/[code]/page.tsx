import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ForecastMethodControl } from "@/components/app/forecast-method-control";
import { Money } from "@/components/app/format";
import { Kpi, KpiStrip, PageHeader, Section } from "@/components/app/page";
import { utcDay } from "@/lib/dates";
import { mh, qty, usdCents } from "@/lib/ev";
import { actions } from "@/server/assistant/actions";
import {
  loadCostItemRoute,
  type CostEntryRow,
} from "@/server/cost-item-page";

const EMPTY_LABOR =
  "Labor posts here when a daily report for this cost item is approved";

export default function CostItemPage({
  params,
}: {
  params: Promise<{ number: string; code: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div
          className="h-96 animate-pulse rounded-lg bg-muted"
          aria-busy="true"
        />
      }
    >
      <CostItem params={params} />
    </Suspense>
  );
}

function EntryRows({
  entries,
  jobNumber,
}: {
  entries: CostEntryRow[];
  jobNumber: string;
}) {
  return (
    <>
      {entries.map((e) =>
        e.kind === "labor" ? (
          <tr
            key={e.id}
            data-testid="cost-entry-labor"
            data-amount-cents={e.amountCents}
            data-rate-cents={e.rateCents ?? ""}
            data-at={e.at}
            data-since-lock={e.sinceLock ? "1" : "0"}
            className={e.sinceLock ? "bg-caution-soft/80" : undefined}
          >
            <td
              className="px-4 py-2 whitespace-nowrap tabular-nums"
              data-testid="cost-entry-date"
            >
              {utcDay(e.at)}
            </td>
            <td className="px-4 py-2">
              {e.planId ? (
                <a
                  href={`/app/jobs/${jobNumber}/plans/${e.planId}`}
                  className="font-medium underline hover:no-underline"
                  data-testid="cost-entry-plan-link"
                >
                  {e.crew ?? "Daily report"}
                </a>
              ) : (
                <span>{e.crew ?? (e.note || "Labor")}</span>
              )}
              {e.sinceLock ? (
                <span
                  className="ml-2 text-xs text-caution"
                  data-testid="cost-entry-pending"
                >
                  pending lock
                </span>
              ) : null}
            </td>
            <td className="px-4 py-2 text-right tabular-nums">
              {e.manHours.toLocaleString("en-US", {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}
            </td>
            <td className="px-4 py-2 text-right tabular-nums">
              {e.rateCents != null ? usdCents(e.rateCents) : "—"}
            </td>
            <td className="px-4 py-2 text-right tabular-nums">
              <Money cents={e.amountCents} exact />
            </td>
            <td className="px-4 py-2 text-muted-foreground">
              {e.approverName ?? "—"}
            </td>
          </tr>
        ) : (
          <tr
            key={e.id}
            data-testid="cost-entry-other"
            data-amount-cents={e.amountCents}
            data-at={e.at}
            data-since-lock={e.sinceLock ? "1" : "0"}
            className={e.sinceLock ? "bg-caution-soft/80" : undefined}
          >
            <td
              className="px-4 py-2 whitespace-nowrap tabular-nums"
              data-testid="cost-entry-date"
            >
              {utcDay(e.at)}
            </td>
            <td className="px-4 py-2" colSpan={3}>
              {e.note || "Other cost"}
              {e.sinceLock ? (
                <span
                  className="ml-2 text-xs text-caution"
                  data-testid="cost-entry-pending"
                >
                  pending lock
                </span>
              ) : null}
            </td>
            <td className="px-4 py-2 text-right tabular-nums">
              <Money cents={e.amountCents} exact />
            </td>
            <td className="px-4 py-2" />
          </tr>
        ),
      )}
    </>
  );
}

async function CostItem({
  params,
}: {
  params: Promise<{ number: string; code: string }>;
}) {
  const { number, code: rawCode } = await params;
  const code = decodeURIComponent(rawCode);
  const { user, data, timing: timingPayload } = await loadCostItemRoute(
    number,
    code,
  );
  if (!data) notFound();

  const canSetForecast =
    actions["costItem.setForecastMethod"].roles?.includes(user.role) ?? false;

  const installed =
    data.item.evMethod === "units"
      ? data.item.claimedInstalledQtyMilli
      : data.item.installedQtyMilli;

  const sinceLockEntries = data.entries.filter((e) => e.sinceLock);
  const throughLockEntries = data.entries.filter((e) => !e.sinceLock);
  const lockLabel = data.periodLabel ?? "last lock";
  const lockedPercent =
    data.rollup.budgetCents === 0
      ? 0
      : data.rollup.earnedCents / data.rollup.budgetCents;

  return (
    <>
      {/*
        Machine-readable server timing for burst scripts (Server-Timing on the
        document is owned by proxy middleware; RSC cannot set response headers).
        Use a hidden element — body <meta> is unreliable under streaming PPR.
      */}
      <div
        hidden
        data-testid="v5-timing"
        data-db-ms={timingPayload.dbMs}
        data-queries={timingPayload.queries}
        data-total-ms={timingPayload.totalMs}
      />
      <PageHeader
        title={`${data.item.code} ${data.item.description}`}
        meta={
          <>
            <a
              href={`/app/jobs/${data.job.number}`}
              className="underline hover:no-underline"
              data-testid="cost-item-back"
            >
              {data.job.number} · {data.job.name}
            </a>
            {" · "}
            {data.item.unit}
          </>
        }
      />
      <KpiStrip>
        <Kpi
          label="Current budget"
          value={<Money cents={data.rollup.budgetCents} exact />}
          testId="cost-item-cb"
        />
        <Kpi
          label="Earned value"
          value={<Money cents={data.rollup.earnedCents} exact />}
          testId="cost-item-ev"
        />
        <Kpi
          label="Actual cost"
          value={<Money cents={data.rollup.actualCents} exact />}
          sub={
            data.sinceLockCents > 0
              ? `${usdCents(data.sinceLockCents)} pending lock`
              : data.periodLabel
                ? `Through ${data.periodLabel} lock`
                : undefined
          }
          testId="cost-item-ac"
        />
        <Kpi
          label="EAC"
          value={<Money cents={data.forecast.eacCents} exact />}
          sub={data.forecast.forecastDerivation}
          testId="cost-item-eac"
        />
        <Kpi
          label="Installed"
          value={`${qty(installed)} ${data.item.unit}`}
          sub={`${qty(data.item.budgetQtyMilli)} budgeted`}
          testId="cost-item-installed"
        />
        <Kpi
          label="Earned MH"
          value={mh(data.earnedMhMilli)}
          testId="cost-item-earned-mh"
        />
        <Kpi
          label="Actual MH"
          value={mh(data.actualMhMilli)}
          sub={
            data.pendingMhMilli > 0
              ? `${mh(data.pendingMhMilli)} pending lock`
              : undefined
          }
          testId="cost-item-actual-mh"
        />
      </KpiStrip>

      <Section
        title="Forecast"
        meta={
          data.forecast.forecastFallback
            ? "Average Performance fell back to Current Budget (0% claimed)"
            : `Locked percent ${(lockedPercent * 100).toFixed(1)}% · method drives this item's EAC`
        }
      >
        <div
          className="flex flex-col gap-3 px-4 py-3"
          data-testid="cost-item-forecast"
          data-method={data.item.forecastMethod}
          data-eac-cents={data.forecast.eacCents}
          data-fallback={data.forecast.forecastFallback ? "1" : "0"}
          data-locked-ac-cents={data.rollup.actualCents}
          data-locked-percent={lockedPercent}
        >
          <ForecastMethodControl
            jobNumber={data.job.number}
            costItemId={data.item.id}
            code={data.item.code}
            method={data.item.forecastMethod}
            canEdit={canSetForecast}
          />
          <p
            className="text-xs text-muted-foreground"
            data-testid="forecast-derivation"
          >
            {data.forecast.forecastDerivation}
            {data.forecast.forecastFallback ? " · fallback" : ""}
          </p>
        </div>
      </Section>

      <Section
        title="Cost entries"
        meta={
          data.periodLabel
            ? `Newest first · Actual cost is through the ${data.periodLabel} lock; later posts stay pending until the next lock`
            : "Newest first · labor posts and invoices behind this item's actual cost"
        }
      >
        {!data.hasLaborEntries ? (
          <p
            className="border-b px-4 py-3 text-sm text-muted-foreground"
            data-testid="cost-item-empty-labor"
          >
            {EMPTY_LABOR}
          </p>
        ) : null}
        {data.entries.length === 0 ? null : (
          <div className="overflow-x-auto" data-testid="cost-item-entries">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Detail</th>
                  <th className="px-4 py-2 text-right font-medium">MH</th>
                  <th className="px-4 py-2 text-right font-medium">Rate</th>
                  <th className="px-4 py-2 text-right font-medium">Amount</th>
                  <th className="px-4 py-2 font-medium">Approver</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sinceLockEntries.length > 0 ? (
                  <>
                    <tr
                      className="bg-muted/40 text-xs text-muted-foreground"
                      data-testid="cost-entries-since-lock-heading"
                    >
                      <td className="px-4 py-2" colSpan={6}>
                        Posted since the {lockLabel} lock (pending)
                      </td>
                    </tr>
                    <EntryRows
                      entries={sinceLockEntries}
                      jobNumber={data.job.number}
                    />
                    <tr
                      className="border-b font-medium text-caution"
                      data-testid="cost-item-since-lock"
                      data-total-cents={data.sinceLockCents}
                    >
                      <td className="px-4 py-2" colSpan={4}>
                        Subtotal · since {lockLabel} lock
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        <Money cents={data.sinceLockCents} exact />
                      </td>
                      <td className="px-4 py-2" />
                    </tr>
                    {throughLockEntries.length > 0 ? (
                      <tr
                        className="bg-muted/40 text-xs text-muted-foreground"
                        data-testid="cost-entries-through-lock-heading"
                      >
                        <td className="px-4 py-2" colSpan={6}>
                          Through the {lockLabel} lock
                        </td>
                      </tr>
                    ) : null}
                  </>
                ) : null}
                <EntryRows
                  entries={throughLockEntries}
                  jobNumber={data.job.number}
                />
              </tbody>
              <tfoot>
                <tr
                  className="border-t-2 font-medium"
                  data-testid="cost-item-totals"
                  data-total-cents={data.postedTotalCents}
                >
                  <td className="px-4 py-2" colSpan={4}>
                    Total
                    {data.periodLabel
                      ? ` · through ${data.periodLabel} lock`
                      : ""}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    <Money cents={data.postedTotalCents} exact />
                  </td>
                  <td className="px-4 py-2" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Section>
    </>
  );
}

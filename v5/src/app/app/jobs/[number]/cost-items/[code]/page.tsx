import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ForecastMethodControl } from "@/components/app/forecast-method-control";
import { CostEntriesEmpty, type AppRole } from "@/components/app/list-empty";
import { Figure, Money, SHORT_MONEY_CENTS } from "@/components/app/format";
import {
  Kpi,
  KpiStrip,
  MetricCard,
  PageHeader,
  Section,
} from "@/components/app/page";
import { utcDay } from "@/lib/dates";
import { mh, qty, usdCents } from "@/lib/ev";
import { actions } from "@/server/assistant/actions";
import { getCostItemPage, type CostEntryRow } from "@/server/cost-item-page";
import { requireUser } from "@/server/session";

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

function EntryDetail({
  e,
  jobNumber,
  withTestIds = false,
}: {
  e: CostEntryRow;
  jobNumber: string;
  /**
   * Desktop table only for row-scoped testids (labor/other/pending/date).
   * `cost-entry-plan-link` is always set — Part C crawl check 4 filters by
   * visible client rects, so phone cards and the desktop table do not collide.
   */
  withTestIds?: boolean;
}) {
  if (e.kind === "labor") {
    // `crew-name` holds only the crew name. The plan link stays `cost-entry-plan-link`
    // because its fallback text is "Daily report". `contents` adds no box, so the
    // link's pixels stay the text node they were.
    const crewName =
      e.crew != null ? (
        <span data-testid="crew-name" className="contents">{e.crew}</span>
      ) : null;
    return (
      <>
        {e.planId ? (
          <a
            href={`/app/jobs/${jobNumber}/plans/${e.planId}`}
            className="tap-target inline-flex items-center font-medium underline hover:no-underline"
            data-testid="cost-entry-plan-link"
          >
            {crewName ?? "Daily report"}
          </a>
        ) : (
          <span data-testid={e.crew != null ? "crew-name" : undefined}>{e.crew ?? (e.note || "Labor")}</span>
        )}
        {e.sinceLock ? (
          <span
            data-text="label"
            className="ml-2 text-label text-caution"
            data-testid={withTestIds ? "cost-entry-pending" : undefined}
          >
            pending lock
          </span>
        ) : null}
      </>
    );
  }
  return (
    <>
      {e.note || "Other cost"}
      {e.sinceLock ? (
        <span
          data-text="label"
          className="ml-2 text-label text-caution"
          data-testid={withTestIds ? "cost-entry-pending" : undefined}
        >
          pending lock
        </span>
      ) : null}
    </>
  );
}

/** Desktop table rows — hidden on phones (5.0.4-e: no table on phones). */
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
              <EntryDetail e={e} jobNumber={jobNumber} withTestIds />
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
              <EntryDetail e={e} jobNumber={jobNumber} withTestIds />
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

/**
 * Phone stacked rows: amount primary; MH + rate always visible (5.0.4-e / PB-107).
 * No overflow-x scroller — key figures wrap; never hide behind sideways scroll.
 * Entry labor/other/date testids stay on the desktop table so e2e counts stay unique.
 */
function EntryCards({
  entries,
  jobNumber,
}: {
  entries: CostEntryRow[];
  jobNumber: string;
}) {
  return (
    <ul className="divide-y">
      {entries.map((e) => (
        <li
          key={e.id}
          data-card
          data-testid="cost-entry-card"
          data-kind={e.kind}
          data-amount-cents={e.amountCents}
          data-at={e.at}
          className={
            e.sinceLock ? "bg-caution-soft/80 px-4 py-3" : "px-4 py-3"
          }
        >
          <div
            data-text="label"
            className="text-label text-muted-foreground"
          >
            {utcDay(e.at)}
          </div>
          <div className="mt-0.5 min-w-0 text-body whitespace-normal">
            <EntryDetail e={e} jobNumber={jobNumber} />
          </div>
          <div
            data-text="label"
            className="mt-2 text-label font-medium text-muted-foreground"
          >
            Amount
          </div>
          <Figure
            variant="primary"
            className="mt-0.5 block"
            data-testid="cost-entry-card-amount"
          >
            <Money cents={e.amountCents} exact />
          </Figure>
          {e.kind === "labor" ? (
            <div className="mt-2 grid min-w-0 grid-cols-2 gap-x-3 gap-y-2">
              <div className="min-w-0">
                <div
                  data-text="label"
                  className="text-label text-muted-foreground"
                >
                  MH
                </div>
                <Figure
                  variant="secondary"
                  className="mt-0.5 block"
                  data-testid="cost-entry-card-mh"
                >
                  {e.manHours.toLocaleString("en-US", {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })}
                </Figure>
              </div>
              <div className="min-w-0">
                <div
                  data-text="label"
                  className="text-label text-muted-foreground"
                >
                  Rate
                </div>
                <Figure
                  variant="secondary"
                  className="mt-0.5 block"
                  data-testid="cost-entry-card-rate"
                >
                  {e.rateCents != null ? `${usdCents(e.rateCents)}/hr` : "—"}
                </Figure>
              </div>
            </div>
          ) : null}
          {e.kind === "labor" && e.approverName ? (
            <p
              data-text="label"
              className="mt-2 text-label text-muted-foreground"
            >
              {e.approverName}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

async function CostItem({
  params,
}: {
  params: Promise<{ number: string; code: string }>;
}) {
  const { number, code: rawCode } = await params;
  const code = decodeURIComponent(rawCode);
  const user = await requireUser();
  const data = await getCostItemPage(user.companyId, number, code);
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
      <PageHeader
        title={`${data.item.code} ${data.item.description}`}
        purpose="Every cost that makes up this item's actual cost, and its forecast."
        meta={
          <>
            <a
              href={`/app/jobs/${data.job.number}`}
              className="tap-target inline-flex items-center underline hover:no-underline"
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
        <MetricCard
          label="Estimate at completion (EAC)"
          value={
            <Money
              cents={data.forecast.eacCents}
              shortAboveCents={SHORT_MONEY_CENTS}
            />
          }
          secondary={[data.forecast.forecastDerivation]}
          testId="cost-item-eac"
        />
        <Kpi
          label="Current budget"
          value={
            <Money
              cents={data.rollup.budgetCents}
              shortAboveCents={SHORT_MONEY_CENTS}
            />
          }
          testId="cost-item-cb"
        />
        <Kpi
          label="Earned value (EV)"
          value={
            <Money
              cents={data.rollup.earnedCents}
              shortAboveCents={SHORT_MONEY_CENTS}
            />
          }
          testId="cost-item-ev"
        />
        <Kpi
          label="Actual cost (AC)"
          value={
            <Money
              cents={data.rollup.actualCents}
              shortAboveCents={SHORT_MONEY_CENTS}
            />
          }
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
            data-text="label"
            className="text-label text-muted-foreground"
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
        {data.entries.length === 0 ? (
          <CostEntriesEmpty
            role={user.role as AppRole}
            jobNumber={data.job.number}
            code={data.item.code}
          />
        ) : (
          <>
        {!data.hasLaborEntries ? (
          <p className="border-b px-4 py-3 text-body text-muted-foreground">
            Labor posts when the superintendent approves a daily report for
            this cost code.
          </p>
        ) : null}
            <div className="md:hidden" data-testid="cost-item-entries-cards">
              {sinceLockEntries.length > 0 ? (
                <p
                  data-text="label"
                  className="border-b bg-muted/40 px-4 py-2 text-label text-muted-foreground"
                >
                  Posted since the {lockLabel} lock (pending)
                </p>
              ) : null}
              <EntryCards
                entries={
                  sinceLockEntries.length > 0
                    ? sinceLockEntries
                    : throughLockEntries
                }
                jobNumber={data.job.number}
              />
              {sinceLockEntries.length > 0 ? (
                <>
                  <div
                    data-card
                    className="flex items-baseline justify-between gap-2 border-b px-4 py-3 text-caution"
                    data-total-cents={data.sinceLockCents}
                  >
                    <span data-text="label" className="text-label font-medium">
                      Subtotal · since {lockLabel} lock
                    </span>
                    <Figure variant="primary">
                      <Money cents={data.sinceLockCents} exact />
                    </Figure>
                  </div>
                  {throughLockEntries.length > 0 ? (
                    <>
                      <p
                        data-text="label"
                        className="border-b bg-muted/40 px-4 py-2 text-label text-muted-foreground"
                      >
                        Through the {lockLabel} lock
                      </p>
                      <EntryCards
                        entries={throughLockEntries}
                        jobNumber={data.job.number}
                      />
                    </>
                  ) : null}
                </>
              ) : null}
              <div
                data-card
                className="flex items-baseline justify-between gap-2 px-4 py-3"
                data-total-cents={data.postedTotalCents}
              >
                <span data-text="label" className="text-label font-medium">
                  Total
                  {data.periodLabel
                    ? ` · through ${data.periodLabel} lock`
                    : ""}
                </span>
                <Figure variant="primary">
                  <Money cents={data.postedTotalCents} exact />
                </Figure>
              </div>
            </div>

            {/*
              Desktop-only wide table. Phones use EntryCards (no overflow-x).
              data-scroll-x marks the intentional md+ scroller for verify rules.
            */}
            <div
              className="hidden overflow-x-auto md:block"
              data-testid="cost-item-entries"
              data-scroll-x
            >
              <table className="w-full min-w-[40rem] text-body">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th
                      data-text="label"
                      className="px-4 py-2 text-label font-medium"
                    >
                      Date
                    </th>
                    <th
                      data-text="label"
                      className="px-4 py-2 text-label font-medium"
                    >
                      Detail
                    </th>
                    <th
                      data-text="label"
                      className="px-4 py-2 text-right text-label font-medium"
                    >
                      MH
                    </th>
                    <th
                      data-text="label"
                      className="px-4 py-2 text-right text-label font-medium"
                    >
                      Rate
                    </th>
                    <th
                      data-text="label"
                      className="px-4 py-2 text-right text-label font-medium"
                    >
                      Amount
                    </th>
                    <th
                      data-text="label"
                      className="px-4 py-2 text-label font-medium"
                    >
                      Approver
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {sinceLockEntries.length > 0 ? (
                    <>
                      <tr
                        className="bg-muted/40 text-label text-muted-foreground"
                        data-testid="cost-entries-since-lock-heading"
                      >
                        <td className="px-4 py-2" colSpan={6} data-text="label">
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
                          className="bg-muted/40 text-label text-muted-foreground"
                          data-testid="cost-entries-through-lock-heading"
                        >
                          <td
                            className="px-4 py-2"
                            colSpan={6}
                            data-text="label"
                          >
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
          </>
        )}
      </Section>
    </>
  );
}

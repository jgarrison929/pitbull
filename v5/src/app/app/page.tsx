import Link from "next/link";
import { Suspense } from "react";
import { Assistant } from "@/components/app/assistant";
import { Kpi, KpiStrip, PageHeader, Section } from "@/components/app/page";
import { Money, StatusIndex } from "@/components/app/format";
import { NextSteps } from "@/components/app/next-steps";
import { PortfolioTable } from "@/components/app/portfolio-table";
import { usdCents, usdShort } from "@/lib/ev";
import { atRiskSummaryParts, showsCostIndexes } from "@/lib/role-fit";
import { getPortfolio } from "@/server/data";
import { getNextSteps } from "@/server/next-steps";
import { requireUser } from "@/server/session";

const PURPOSE =
  "Your next tasks across every job, then the portfolio.";

export default function PortfolioPage() {
  return (
    <Suspense fallback={<PortfolioSkeleton />}>
      <Portfolio />
    </Suspense>
  );
}

async function Portfolio() {
  const user = await requireUser();
  const [{ jobs, activeJobCount, totals, contractCents }, nextSteps] =
    await Promise.all([
      getPortfolio(user.companyId),
      getNextSteps(user),
    ]);
  // PageHeader owns the page title + purpose (5.0.4-b); NextSteps is untitled.
  const next = <NextSteps data={nextSteps} titled={false} />;
  const costIndexes = showsCostIndexes(user.role);
  const atRiskLines =
    user.role === "executive"
      ? jobs
          .filter((p) => !p.estimateDraft)
          .map((p) => {
            const parts = atRiskSummaryParts({
              shortName: p.job.shortName,
              number: p.job.number,
              cpi: p.cpi,
              spi: p.spi,
              costVarianceCents: p.costVarianceCents,
              scheduleVarianceCents: p.scheduleVarianceCents,
            });
            return parts
              ? { href: `/app/jobs/${p.job.number}`, ...parts }
              : null;
          })
          .filter(
            (row): row is { href: string; text: string; cents: number } =>
              row != null,
          )
      : [];

  if (user.role === "foreman") {
    // One PageHeader for all widths — phone/desktop must not each mount purpose.
    return (
      <>
        <PageHeader
          title="What needs you today"
          purpose={PURPOSE}
          meta={user.title}
        />
        <div
          className="flex flex-col gap-3 md:hidden"
          data-testid="foreman-phone"
        >
          {next}
          <Assistant variant="page" compact />
        </div>
        <div className="hidden md:contents">
          {next}
          <Section title="Jobs" meta="Active jobs and percent complete">
            <PortfolioTable jobs={jobs} role={user.role} />
          </Section>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="What needs you today"
        purpose={PURPOSE}
        meta={`${activeJobCount} active jobs · earned value to date`}
      />
      {next}
      {atRiskLines.length > 0 ? (
        <ul
          className="flex flex-col gap-2 text-sm max-[640px]:text-body"
          data-testid="at-risk-summary"
        >
          {atRiskLines.map((row) => (
            <li key={row.href}>
              <Link
                href={row.href}
                className="underline-offset-2 hover:underline max-[640px]:inline-flex max-[640px]:min-h-11 max-[640px]:items-center"
              >
                <AtRiskAmount text={row.text} cents={row.cents} />
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      <KpiStrip>
        <Kpi
          label="Contract value"
          value={<Money cents={contractCents} />}
          sub={`${activeJobCount} active jobs`}
          testId="kpi-contract"
        />
        <Kpi
          label="Earned to date"
          value={<Money cents={totals.earnedCents} />}
          sub={`vs ${usdShort(totals.plannedCents)} planned`}
          testId="kpi-earned"
        />
        {costIndexes ? (
          <>
            <Kpi
              label="Cost performance (CPI)"
              value={
                <StatusIndex
                  index={totals.cpi}
                  varianceCents={totals.costVarianceCents}
                />
              }
              sub="earned ÷ actual · cost variance"
              testId="kpi-cpi"
            />
            <Kpi
              label="Schedule performance (SPI)"
              value={
                <StatusIndex
                  index={totals.spi}
                  varianceCents={totals.scheduleVarianceCents}
                />
              }
              sub="earned ÷ planned · schedule variance"
              testId="kpi-spi"
            />
          </>
        ) : null}
      </KpiStrip>
      <Section
        id="jobs"
        title="Jobs"
        meta={
          costIndexes
            ? "EAC is the sum of each job's per-item forecasts · EV/AC/PV at last lock"
            : "Active jobs and percent complete"
        }
      >
        <PortfolioTable jobs={jobs} role={user.role} />
      </Section>
    </>
  );
}

function AtRiskAmount({ text, cents }: { text: string; cents: number }) {
  const short = usdShort(Math.abs(cents));
  const at = text.indexOf(short);
  if (at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <span className="tabular-nums" title={usdCents(cents)} data-cents={cents}>
        {short}
      </span>
      {text.slice(at + short.length)}
    </>
  );
}

function PortfolioSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true">
      <div className="h-7 w-40 animate-pulse rounded bg-muted" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-lg bg-muted" />
    </div>
  );
}

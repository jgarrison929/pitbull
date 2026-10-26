import Link from "next/link";
import { Suspense } from "react";
import { Assistant } from "@/components/app/assistant";
import { Kpi, KpiStrip, PageHeader, Section } from "@/components/app/page";
import { Money, StatusIndex } from "@/components/app/format";
import { NextSteps } from "@/components/app/next-steps";
import { PortfolioTable } from "@/components/app/portfolio-table";
import { usdShort } from "@/lib/ev";
import { atRiskSummaryLine, showsCostIndexes } from "@/lib/role-fit";
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
  const next = <NextSteps data={nextSteps} />;
  const costIndexes = showsCostIndexes(user.role);
  const atRiskLines =
    user.role === "executive"
      ? jobs
          .filter((p) => !p.estimateDraft)
          .map((p) => ({
            href: `/app/jobs/${p.job.number}`,
            text: atRiskSummaryLine({
              shortName: p.job.shortName,
              number: p.job.number,
              cpi: p.cpi,
              spi: p.spi,
              costVarianceCents: p.costVarianceCents,
              scheduleVarianceCents: p.scheduleVarianceCents,
            }),
          }))
          .filter(
            (row): row is { href: string; text: string } => row.text != null,
          )
      : [];

  const portfolio = (
    <>
      {next}
      <PageHeader
        title="What needs you today"
        purpose={PURPOSE}
        meta={`${activeJobCount} active jobs · earned value to date`}
      />
      {atRiskLines.length > 0 ? (
        <ul
          className="flex flex-col gap-2 text-sm"
          data-testid="at-risk-summary"
        >
          {atRiskLines.map((row) => (
            <li key={row.href}>
              <Link
                href={row.href}
                className="underline-offset-2 hover:underline"
              >
                {row.text}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {user.role !== "foreman" ? (
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
      ) : null}
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
  if (user.role !== "foreman") return portfolio;
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

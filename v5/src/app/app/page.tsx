import { Suspense } from "react";
import { Assistant } from "@/components/app/assistant";
import { Kpi, KpiStrip, PageHeader, Section } from "@/components/app/page";
import { Money, StatusIndex } from "@/components/app/format";
import { PortfolioTable } from "@/components/app/portfolio-table";
import { usdShort } from "@/lib/ev";
import { getPortfolio } from "@/server/data";
import { requireUser } from "@/server/session";

export default function PortfolioPage() {
  return (
    <Suspense fallback={<PortfolioSkeleton />}>
      <Portfolio />
    </Suspense>
  );
}

async function Portfolio() {
  const user = await requireUser();
  const { jobs, activeJobCount, totals, contractCents } = await getPortfolio(
    user.companyId,
  );
  const portfolio = (
    <>
      <PageHeader
        title="Portfolio"
        meta={`${activeJobCount} active jobs · earned value to date`}
      />
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
        <Kpi
          label="Portfolio CPI"
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
          label="Portfolio SPI"
          value={
            <StatusIndex
              index={totals.spi}
              varianceCents={totals.scheduleVarianceCents}
            />
          }
          sub="earned ÷ planned · schedule variance"
          testId="kpi-spi"
        />
      </KpiStrip>
      <Section
        title="Jobs"
        meta="EAC is the sum of each job's per-item forecasts · EV/AC/PV at last lock"
      >
        <PortfolioTable jobs={jobs} />
      </Section>
    </>
  );
  if (user.role !== "foreman") return portfolio;
  // A foreman on a phone gets the chat and voice view first; wider screens keep the portfolio.
  return (
    <>
      <div
        className="flex flex-col gap-3 md:hidden"
        data-testid="foreman-phone"
      >
        <PageHeader
          title={`Hi, ${user.name.split(" ")[0]}`}
          meta={user.title}
        />
        <Assistant variant="page" />
      </div>
      <div className="hidden md:contents">{portfolio}</div>
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

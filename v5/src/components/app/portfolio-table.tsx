import Link from "next/link";
import { pct } from "@/lib/ev";
import type { PortfolioJob } from "@/server/data";
import { Money, Progress, StatusIndex, StatusPill } from "./format";
import { Td, Th } from "./page";

function DraftLabel() {
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
      data-status="draft"
      data-testid="draft-label"
    >
      Draft
    </span>
  );
}

function MetricDash() {
  return (
    <span className="text-muted-foreground tabular-nums" data-testid="metric-dash">
      —
    </span>
  );
}

export function PortfolioTable({ jobs }: { jobs: PortfolioJob[] }) {
  return (
    <div data-testid="portfolio-table">
      {/*
        Wide 7-col table at md (768–820) can expand the page when the assistant
        rail is hidden. Cards through lg; full table from lg up. (#671)
        Draft rows show — / Draft label instead of $0 / fake CPI. (#675)
      */}
      <div className="hidden min-w-0 overflow-x-auto lg:block">
        {/*
          min-width keeps STATUS pills ("At risk", "Watch") and index columns
          whole under 5.0.4-c text-label/body — no "At ri" / "Wate" clip.
        */}
        <table className="w-full min-w-[68rem] text-sm">
          <thead>
            <tr className="border-b">
              <Th>Job</Th>
              <Th right>Contract</Th>
              <Th>Complete</Th>
              <Th right>CPI · cost var.</Th>
              <Th right>SPI · sched. var.</Th>
              <Th right>EAC</Th>
              <Th className="whitespace-nowrap">Status</Th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((p) => (
              <tr
                key={p.job.id}
                className="border-b last:border-0 hover:bg-muted/40"
                data-estimate={p.job.estimateStatus}
              >
                <Td>
                  <Link
                    href={`/app/jobs/${p.job.number}`}
                    className="font-medium hover:underline"
                    data-testid="job-link"
                  >
                    {p.job.name}
                  </Link>
                  <div className="whitespace-nowrap text-xs text-muted-foreground">
                    {p.job.number} · PM {p.job.pmName}
                  </div>
                </Td>
                <Td right>
                  <Money cents={p.job.contractCents} />
                </Td>
                <Td>
                  {p.estimateDraft ? (
                    <MetricDash />
                  ) : (
                    <div className="flex items-center gap-2">
                      <Progress value={p.percent} className="w-14" />
                      <span className="text-xs tabular-nums">{pct(p.percent)}</span>
                    </div>
                  )}
                </Td>
                <Td right>
                  {p.estimateDraft ? (
                    <MetricDash />
                  ) : (
                    <StatusIndex
                      index={p.cpi}
                      varianceCents={p.costVarianceCents}
                    />
                  )}
                </Td>
                <Td right>
                  {p.estimateDraft ? (
                    <MetricDash />
                  ) : (
                    <StatusIndex
                      index={p.spi}
                      varianceCents={p.scheduleVarianceCents}
                    />
                  )}
                </Td>
                <Td right>
                  {p.estimateDraft ? <MetricDash /> : <Money cents={p.eacCents} />}
                </Td>
                <Td className="whitespace-nowrap">
                  {p.estimateDraft ? (
                    <DraftLabel />
                  ) : (
                    <StatusPill value={p.status!} />
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="divide-y lg:hidden" data-testid="portfolio-cards">
        {jobs.map((p) => (
          <li key={p.job.id} data-estimate={p.job.estimateStatus}>
            <Link
              href={`/app/jobs/${p.job.number}`}
              className="flex flex-col gap-2 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium whitespace-normal">
                    {p.job.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {p.job.number} · PM {p.job.pmName}
                  </div>
                </div>
                {p.estimateDraft ? (
                  <DraftLabel />
                ) : (
                  <StatusPill value={p.status!} />
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <div className="text-muted-foreground">Done</div>
                  {p.estimateDraft ? <MetricDash /> : pct(p.percent)}
                </div>
                <div>
                  <div className="text-muted-foreground">CPI</div>
                  {p.estimateDraft ? (
                    <MetricDash />
                  ) : (
                    <StatusIndex
                      index={p.cpi}
                      varianceCents={p.costVarianceCents}
                    />
                  )}
                </div>
                <div>
                  <div className="text-muted-foreground">SPI</div>
                  {p.estimateDraft ? (
                    <MetricDash />
                  ) : (
                    <StatusIndex
                      index={p.spi}
                      varianceCents={p.scheduleVarianceCents}
                    />
                  )}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

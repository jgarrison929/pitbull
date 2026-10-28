import { pct } from "@/lib/ev";
import {
  showsCostIndexes,
  showsStatusRiskBadge,
} from "@/lib/role-fit";
import type { Role } from "@/server/session";
import type { PortfolioJob } from "@/server/data";
import { Figure, Money, Progress, StatusIndex, StatusPill } from "./format";
import { Td, Th } from "./page";

function DraftLabel() {
  return (
    <span
      data-text="label"
      className="inline-flex shrink-0 items-center rounded-full bg-muted px-2 py-0.5 text-label font-medium text-muted-foreground"
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

export function PortfolioTable({
  jobs,
  role,
}: {
  jobs: PortfolioJob[];
  role: Role;
}) {
  const costIndexes = showsCostIndexes(role);
  const statusBadge = showsStatusRiskBadge(role);
  // Superintendent phone cards lead with % done; cost roles lead with EAC.
  const percentPrimary = role === "superintendent";

  return (
    <div data-testid="portfolio-table">
      {/*
        Wide 7-col table at md (768–820) can expand the page when the assistant
        rail is hidden. Cards through lg; full table from lg up. (#671)
        Draft rows show — / Draft label instead of $0 / fake CPI. (#675)
        Role-fit (5.0.4-b): foreman and superintendent omit CPI/SPI columns.
        5.0.4-f: type scale + 44px taps on phone cards; desktop rail sizing
        unchanged so job visuals stay stable.
      */}
      <div className="hidden min-w-0 lg:block">
        {/*
          Short CPI/SPI/EAC/Status labels (not "Schedule performance…") so the
          desktop table fits the main column beside the assistant — full header
          text and STATUS pills ("At risk", "Watch"), no mid-word clip.
        */}
        <table className="w-full text-body">
          <thead>
            <tr className="border-b">
              <Th>Job</Th>
              <Th right>Contract</Th>
              <Th>Complete</Th>
              {costIndexes ? (
                <>
                  <Th right>CPI</Th>
                  <Th right>SPI</Th>
                  <Th right>EAC</Th>
                </>
              ) : null}
              {statusBadge ? <Th>Status</Th> : null}
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
                  <a
                    href={`/app/jobs/${p.job.number}`}
                    className="font-medium hover:underline"
                    data-testid="job-link"
                  >
                    {p.job.name}
                  </a>
                  <div
                    data-text="label"
                    className="whitespace-nowrap text-label text-muted-foreground"
                  >
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
                      <span
                        data-text="label"
                        className="text-label tabular-nums"
                      >
                        {pct(p.percent)}
                      </span>
                    </div>
                  )}
                </Td>
                {costIndexes ? (
                  <>
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
                      {p.estimateDraft ? (
                        <MetricDash />
                      ) : (
                        <Money cents={p.eacCents} />
                      )}
                    </Td>
                  </>
                ) : null}
                {statusBadge ? (
                  <Td className="whitespace-nowrap">
                    {p.estimateDraft ? (
                      <DraftLabel />
                    ) : (
                      <StatusPill value={p.status!} />
                    )}
                  </Td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="divide-y lg:hidden" data-testid="portfolio-cards">
        {jobs.map((p) => (
          <li
            key={p.job.id}
            data-card
            data-estimate={p.job.estimateStatus}
            className="py-1"
          >
            <a
              href={`/app/jobs/${p.job.number}`}
              className="tap-target flex flex-col gap-2 py-3"
              data-testid="job-link"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div
                    className="text-body font-medium whitespace-normal"
                    data-testid="job-name"
                  >
                    {p.job.name}
                  </div>
                  <div
                    data-text="label"
                    className="text-label text-muted-foreground"
                  >
                    {p.job.number} · PM {p.job.pmName}
                  </div>
                </div>
                {p.estimateDraft ? (
                  <DraftLabel />
                ) : statusBadge ? (
                  <StatusPill value={p.status!} />
                ) : null}
              </div>
              {p.estimateDraft ? (
                <div className="flex items-baseline gap-3">
                  <span
                    data-text="label"
                    className="text-label font-medium text-muted-foreground"
                  >
                    {percentPrimary || !costIndexes ? "Done" : "EAC"}
                  </span>
                  <MetricDash />
                </div>
              ) : percentPrimary || !costIndexes ? (
                <>
                  <div>
                    <div
                      data-text="label"
                      className="text-label font-medium text-muted-foreground"
                    >
                      Done
                    </div>
                    <Figure variant="primary" className="mt-0.5 block">
                      {pct(p.percent)}
                    </Figure>
                  </div>
                  {costIndexes ? (
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                      <Figure variant="secondary">
                        CPI{" "}
                        <StatusIndex
                          index={p.cpi}
                          varianceCents={p.costVarianceCents}
                        />
                      </Figure>
                      <Figure variant="secondary">
                        SPI{" "}
                        <StatusIndex
                          index={p.spi}
                          varianceCents={p.scheduleVarianceCents}
                        />
                      </Figure>
                    </div>
                  ) : null}
                </>
              ) : (
                <>
                  <div>
                    <div
                      data-text="label"
                      className="text-label font-medium text-muted-foreground"
                    >
                      EAC
                    </div>
                    <Figure variant="primary" className="mt-0.5 block">
                      <Money cents={p.eacCents} />
                    </Figure>
                  </div>
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                    <Figure variant="secondary">Done {pct(p.percent)}</Figure>
                    <Figure variant="secondary">
                      CPI{" "}
                      <StatusIndex
                        index={p.cpi}
                        varianceCents={p.costVarianceCents}
                      />
                    </Figure>
                  </div>
                </>
              )}
            </a>
            {!p.estimateDraft && costIndexes && !percentPrimary ? (
              <details className="pb-2">
                <summary
                  data-text="label"
                  className="tap-target flex cursor-pointer list-none items-center text-label font-medium text-muted-foreground [&::-webkit-details-marker]:hidden"
                >
                  More metrics
                </summary>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 pt-1 text-body">
                  <Figure variant="secondary">
                    SPI{" "}
                    <StatusIndex
                      index={p.spi}
                      varianceCents={p.scheduleVarianceCents}
                    />
                  </Figure>
                  <Figure variant="secondary">
                    Contract <Money cents={p.job.contractCents} />
                  </Figure>
                </div>
              </details>
            ) : null}
            {!p.estimateDraft && percentPrimary ? (
              <details className="pb-2">
                <summary
                  data-text="label"
                  className="tap-target flex cursor-pointer list-none items-center text-label font-medium text-muted-foreground [&::-webkit-details-marker]:hidden"
                >
                  More metrics
                </summary>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 pt-1 text-body">
                  {costIndexes ? (
                    <Figure variant="secondary">
                      EAC <Money cents={p.eacCents} />
                    </Figure>
                  ) : null}
                  <Figure variant="secondary">
                    Contract <Money cents={p.job.contractCents} />
                  </Figure>
                </div>
              </details>
            ) : null}
            {!p.estimateDraft && !costIndexes && !percentPrimary ? (
              <details className="pb-2">
                <summary
                  data-text="label"
                  className="tap-target flex cursor-pointer list-none items-center text-label font-medium text-muted-foreground [&::-webkit-details-marker]:hidden"
                >
                  More metrics
                </summary>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 pt-1 text-body">
                  <Figure variant="secondary">
                    Contract <Money cents={p.job.contractCents} />
                  </Figure>
                </div>
              </details>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

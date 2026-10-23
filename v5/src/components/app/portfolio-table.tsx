import Link from "next/link";
import { pct } from "@/lib/ev";
import type { PortfolioJob } from "@/server/data";
import { Money, Progress, StatusIndex, StatusPill } from "./format";
import { Td, Th } from "./page";

export function PortfolioTable({ jobs }: { jobs: PortfolioJob[] }) {
  return (
    <div data-testid="portfolio-table">
      {/*
        Wide 7-col table at md (768–820) can expand the page when the assistant
        rail is hidden. Cards through lg; full table from lg up.
      */}
      <div className="hidden min-w-0 overflow-x-auto lg:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <Th>Job</Th>
              <Th right>Contract</Th>
              <Th>Complete</Th>
              <Th right>CPI · cost var.</Th>
              <Th right>SPI · sched. var.</Th>
              <Th right>EAC</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((p) => (
              <tr
                key={p.job.id}
                className="border-b last:border-0 hover:bg-muted/40"
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
                  <div className="flex items-center gap-2">
                    <Progress value={p.percent} className="w-14" />
                    <span className="text-xs tabular-nums">{pct(p.percent)}</span>
                  </div>
                </Td>
                <Td right>
                  <StatusIndex
                    index={p.cpi}
                    varianceCents={p.costVarianceCents}
                  />
                </Td>
                <Td right>
                  <StatusIndex
                    index={p.spi}
                    varianceCents={p.scheduleVarianceCents}
                  />
                </Td>
                <Td right>
                  <Money cents={p.eacCents} />
                </Td>
                <Td>
                  <StatusPill value={p.status} />
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="divide-y lg:hidden" data-testid="portfolio-cards">
        {jobs.map((p) => (
          <li key={p.job.id}>
            <Link
              href={`/app/jobs/${p.job.number}`}
              className="flex flex-col gap-2 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-medium">{p.job.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.job.number} · PM {p.job.pmName}
                  </div>
                </div>
                <StatusPill value={p.status} />
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <div className="text-muted-foreground">Done</div>
                  {pct(p.percent)}
                </div>
                <div>
                  <div className="text-muted-foreground">CPI</div>
                  <StatusIndex
                    index={p.cpi}
                    varianceCents={p.costVarianceCents}
                  />
                </div>
                <div>
                  <div className="text-muted-foreground">SPI</div>
                  <StatusIndex
                    index={p.spi}
                    varianceCents={p.scheduleVarianceCents}
                  />
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

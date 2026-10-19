import Link from "next/link";
import { pct } from "@/lib/ev";
import type { PortfolioJob } from "@/server/data";
import { HealthPill, IndexValue, Money, Progress } from "./format";
import { Td, Th } from "./page";

export function PortfolioTable({ jobs }: { jobs: PortfolioJob[] }) {
  return (
    <div data-testid="portfolio-table">
      <table className="hidden w-full text-sm md:table">
        <thead>
          <tr className="border-b">
            <Th>Job</Th>
            <Th right>Contract</Th>
            <Th>Complete</Th>
            <Th right>Cost var.</Th>
            <Th right>CPI</Th>
            <Th right>SPI</Th>
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
                <Money cents={p.costVarianceCents} signed />
              </Td>
              <Td right>
                <IndexValue value={p.cpi} />
              </Td>
              <Td right>
                <IndexValue value={p.spi} />
              </Td>
              <Td right>
                <Money cents={p.eacCents} />
              </Td>
              <Td>
                <HealthPill value={p.status} />
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="divide-y md:hidden">
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
                <HealthPill value={p.status} />
              </div>
              <div className="grid grid-cols-4 gap-2 text-xs">
                <div>
                  <div className="text-muted-foreground">Done</div>
                  {pct(p.percent)}
                </div>
                <div>
                  <div className="text-muted-foreground">CPI</div>
                  <IndexValue value={p.cpi} />
                </div>
                <div>
                  <div className="text-muted-foreground">SPI</div>
                  <IndexValue value={p.spi} />
                </div>
                <div>
                  <div className="text-muted-foreground">Cost var.</div>
                  <Money cents={p.costVarianceCents} signed />
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

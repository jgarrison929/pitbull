import type { CostLine } from "@/lib/ev";
import { pct, qty, rollup } from "@/lib/ev";
import { cn } from "@/lib/utils";
import { Money, Progress, StatusIndex } from "./format";
import { varianceStatus } from "@/lib/status";
import { Td, Th } from "./page";

const hot = (l: CostLine) =>
  varianceStatus(l.cpi, l.varianceCents) === "at-risk";

/** Budget vs earned value by cost code. A table from md up; stacked rows on phones, so nothing scrolls sideways. */
export function CostTable({ lines }: { lines: CostLine[] }) {
  const t = rollup(lines);
  return (
    <div data-testid="cost-table">
      <table className="hidden w-full text-sm md:table">
        <thead>
          <tr className="border-b">
            <Th>Cost code</Th>
            <Th right>Installed</Th>
            <Th>% complete</Th>
            <Th right>Budget</Th>
            <Th right>Earned</Th>
            <Th right>Actual</Th>
            <Th right>CPI · variance</Th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr
              key={l.code}
              className={cn(
                "border-b last:border-0",
                hot(l) && "bg-negative-soft/60",
              )}
            >
              <Td>
                <div className="whitespace-nowrap">
                  <span className="mr-2 font-mono text-xs text-muted-foreground">
                    {l.code}
                  </span>
                  <span className="font-medium">{l.description}</span>
                </div>
                <div
                  className="mt-0.5 text-xs text-muted-foreground"
                  data-testid="earn-derivation"
                >
                  {l.earnDerivation || `${l.evMethod} method`}
                </div>
              </Td>
              <Td
                right
                className="whitespace-nowrap text-xs tabular-nums text-muted-foreground"
              >
                {qty(l.installedQtyMilli)} / {qty(l.budgetQtyMilli)} {l.unit}
              </Td>
              <Td>
                <div className="flex items-center gap-2">
                  <Progress value={l.percent} className="w-16" />
                  <span className="w-9 text-xs tabular-nums">
                    {pct(l.percent)}
                  </span>
                </div>
              </Td>
              <Td right>
                <Money cents={l.budgetCents} />
              </Td>
              <Td right>
                <Money cents={l.earnedCents} />
              </Td>
              <Td right>
                <Money cents={l.actualCents} />
              </Td>
              <Td right>
                <StatusIndex index={l.cpi} varianceCents={l.varianceCents} />
              </Td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 font-medium">
            <Td>Job total</Td>
            <Td />
            <Td className="text-xs tabular-nums">{pct(t.percent)}</Td>
            <Td right>
              <Money cents={t.budgetCents} />
            </Td>
            <Td right>
              <Money cents={t.earnedCents} />
            </Td>
            <Td right>
              <Money cents={t.actualCents} />
            </Td>
            <Td right>
              <StatusIndex index={t.cpi} varianceCents={t.costVarianceCents} />
            </Td>
          </tr>
        </tfoot>
      </table>

      <ul className="divide-y md:hidden" data-testid="cost-list">
        {lines.map((l) => (
          <li
            key={l.code}
            className={cn(
              "flex flex-col gap-1.5 py-3",
              hot(l) && "-mx-4 bg-negative-soft/60 px-4",
            )}
          >
            <div className="flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <span className="mr-1.5 font-mono text-xs text-muted-foreground">
                  {l.code}
                </span>
                <span className="font-medium">{l.description}</span>
                <div
                  className="mt-0.5 text-xs font-normal text-muted-foreground"
                  data-testid="earn-derivation"
                >
                  {l.earnDerivation || `${l.evMethod} method`}
                </div>
              </div>
              <StatusIndex index={l.cpi} varianceCents={l.varianceCents} />
            </div>
            <div className="flex items-center gap-2">
              <Progress value={l.percent} className="flex-1" />
              <span className="w-24 text-right text-xs tabular-nums text-muted-foreground">
                {pct(l.percent)} of {qty(l.budgetQtyMilli)} {l.unit}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <div className="text-muted-foreground">Earned</div>
                <Money cents={l.earnedCents} />
              </div>
              <div>
                <div className="text-muted-foreground">Actual</div>
                <Money cents={l.actualCents} />
              </div>
              <div className="text-right">
                <div className="text-muted-foreground">Budget</div>
                <Money cents={l.budgetCents} />
              </div>
            </div>
          </li>
        ))}
        <li className="flex items-center justify-between py-3 text-sm font-medium">
          <span>Job total · {pct(t.percent)}</span>
          <span>
            CPI{" "}
            <StatusIndex index={t.cpi} varianceCents={t.costVarianceCents} />
          </span>
        </li>
      </ul>
    </div>
  );
}

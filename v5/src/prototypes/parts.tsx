import { cn } from "@/lib/utils";
import {
  actions,
  costRow,
  dailyPlan,
  focusJobId,
  health,
  idx,
  jobs,
  pct,
  planCheck,
  qty,
  usdShort,
  type CostRow,
  type Health,
} from "./scenario";

const healthStyle: Record<
  Health,
  { label: string; dot: string; pill: string }
> = {
  "on-track": {
    label: "On track",
    dot: "bg-emerald-500",
    pill: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  },
  watch: {
    label: "Watch",
    dot: "bg-amber-500",
    pill: "bg-amber-50 text-amber-800 ring-amber-600/20",
  },
  "at-risk": {
    label: "At risk",
    dot: "bg-rose-500",
    pill: "bg-rose-50 text-rose-700 ring-rose-600/20",
  },
};

export function HealthPill({
  value,
  className,
}: {
  value: Health;
  className?: string;
}) {
  const s = healthStyle[value];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        s.pill,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}

export function IndexValue({ value }: { value: number | null }) {
  const tone =
    value === null
      ? "text-muted-foreground"
      : value >= 0.98
        ? "text-emerald-700"
        : value >= 0.93
          ? "text-amber-700"
          : "text-rose-700";
  return <span className={cn("tabular-nums", tone)}>{idx(value)}</span>;
}

export function Money({
  value,
  signed = false,
}: {
  value: number;
  signed?: boolean;
}) {
  const tone = signed
    ? value < 0
      ? "text-rose-700"
      : value > 0
        ? "text-emerald-700"
        : ""
    : "";
  return (
    <span className={cn("whitespace-nowrap tabular-nums", tone)}>
      {signed && value > 0 ? "+" : ""}
      {usdShort(value)}
    </span>
  );
}

export function Progress({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "h-1.5 w-full overflow-hidden rounded-full bg-muted",
        className,
      )}
    >
      <div
        className="h-full rounded-full bg-slate-800"
        style={{ width: `${Math.min(100, value * 100)}%` }}
      />
    </div>
  );
}

export const portfolio = () =>
  actions["portfolio.summary"]().map((p) => ({
    ...p,
    status: health(Math.min(p.cpi, p.spi)),
  }));

export const focusJob = jobs.find((j) => j.id === focusJobId)!;
export const focusRows = (): CostRow[] =>
  actions["job.costVariance"](focusJobId);
export const codeOrderRows = (): CostRow[] =>
  focusRows()
    .slice()
    .sort((a, b) => a.code.localeCompare(b.code));

export function portfolioTotals() {
  const p = portfolio();
  const sum = (k: "contract" | "ev" | "ac" | "pv") =>
    p.reduce((s, x) => s + x.job[k], 0);
  return {
    contract: sum("contract"),
    ev: sum("ev"),
    ac: sum("ac"),
    pv: sum("pv"),
    cpi: sum("ev") / sum("ac"),
    spi: sum("ev") / sum("pv"),
  };
}

/** Dense portfolio table; becomes stacked rows under md. */
export function PortfolioTable({
  highlight,
  eac = true,
}: {
  highlight?: string;
  eac?: boolean;
}) {
  const rows = portfolio();
  return (
    <div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <th className="py-2 pr-3 font-medium">Job</th>
              <th className="px-2.5 py-2 text-right font-medium">Contract</th>
              <th className="px-2.5 py-2 font-medium">Complete</th>
              <th className="whitespace-nowrap px-2.5 py-2 text-right font-medium">
                Cost var.
              </th>
              <th className="px-2.5 py-2 text-right font-medium">CPI</th>
              <th className="px-2.5 py-2 text-right font-medium">SPI</th>
              {eac && (
                <th className="px-2.5 py-2 text-right font-medium">EAC</th>
              )}
              <th className="py-2 pl-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(
              ({
                job,
                cpi,
                spi,
                percent,
                costVariance,
                eac: eacValue,
                status,
              }) => (
                <tr
                  key={job.id}
                  className={cn(
                    "border-b last:border-0",
                    highlight === job.id && "bg-amber-50/60",
                  )}
                >
                  <td className="py-2.5 pr-3">
                    <div className="whitespace-nowrap font-medium">
                      {job.name}
                    </div>
                    <div className="whitespace-nowrap text-xs text-muted-foreground">
                      {job.number} · PM {job.pm}
                    </div>
                  </td>
                  <td className="px-2.5 py-2.5 text-right">
                    <Money value={job.contract} />
                  </td>
                  <td className="px-2.5 py-2.5">
                    <div className="flex items-center gap-2">
                      <Progress value={percent} className="w-12" />
                      <span className="text-xs tabular-nums">
                        {pct(percent)}
                      </span>
                    </div>
                  </td>
                  <td className="px-2.5 py-2.5 text-right">
                    <Money value={costVariance} signed />
                  </td>
                  <td className="px-2.5 py-2.5 text-right">
                    <IndexValue value={cpi} />
                  </td>
                  <td className="px-2.5 py-2.5 text-right">
                    <IndexValue value={spi} />
                  </td>
                  {eac && (
                    <td className="px-2.5 py-2.5 text-right">
                      <Money value={eacValue} />
                    </td>
                  )}
                  <td className="py-2.5 pl-3">
                    <HealthPill value={status} />
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
      <ul className="divide-y md:hidden">
        {rows.map(({ job, cpi, spi, percent, costVariance, status }) => (
          <li key={job.id} className="py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-medium">{job.name}</div>
                <div className="text-xs text-muted-foreground">
                  {job.number} · PM {job.pm}
                </div>
              </div>
              <HealthPill value={status} />
            </div>
            <div className="mt-2 grid grid-cols-4 gap-2 text-xs">
              <Stat
                label="Done"
                value={<span className="font-mono">{pct(percent)}</span>}
              />
              <Stat label="CPI" value={<IndexValue value={cpi} />} />
              <Stat label="SPI" value={<IndexValue value={spi} />} />
              <Stat
                label="Cost var."
                value={<Money value={costVariance} signed />}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-muted-foreground">{label}</div>
      <div>{value}</div>
    </div>
  );
}

/** Budget vs earned value by cost code for the focus job. */
export function CostTable({
  rows = codeOrderRows(),
  limit,
  compact = false,
}: {
  rows?: CostRow[];
  limit?: number;
  compact?: boolean;
}) {
  const shown = limit ? rows.slice(0, limit) : rows;
  const total = rows.reduce(
    (s, r) => ({
      budget: s.budget + r.budgetCost,
      earned: s.earned + r.earned,
      actual: s.actual + r.actualCost,
    }),
    { budget: 0, earned: 0, actual: 0 },
  );
  return (
    <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <th className="sticky left-0 bg-inherit py-2 pr-3 font-medium">
              Cost code
            </th>
            {!compact && (
              <th className="px-3 py-2 text-right font-medium">Installed</th>
            )}
            <th className="px-3 py-2 font-medium">% complete</th>
            <th className="px-3 py-2 text-right font-medium">Budget</th>
            <th className="px-3 py-2 text-right font-medium">Earned</th>
            <th className="px-3 py-2 text-right font-medium">Actual</th>
            <th className="px-3 py-2 text-right font-medium">Variance</th>
            <th className="py-2 pl-3 text-right font-medium">CPI</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr
              key={r.code}
              className={cn(
                "border-b last:border-0",
                r.cpi !== null && r.cpi < 0.8 && "bg-rose-50/50",
              )}
            >
              <td className="whitespace-nowrap py-2 pr-3">
                <span className="mr-2 font-mono text-xs text-muted-foreground">
                  {r.code}
                </span>
                <span className="font-medium">{r.description}</span>
              </td>
              {!compact && (
                <td className="whitespace-nowrap px-3 py-2 text-right text-xs tabular-nums text-muted-foreground">
                  {qty(r.installedQty)} / {qty(r.budgetQty)} {r.unit}
                </td>
              )}
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <Progress value={r.percent} className="w-16" />
                  <span className="w-9 text-xs tabular-nums">
                    {pct(r.percent)}
                  </span>
                </div>
              </td>
              <td className="px-3 py-2 text-right">
                <Money value={r.budgetCost} />
              </td>
              <td className="px-3 py-2 text-right">
                <Money value={r.earned} />
              </td>
              <td className="px-3 py-2 text-right">
                <Money value={r.actualCost} />
              </td>
              <td className="px-3 py-2 text-right">
                <Money value={r.variance} signed />
              </td>
              <td className="py-2 pl-3 text-right">
                <IndexValue value={r.cpi} />
              </td>
            </tr>
          ))}
        </tbody>
        {!limit && (
          <tfoot>
            <tr className="border-t-2 font-medium">
              <td className="py-2 pr-3">Job total</td>
              {!compact && <td />}
              <td className="px-3 py-2 font-mono text-xs">
                {pct(total.earned / total.budget)}
              </td>
              <td className="px-3 py-2 text-right">
                <Money value={total.budget} />
              </td>
              <td className="px-3 py-2 text-right">
                <Money value={total.earned} />
              </td>
              <td className="px-3 py-2 text-right">
                <Money value={total.actual} />
              </td>
              <td className="px-3 py-2 text-right">
                <Money value={total.earned - total.actual} signed />
              </td>
              <td className="py-2 pl-3 text-right">
                <IndexValue value={total.earned / total.actual} />
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

/** The foreman's plan for tomorrow, with each line checked against its budgeted unit rate. */
export function PlanLines({ editable = false }: { editable?: boolean }) {
  return (
    <ul className="divide-y">
      {dailyPlan.lines.map((l) => {
        const c = planCheck(l);
        return (
          <li
            key={l.code}
            className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 py-2.5 text-sm"
          >
            <div className="min-w-0">
              <div className="font-medium">
                <span className="mr-2 font-mono text-xs text-muted-foreground">
                  {l.code}
                </span>
                {l.activity}
              </div>
              <div className="text-xs text-muted-foreground">
                {l.location} · {c.description}
              </div>
            </div>
            <div className="text-right">
              {editable ? (
                <span className="inline-flex items-center gap-1">
                  <input
                    aria-label={`${l.activity} quantity`}
                    defaultValue={qty(l.qty)}
                    className="w-20 rounded-md border bg-background px-2 py-1 text-right font-mono text-sm tabular-nums"
                  />
                  <span className="w-8 text-left text-xs text-muted-foreground">
                    {l.unit}
                  </span>
                </span>
              ) : (
                <span className="font-mono tabular-nums">
                  {qty(l.qty)} {l.unit}
                </span>
              )}
            </div>
            <div className="col-span-2 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
              <span>
                {l.crew} {l.crew === 1 ? "worker" : "workers"} × {l.hours} h ={" "}
                <span className="font-mono text-foreground">
                  {c.manHours} MH
                </span>
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1",
                  c.ok ? "text-emerald-700" : "text-rose-700",
                )}
              >
                {c.ok ? "Within" : "Over"} budget rate (
                {c.planned.toPrecision(2)} vs {c.budget} MH/{l.unit})
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function PlanEquipment() {
  return (
    <ul className="flex flex-wrap gap-2 text-xs">
      {dailyPlan.equipment.map((e) => (
        <li key={e.name} className="rounded-md border px-2 py-1">
          {e.name}{" "}
          <span className="font-mono text-muted-foreground">{e.hours} h</span>
        </li>
      ))}
    </ul>
  );
}

export const planManHours = () =>
  dailyPlan.lines.reduce((s, l) => s + l.crew * l.hours, 0);
export { costRow };

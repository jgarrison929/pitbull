import {
  Bell,
  Briefcase,
  CalendarDays,
  ChartColumn,
  ClipboardList,
  FileText,
  HardHat,
  LayoutDashboard,
  Menu,
  Search,
  Settings,
  Truck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CostTable,
  Money,
  PlanEquipment,
  PlanLines,
  PortfolioTable,
  focusJob,
  planManHours,
  portfolioTotals,
} from "./parts";
import { AS_OF, COMPANY, dailyPlan, idx, jobMetrics, pct } from "./scenario";
import { DemoButton } from "./demo-button";

const nav = [
  { icon: LayoutDashboard, label: "Portfolio", active: true },
  { icon: Briefcase, label: "Jobs" },
  { icon: ChartColumn, label: "Cost & EV" },
  { icon: ClipboardList, label: "Daily plans" },
  { icon: FileText, label: "Change orders" },
  { icon: Truck, label: "Equipment" },
  { icon: HardHat, label: "Crews" },
];

function Panel({
  title,
  meta,
  children,
  className,
  action,
}: {
  title: string;
  meta?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <section className={cn("rounded-lg border bg-white", className)}>
      <header className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">{title}</h2>
          {meta && (
            <p className="truncate text-xs text-muted-foreground">{meta}</p>
          )}
        </div>
        {action}
      </header>
      <div className="px-4 py-1">{children}</div>
    </section>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  sub: string;
  tone?: "bad" | "good";
}) {
  return (
    <div className="rounded-lg border bg-white px-4 py-3">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div
        className={cn(
          "mt-1 text-xl font-semibold tabular-nums",
          tone === "bad" && "text-rose-700",
          tone === "good" && "text-emerald-700",
        )}
      >
        {value}
      </div>
      <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

function PlanPanel() {
  return (
    <Panel
      title="Daily plan"
      meta={`${dailyPlan.crew} · ${dailyPlan.foreman} · ${dailyPlan.date}`}
      action={<CalendarDays className="size-4 text-muted-foreground" />}
    >
      <PlanLines editable />
      <div className="flex flex-col gap-3 border-t py-3">
        <PlanEquipment />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{dailyPlan.weather}</span>
          <span className="font-mono text-foreground">
            {planManHours()} MH planned
          </span>
        </div>
        <DemoButton done="Plan submitted (demo)">Submit plan</DemoButton>
      </div>
    </Panel>
  );
}

export function ScreenShell() {
  const t = portfolioTotals();
  const m = jobMetrics(focusJob);
  return (
    <div className="flex min-h-[calc(100vh-33px)] bg-slate-50 text-slate-900">
      <aside className="hidden w-56 shrink-0 flex-col border-r bg-white md:flex">
        <div className="flex items-center gap-2 px-4 py-4">
          <div className="grid size-7 place-items-center rounded-md bg-slate-900 text-xs font-bold text-amber-400">
            P
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">Pitbull</div>
            <div className="text-[11px] text-muted-foreground">{COMPANY}</div>
          </div>
        </div>
        <nav className="flex flex-col gap-0.5 px-2 text-sm">
          {nav.map(({ icon: Icon, label, active }) => (
            <span
              key={label}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-1.5",
                active
                  ? "bg-slate-100 font-medium"
                  : "text-slate-600 hover:bg-slate-50",
              )}
            >
              <Icon className="size-4" />
              {label}
            </span>
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-2 border-t px-4 py-3 text-xs text-muted-foreground">
          <Settings className="size-4" /> Settings
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b bg-white px-4 py-2.5">
          <Menu className="size-5 md:hidden" aria-label="Menu" />
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              placeholder="Search jobs, cost codes, crews"
              className="w-full rounded-md border bg-slate-50 py-1.5 pl-8 pr-3 text-sm"
            />
          </div>
          <span className="ml-auto hidden text-xs text-muted-foreground sm:inline">
            Data as of {AS_OF}
          </span>
          <Bell className="size-4 text-muted-foreground" />
          <div className="grid size-7 place-items-center rounded-full bg-slate-200 text-xs font-medium">
            JG
          </div>
        </header>

        <main className="flex flex-col gap-4 p-4 md:p-6">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h1 className="text-lg font-semibold">Portfolio</h1>
              <p className="text-sm text-muted-foreground">
                3 active jobs · heavy civil · Region North
              </p>
            </div>
            <div className="flex gap-2">
              <DemoButton variant="outline" done="Exported (demo)">
                Export
              </DemoButton>
              <DemoButton done="Snapshot saved (demo)">
                Save snapshot
              </DemoButton>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi
              label="Contract value"
              value={<Money value={t.contract} />}
              sub="3 jobs"
            />
            <Kpi
              label="Earned to date"
              value={<Money value={t.ev} />}
              sub={`vs ${new Intl.NumberFormat("en-US", { notation: "compact", style: "currency", currency: "USD" }).format(t.pv)} planned`}
            />
            <Kpi
              label="Portfolio CPI"
              value={idx(t.cpi)}
              sub="earned ÷ actual cost"
              tone={t.cpi < 0.98 ? "bad" : "good"}
            />
            <Kpi
              label="Portfolio SPI"
              value={idx(t.spi)}
              sub="earned ÷ planned"
              tone={t.spi < 0.98 ? "bad" : "good"}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
            <Panel title="Jobs" meta="Earned value to date">
              <PortfolioTable highlight={focusJob.id} eac={false} />
            </Panel>
            <PlanPanel />
          </div>

          <Panel
            title={`${focusJob.number} ${focusJob.name}`}
            meta={`Budget vs earned value by cost code · CPI ${idx(m.cpi)} · ${pct(m.percent)} complete · EAC ${new Intl.NumberFormat("en-US", { notation: "compact", style: "currency", currency: "USD" }).format(m.eac)}`}
          >
            <CostTable />
          </Panel>
        </main>
      </div>
    </div>
  );
}

import {
  Briefcase,
  Check,
  ChartColumn,
  ClipboardList,
  Command,
  FileText,
  LayoutDashboard,
  Mic,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CostTable,
  HealthPill,
  IndexValue,
  Money,
  PlanEquipment,
  PlanLines,
  focusJob,
  focusRows,
  planManHours,
  portfolio,
} from "./parts";
import { AS_OF, dailyPlan, idx, jobMetrics, pct, usdShort } from "./scenario";
import { DemoButton } from "./demo-button";

const rail = [LayoutDashboard, Briefcase, ChartColumn, ClipboardList, FileText];

function LogEntry({
  who,
  text,
  action,
  time,
}: {
  who: "you" | "assistant";
  text: string;
  action?: string;
  time: string;
}) {
  return (
    <li className="flex gap-2.5">
      <div
        className={cn(
          "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-semibold",
          who === "you"
            ? "bg-slate-200 text-slate-700"
            : "bg-amber-400 text-slate-950",
        )}
      >
        {who === "you" ? "JG" : <Sparkles className="size-3" />}
      </div>
      <div className="min-w-0 flex-1 text-xs">
        <div className="text-slate-800">{text}</div>
        {action && (
          <div className="mt-1 truncate font-mono text-[10.5px] text-slate-500">
            {action}
          </div>
        )}
        <div className="mt-0.5 text-[10.5px] text-slate-400">{time}</div>
      </div>
    </li>
  );
}

export function HybridShell() {
  const jobs = portfolio();
  const m = jobMetrics(focusJob);
  const worst = focusRows()[0];
  return (
    <div className="flex min-h-[calc(100vh-33px)] bg-white text-slate-900">
      <aside className="hidden w-14 shrink-0 flex-col items-center gap-1 border-r bg-slate-950 py-3 md:flex">
        <div className="mb-3 grid size-8 place-items-center rounded-md bg-amber-400 text-xs font-bold text-slate-950">
          P
        </div>
        {rail.map((Icon, i) => (
          <span
            key={i}
            className={cn(
              "grid size-9 place-items-center rounded-md text-slate-400",
              i === 1 && "bg-slate-800 text-white",
            )}
          >
            <Icon className="size-4" />
          </span>
        ))}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b px-4 py-2.5">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border bg-slate-50 px-3 py-1.5 text-sm text-muted-foreground">
            <Command className="size-4 shrink-0" />
            <span className="truncate">
              Search, jump, or ask: &ldquo;draft a CO for the cofferdam&rdquo;
            </span>
            <kbd className="ml-auto hidden rounded border bg-white px-1.5 font-mono text-[10px] sm:inline">
              ⌘K
            </kbd>
            <Mic className="size-4 shrink-0" />
          </div>
          <span className="hidden text-xs text-muted-foreground lg:inline">
            As of {AS_OF}
          </span>
        </header>

        <div className="flex gap-2 overflow-x-auto border-b px-4 py-2">
          {jobs.map(({ job, cpi, spi, status }) => (
            <div
              key={job.id}
              className={cn(
                "flex shrink-0 items-center gap-3 rounded-lg border px-3 py-1.5 text-xs",
                job.id === focusJob.id
                  ? "border-slate-900 bg-slate-50"
                  : "text-slate-600",
              )}
            >
              <div>
                <div className="font-medium text-slate-900">
                  {job.short}{" "}
                  <span className="font-normal text-muted-foreground">
                    {job.number}
                  </span>
                </div>
                <div>
                  CPI <IndexValue value={cpi} /> · SPI{" "}
                  <IndexValue value={spi} />
                </div>
              </div>
              <HealthPill value={status} />
            </div>
          ))}
        </div>

        <div className="flex min-h-0 flex-1">
          <main className="flex min-w-0 flex-1 flex-col gap-5 p-4 pb-28 md:p-6 lg:pb-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h1 className="text-lg font-semibold">{focusJob.name}</h1>
                <p className="text-sm text-muted-foreground">
                  {focusJob.number} · {focusJob.owner} · PM {focusJob.pm} ·
                  finish {focusJob.finish}
                </p>
              </div>
              <div className="flex gap-4 text-sm">
                <span>
                  Earned <Money value={focusJob.ev} />
                </span>
                <span>
                  Actual <Money value={focusJob.ac} />
                </span>
                <span>
                  CPI <IndexValue value={m.cpi} />
                </span>
                <span className="hidden sm:inline">
                  Complete <span className="font-mono">{pct(m.percent)}</span>
                </span>
              </div>
            </div>

            <section className="rounded-xl border border-amber-300 bg-amber-50/50">
              <header className="flex flex-wrap items-center gap-2 border-b border-amber-200 px-4 py-2.5">
                <Sparkles className="size-4 text-amber-600" />
                <h2 className="text-sm font-semibold">
                  Daily plan draft · {dailyPlan.crew} · {dailyPlan.date}
                </h2>
                <span className="text-xs text-amber-800">
                  Drafted from Luis&rsquo;s voice note · review before it goes
                  to the PM
                </span>
              </header>
              <div className="px-4">
                <PlanLines editable />
              </div>
              <div className="flex flex-wrap items-center gap-3 border-t border-amber-200 px-4 py-3">
                <PlanEquipment />
                <span className="font-mono text-xs">{planManHours()} MH</span>
                <div className="ml-auto flex gap-2">
                  <DemoButton variant="outline" done="Sent back to Luis (demo)">
                    Send back
                  </DemoButton>
                  <DemoButton done="Approved (demo)">Approve plan</DemoButton>
                </div>
              </div>
            </section>

            <section>
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="text-sm font-semibold">
                  Budget vs earned value by cost code
                </h2>
                <span className="text-xs text-muted-foreground">
                  Rows under CPI 0.80 are tinted
                </span>
              </div>
              <CostTable />
            </section>
          </main>

          <aside className="hidden w-80 shrink-0 flex-col border-l bg-slate-50 lg:flex">
            <div className="flex items-center gap-2 border-b px-4 py-2.5 text-sm font-semibold">
              <Sparkles className="size-4 text-amber-600" /> Assistant
              <span className="ml-auto text-xs font-normal text-muted-foreground">
                Every step is a typed action
              </span>
            </div>
            <ul className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
              <LogEntry
                who="you"
                text="Why is Cedar Creek over?"
                time="7:42 AM"
              />
              <LogEntry
                who="assistant"
                text={`${usdShort(focusJob.ac - focusJob.ev)} over. ${worst.description} is the largest at ${usdShort(-worst.variance)}, CPI ${idx(worst.cpi)}. Highlighted in the table.`}
                action={`job.costVariance("${focusJob.number}")`}
                time="7:42 AM"
              />
              <LogEntry
                who="you"
                text="Luis sent a voice note for tomorrow. Draft it."
                time="7:44 AM"
              />
              <LogEntry
                who="assistant"
                text="Drafted 3 lines from the note. All are inside budget unit rates. It is open for your review."
                action={`dailyPlan.draft("${focusJob.number}", "${dailyPlan.date}")`}
                time="7:44 AM"
              />
              <li className="rounded-lg border bg-white p-3 text-xs">
                <div className="font-medium">Suggested next</div>
                <p className="mt-1 text-slate-600">
                  {worst.description} actuals run{" "}
                  {pct(worst.actualCost / worst.earned - 1)} over its earned
                  value. Start a change order with the dewatering logs attached?
                </p>
                <div className="mt-2 flex gap-2">
                  <DemoButton
                    className="h-7 text-xs"
                    done="CO draft started (demo)"
                  >
                    Start CO
                  </DemoButton>
                  <DemoButton
                    variant="ghost"
                    className="h-7 text-xs"
                    done="Dismissed"
                  >
                    Not now
                  </DemoButton>
                </div>
              </li>
            </ul>
            <div className="border-t p-3">
              <div className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm text-muted-foreground">
                Ask or tell… <Mic className="ml-auto size-4" />
              </div>
            </div>
          </aside>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 flex items-center gap-3 border-t bg-slate-950 px-4 py-3 text-sm text-white lg:hidden">
        <Sparkles className="size-4 text-amber-400" />
        <span className="min-w-0 flex-1 truncate">
          1 draft to review · {worst.description} {usdShort(worst.variance)}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs">
          <Check className="size-3" /> 2 actions
        </span>
      </div>
    </div>
  );
}

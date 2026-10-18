import { ArrowUp, Check, Mic, Sparkles } from "lucide-react";
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
import { AS_OF, COMPANY, dailyPlan, idx, pct, usdShort } from "./scenario";
import { DemoButton } from "./demo-button";

function ActionChip({
  name,
  args,
  result,
}: {
  name: string;
  args?: string;
  result: string;
}) {
  return (
    <div className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[11px] text-slate-600">
      <Check className="size-3 shrink-0 text-emerald-600" />
      <span className="truncate">
        {name}({args ?? ""}) <span className="text-slate-400">→ {result}</span>
      </span>
    </div>
  );
}

function User({
  children,
  voice,
}: {
  children: React.ReactNode;
  voice?: boolean;
}) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-slate-900 px-4 py-2.5 text-sm text-white">
        {voice && (
          <div className="mb-1 flex items-center gap-1 text-[11px] text-slate-400">
            <Mic className="size-3" /> Voice · transcribed
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

function Assistant({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-amber-400 text-slate-950">
        <Sparkles className="size-3.5" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2.5 text-sm">
        {children}
      </div>
    </div>
  );
}

function Confirm({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border bg-white shadow-sm", className)}>
      <div className="border-b px-4 py-2 text-xs font-medium text-muted-foreground">
        {title}
      </div>
      <div className="px-4 py-2">{children}</div>
    </div>
  );
}

export function AgentShell() {
  const jobs = portfolio();
  const worst = focusRows().slice(0, 3);
  return (
    <div className="flex min-h-[calc(100vh-33px)] flex-col bg-[#f7f6f3] text-slate-900">
      <header className="flex items-center gap-2 px-4 py-3">
        <div className="grid size-7 place-items-center rounded-md bg-slate-900 text-xs font-bold text-amber-400">
          P
        </div>
        <div className="text-sm font-semibold">Pitbull</div>
        <span className="text-sm text-muted-foreground">· {COMPANY}</span>
        <span className="ml-auto hidden text-xs text-muted-foreground sm:inline">
          Data as of {AS_OF}
        </span>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 pb-40 pt-2">
        <User>How are my jobs doing?</User>
        <Assistant>
          <ActionChip name="portfolio.summary" result="3 jobs" />
          <p>
            Two of three need attention. <strong>Cedar Creek</strong> is over
            cost at CPI {idx(jobs[1].cpi)}, and <strong>I-5 Culvert</strong> is
            behind schedule at SPI {idx(jobs[2].spi)}. SR-99 is on track.
          </p>
          <Confirm title="Portfolio · earned value to date">
            <ul className="divide-y">
              {jobs.map(({ job, cpi, spi, percent, status }) => (
                <li key={job.id} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{job.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {job.number} · {pct(percent)} complete
                    </div>
                  </div>
                  <div className="hidden text-right text-xs sm:block">
                    CPI <IndexValue value={cpi} /> · SPI{" "}
                    <IndexValue value={spi} />
                  </div>
                  <HealthPill value={status} />
                </li>
              ))}
            </ul>
          </Confirm>
        </Assistant>

        <User>Why is Cedar Creek over?</User>
        <Assistant>
          <ActionChip
            name="job.costVariance"
            args={`"${focusJob.number}"`}
            result="12 cost codes"
          />
          <p>
            {usdShort(focusJob.ac - focusJob.ev)} over on{" "}
            {usdShort(focusJob.ev)} earned. Three codes carry most of it. The
            cofferdam is the biggest at {usdShort(-worst[0].variance)} over,
            with dewatering running past plan.
          </p>
          <Confirm title={`${focusJob.number} · worst cost variance`}>
            <ul className="divide-y">
              {worst.map((r) => (
                <li key={r.code} className="flex items-center gap-3 py-2">
                  <span className="font-mono text-xs text-muted-foreground">
                    {r.code}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {r.description}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {pct(r.percent)}
                  </span>
                  <Money value={r.variance} signed />
                </li>
              ))}
            </ul>
            <details className="group border-t py-2 text-xs">
              <summary className="cursor-pointer select-none font-medium text-slate-700">
                Show all cost codes
              </summary>
              <div className="pt-2">
                <CostTable compact />
              </div>
            </details>
          </Confirm>
        </Assistant>

        <User voice>
          Plan tomorrow for Bridge Crew 2. Six guys pouring Pier 3 lift two,
          forty-two yards. Four tying the Pier 4 cage, about eighty-five hundred
          pounds. Keep one on the pumps at the cofferdam. Crane all day, pump
          six hours.
        </User>
        <Assistant>
          <ActionChip
            name="dailyPlan.draft"
            args={`"${focusJob.number}", "${dailyPlan.date}"`}
            result="3 lines, 3 checks passed"
          />
          <p>
            Drafted. All three lines are inside the budgeted unit rates. That is{" "}
            {planManHours()} man-hours. Review it and submit, or tell me what to
            change.
          </p>
          <Confirm
            title={`Daily plan · ${dailyPlan.crew} · ${dailyPlan.date}`}
            className="ring-2 ring-amber-400/60"
          >
            <PlanLines />
            <div className="flex flex-col gap-3 border-t py-3">
              <PlanEquipment />
              <div className="flex flex-wrap gap-2">
                <DemoButton done="Submitted to Marcus Lee (demo)">
                  Submit plan
                </DemoButton>
                <DemoButton variant="outline" done="Opened editor (demo)">
                  Edit
                </DemoButton>
              </div>
            </div>
          </Confirm>
        </Assistant>
      </main>

      <div className="fixed inset-x-0 bottom-0 bg-gradient-to-t from-[#f7f6f3] via-[#f7f6f3] to-transparent pb-4 pt-8">
        <div className="mx-auto flex max-w-3xl flex-col gap-2 px-4">
          <div className="flex gap-2 overflow-x-auto text-xs">
            {[
              "Draft a change order for the cofferdam",
              "Compare I-5 to baseline",
              "What did Crew 2 install today?",
            ].map((s) => (
              <span
                key={s}
                className="shrink-0 rounded-full border bg-white px-3 py-1 text-slate-600"
              >
                {s}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2 rounded-2xl border bg-white p-2 shadow-sm">
            <input
              placeholder="Ask or tell Pitbull…"
              className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none"
            />
            <button
              type="button"
              aria-label="Hold to talk"
              className="grid size-9 place-items-center rounded-full bg-slate-100 text-slate-700"
            >
              <Mic className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Send"
              className="grid size-9 place-items-center rounded-full bg-slate-900 text-white"
            >
              <ArrowUp className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

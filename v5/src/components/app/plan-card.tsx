import type { getPlansForJob } from "@/server/data";
import { qty } from "@/lib/ev";
import { cn } from "@/lib/utils";

type Plan = Awaited<ReturnType<typeof getPlansForJob>>[number];

const day = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

/** A crew's daily plan, each line checked against the cost item's budgeted unit rate. */
export function PlanCard({
  plan,
  actions,
}: {
  plan: Plan;
  actions?: React.ReactNode;
}) {
  const manHours = plan.lines.reduce((s, l) => s + l.manHours, 0);
  const draft = plan.status === "draft";
  return (
    <section
      className={cn(
        "rounded-xl border",
        draft ? "border-brand bg-caution-soft/40" : "bg-card",
      )}
      data-testid="plan-card"
      data-status={plan.status}
    >
      <header className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
        <h2 className="text-sm font-semibold">
          Daily plan · {plan.crew} · {day(plan.planDate)}
        </h2>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-medium",
            draft ? "bg-brand/30" : "bg-positive-soft text-positive",
          )}
          data-testid="plan-status"
        >
          {draft ? "Draft" : "Submitted"}
        </span>
        <span className="text-xs text-muted-foreground">
          Foreman {plan.foreman} · {plan.weather}
        </span>
      </header>
      <ul className="divide-y px-4">
        {plan.lines.map((l) => (
          <li
            key={l.id}
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
                {l.location} · {l.description}
              </div>
            </div>
            <div className="text-right tabular-nums">
              {qty(l.qtyMilli)} {l.unit}
            </div>
            <div className="col-span-2 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
              <span>
                {l.workers} {l.workers === 1 ? "worker" : "workers"} ×{" "}
                {l.hoursTenths / 10} h ={" "}
                <span className="font-medium text-foreground">
                  {l.manHours} MH
                </span>
              </span>
              <span
                className={l.withinRate ? "text-positive" : "text-negative"}
              >
                {l.withinRate ? "Within" : "Over"} budget rate (
                {l.plannedRate.toPrecision(2)} vs {l.budgetRate} MH/{l.unit})
              </span>
            </div>
          </li>
        ))}
      </ul>
      <footer className="flex flex-wrap items-center gap-2 border-t px-4 py-3 text-xs">
        {plan.equipment.map((e) => (
          <span
            key={e.name}
            className="rounded-md border bg-background px-2 py-1"
          >
            {e.name} <span className="text-muted-foreground">{e.hours} h</span>
          </span>
        ))}
        <span className="font-medium tabular-nums">{manHours} MH</span>
        {actions && <div className="ml-auto flex gap-2">{actions}</div>}
      </footer>
    </section>
  );
}

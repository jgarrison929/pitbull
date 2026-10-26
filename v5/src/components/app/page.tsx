import { MetricCard } from "@/components/app/metric-card";
import { cn } from "@/lib/utils";

/** Fixed page anatomy: header, KPI strip, sections. Every screen uses these so they read as one product. */
export function PageHeader({
  title,
  purpose,
  meta,
  actions,
}: {
  title: string;
  /** One plain sentence (≤90 chars) saying what the user does on this page. */
  purpose: string;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-title font-semibold tracking-tight">{title}</h1>
        <p
          data-testid="page-purpose"
          data-text="label"
          className="mt-0.5 text-label text-muted-foreground"
        >
          {purpose}
        </p>
        {meta && (
          <div
            data-text="label"
            className="text-label text-muted-foreground"
          >
            {meta}
          </div>
        )}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function KpiStrip({ children }: { children: React.ReactNode }) {
  return (
    <div className="card-stack grid grid-cols-2 lg:grid-cols-4">
      {children}
    </div>
  );
}

/** @deprecated Prefer MetricCard — kept as a thin alias for existing call sites. */
export function Kpi({
  label,
  value,
  sub,
  testId,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  testId?: string;
}) {
  return (
    <MetricCard label={label} value={value} sub={sub} testId={testId} />
  );
}

export { MetricCard };

export function Section({
  title,
  meta,
  actions,
  children,
  className,
  id,
}: {
  title: string;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("rounded-lg border bg-card", className)}>
      <header className="flex items-start justify-between gap-3 border-b px-4 py-3 lg:px-6">
        <div className="min-w-0">
          <h2 className="text-section font-semibold">{title}</h2>
          {meta && (
            <div
              data-text="label"
              className="text-label leading-snug text-muted-foreground"
            >
              {meta}
            </div>
          )}
        </div>
        {actions}
      </header>
      <div className="px-4 py-1 lg:px-6">{children}</div>
    </section>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center gap-1 py-10 text-center">
      <div className="text-body font-medium">{title}</div>
      <p className="max-w-sm text-body text-muted-foreground">{body}</p>
    </div>
  );
}

export function Th({
  children,
  right,
  className,
}: {
  children?: React.ReactNode;
  right?: boolean;
  className?: string;
}) {
  return (
    <th
      data-text="label"
      className={cn(
        "whitespace-nowrap px-2.5 py-2 text-label font-medium uppercase tracking-wide text-muted-foreground first:pl-0 last:pr-0",
        right ? "text-right" : "text-left",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  right,
  className,
}: {
  children?: React.ReactNode;
  right?: boolean;
  className?: string;
}) {
  return (
    <td
      className={cn(
        "px-2.5 py-2.5 text-body first:pl-0 last:pr-0",
        right && "text-right",
        className,
      )}
    >
      {children}
    </td>
  );
}

import { cn } from "@/lib/utils";

/** Fixed page anatomy: header, KPI strip, sections. Every screen uses these so they read as one product. */
export function PageHeader({
  title,
  meta,
  actions,
}: {
  title: string;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        {meta && <div className="text-sm text-muted-foreground">{meta}</div>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function KpiStrip({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>
  );
}

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
    <div className="rounded-lg border bg-card px-4 py-3">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div
        className="mt-1 text-xl font-semibold tracking-tight tabular-nums"
        data-testid={testId}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function Section({
  title,
  meta,
  actions,
  children,
  className,
}: {
  title: string;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-lg border bg-card", className)}>
      <header className="flex items-start justify-between gap-3 border-b px-4 py-2.5">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{title}</h2>
          {meta && (
            <div className="text-xs leading-snug text-muted-foreground">
              {meta}
            </div>
          )}
        </div>
        {actions}
      </header>
      <div className="px-4 py-1">{children}</div>
    </section>
  );
}

/**
 * Primary action inside an empty state. 44px tall so a phone tap lands.
 * Use on a link or a button. Tokens only, so light and dark both work.
 */
export const emptyStateActionClass =
  "inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/**
 * Designed empty list. Title and explanation are separate lines.
 * Pass `action` only when this role can take the next step.
 * A filtered list with no rows uses the same component and a Clear filters action.
 */
export function EmptyState({
  title,
  body,
  icon,
  action,
  testId,
}: {
  title: string;
  body: string;
  /** Optional lightweight mark. Decorative; the title carries the meaning. */
  icon?: React.ReactNode;
  /** Link or button for the next step. Omit when this role cannot act. */
  action?: React.ReactNode;
  testId?: string;
}) {
  return (
    <div
      className="flex flex-col items-center gap-3 px-4 py-8 text-center"
      data-testid={testId}
    >
      {icon ? (
        <div className="text-muted-foreground" aria-hidden="true">
          {icon}
        </div>
      ) : null}
      <div className="flex max-w-md flex-col items-center gap-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{body}</p>
      </div>
      {action ? (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {action}
        </div>
      ) : null}
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
      className={cn(
        "whitespace-nowrap px-2.5 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground first:pl-0 last:pr-0",
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
        "px-2.5 py-2.5 first:pl-0 last:pr-0",
        right && "text-right",
        className,
      )}
    >
      {children}
    </td>
  );
}

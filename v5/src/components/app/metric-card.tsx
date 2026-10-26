import { Figure } from "@/components/app/format";
import { cn } from "@/lib/utils";

/**
 * One metric tile: label, one primary Figure, at most two secondary figures,
 * and an optional native details region for the rest (5.0.4-c).
 */
export function MetricCard({
  label,
  value,
  sub,
  secondary,
  details,
  detailsSummary = "Details",
  testId,
  className,
}: {
  label: string;
  value: React.ReactNode;
  /** One secondary line (wrapped as a single secondary figure). */
  sub?: React.ReactNode;
  /** Prefer this when the card needs up to two secondary figures. */
  secondary?: React.ReactNode[];
  details?: React.ReactNode;
  detailsSummary?: React.ReactNode;
  testId?: string;
  className?: string;
}) {
  const secondaries = (
    secondary != null ? secondary.slice(0, 2) : sub != null ? [sub] : []
  ).filter((n) => n != null && n !== false && n !== "");

  return (
    <div
      data-card
      className={cn(
        "rounded-lg border bg-card px-4 py-4 lg:px-6 lg:py-6",
        className,
      )}
    >
      <div
        data-text="label"
        className="text-label font-medium text-muted-foreground"
      >
        {label}
      </div>
      <Figure
        variant="primary"
        className="mt-1 block"
        data-testid={testId}
      >
        {value}
      </Figure>
      {secondaries.length > 0 ? (
        <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          {secondaries.map((item, i) => (
            <Figure key={i} variant="secondary">
              {item}
            </Figure>
          ))}
        </div>
      ) : null}
      {details != null ? (
        <details className="mt-2">
          <summary
            data-text="label"
            className="tap-target flex cursor-pointer list-none items-center text-label font-medium text-muted-foreground [&::-webkit-details-marker]:hidden"
          >
            {detailsSummary}
          </summary>
          <div className="pt-2 text-body text-muted-foreground">{details}</div>
        </details>
      ) : null}
    </div>
  );
}

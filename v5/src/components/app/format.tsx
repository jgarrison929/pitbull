import { cn } from "@/lib/utils";
import { idx, usdShort } from "@/lib/ev";
import { varianceStatus, type Status } from "@/lib/status";

const statusStyle: Record<
  Status,
  { label: string; tone: string; text: string; dot: string }
> = {
  "on-track": {
    label: "On track",
    tone: "bg-positive-soft text-positive",
    text: "text-positive",
    dot: "bg-positive",
  },
  watch: {
    label: "Watch",
    tone: "bg-caution-soft text-caution",
    text: "text-caution",
    dot: "bg-caution",
  },
  "at-risk": {
    label: "At risk",
    tone: "bg-negative-soft text-negative",
    text: "text-negative",
    dot: "bg-negative",
  },
};

/** A job's status. The dollar variance sits next to the color whenever it is known. */
export function StatusPill({
  value,
  varianceCents,
}: {
  value: Status;
  varianceCents?: number;
}) {
  const s = statusStyle[value];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
        s.tone,
      )}
      data-status={value}
    >
      <span className={cn("size-1.5 rounded-full", s.dot)} />
      {s.label}
      {varianceCents !== undefined && (
        <span className="tabular-nums">· {signedUsd(varianceCents)}</span>
      )}
    </span>
  );
}

const signedUsd = (cents: number) =>
  `${cents > 0 ? "+" : ""}${usdShort(cents)}`;

/**
 * CPI with cost variance, or SPI with schedule variance, colored by the shared status rule.
 * The dollar figure is always shown, so a color never stands alone.
 */
export function StatusIndex({
  index,
  varianceCents,
  testId,
}: {
  index: number | null;
  varianceCents: number;
  testId?: string;
}) {
  const s = varianceStatus(index, varianceCents);
  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-1.5 whitespace-nowrap tabular-nums",
        s ? statusStyle[s].text : "text-muted-foreground",
      )}
      data-status={s ?? "none"}
      data-testid={testId}
    >
      <span data-testid={testId ? `${testId}-index` : undefined}>
        {idx(index)}
      </span>
      <span className="text-[0.85em] font-normal">
        {signedUsd(varianceCents)}
      </span>
    </span>
  );
}

export function Money({
  cents,
  signed = false,
}: {
  cents: number;
  signed?: boolean;
}) {
  const tone = signed
    ? cents < 0
      ? "text-negative"
      : cents > 0
        ? "text-positive"
        : ""
    : "";
  return (
    <span className={cn("whitespace-nowrap tabular-nums", tone)}>
      {signed && cents > 0 ? "+" : ""}
      {usdShort(cents)}
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
      role="presentation"
    >
      <div
        className="h-full rounded-full bg-primary"
        style={{ width: `${Math.min(100, value * 100)}%` }}
      />
    </div>
  );
}

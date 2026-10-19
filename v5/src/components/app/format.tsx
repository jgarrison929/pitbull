import { cn } from "@/lib/utils";
import { idx, usdShort, type Health } from "@/lib/ev";

const healthStyle: Record<
  Health,
  { label: string; tone: string; dot: string }
> = {
  "on-track": {
    label: "On track",
    tone: "bg-positive-soft text-positive",
    dot: "bg-positive",
  },
  watch: {
    label: "Watch",
    tone: "bg-caution-soft text-caution",
    dot: "bg-caution",
  },
  "at-risk": {
    label: "At risk",
    tone: "bg-negative-soft text-negative",
    dot: "bg-negative",
  },
};

export function HealthPill({ value }: { value: Health }) {
  const s = healthStyle[value];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
        s.tone,
      )}
    >
      <span className={cn("size-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}

const indexTone = (v: number | null) =>
  v === null
    ? "text-muted-foreground"
    : v >= 0.98
      ? "text-positive"
      : v >= 0.93
        ? "text-caution"
        : "text-negative";

export function IndexValue({ value }: { value: number | null }) {
  return (
    <span className={cn("tabular-nums", indexTone(value))}>{idx(value)}</span>
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

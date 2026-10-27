import { ExactMoney } from "@/components/app/exact-money";
import { cn } from "@/lib/utils";
import { idx, usdCents, usdShort } from "@/lib/ev";
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

/**
 * Every number on a MetricCard (and phone list rows) goes through Figure so
 * Verify can count primary/secondary figures (5.0.4-c).
 */
export function Figure({
  children,
  variant = "primary",
  className,
  ...props
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
} & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      data-figure={variant}
      className={cn(
        "min-w-0 max-w-full whitespace-normal break-words tabular-nums",
        variant === "primary"
          ? "text-figure-primary font-semibold tracking-tight"
          : "text-label font-medium text-muted-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

/** A job's status. The dollar variance sits next to the color whenever it is known. */
export function StatusPill({
  value,
  varianceCents,
  testId,
}: {
  value: Status;
  varianceCents?: number;
  testId?: string;
}) {
  const s = statusStyle[value];
  return (
    <span
      data-text="label"
      data-testid={testId}
      className={cn(
        // Wrap on phone — nowrap + strip overflow was a hard status clip at 320.
        "inline-flex max-w-full shrink-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-full px-2 py-0.5 text-label font-medium",
        s.tone,
      )}
      data-status={value}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", s.dot)} />
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
  indexTestId,
  statusWord = false,
}: {
  index: number | null;
  varianceCents: number;
  testId?: string;
  /** Index digits only, when the card root already owns `testId`. */
  indexTestId?: string;
  /** Stack "On track", "Watch", or "At risk" under the index. */
  statusWord?: boolean;
}) {
  const s = varianceStatus(index, varianceCents);
  const word = s ? statusStyle[s].label : null;
  const figures = (
    <>
      <span data-testid={indexTestId ?? (testId ? `${testId}-index` : undefined)}>
        {idx(index)}
      </span>
      <span data-text="label" className="text-label font-normal">
        {signedUsd(varianceCents)}
      </span>
    </>
  );
  if (statusWord) {
    return (
      <span
        className={cn(
          "inline-flex max-w-full flex-col items-end gap-y-0 tabular-nums",
          s ? statusStyle[s].text : "text-muted-foreground",
        )}
        data-status={s ?? "none"}
        data-testid={testId}
        data-variance-cents={varianceCents}
      >
        <span className="inline-flex max-w-full flex-wrap items-baseline justify-end gap-x-1.5">
          {figures}
        </span>
        {word ? (
          <span data-text="label" className="text-label font-normal">
            {word}
          </span>
        ) : null}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex max-w-full flex-wrap items-baseline gap-x-1.5 gap-y-0 tabular-nums",
        s ? statusStyle[s].text : "text-muted-foreground",
      )}
      data-status={s ?? "none"}
      data-testid={testId}
      data-variance-cents={varianceCents}
    >
      {figures}
      {varianceCents === 0 && word ? (
        <span data-text="label" className="text-label font-normal">
          {word}
        </span>
      ) : null}
    </span>
  );
}

/**
 * Money display. Compact `$K`/`$M` by default. `exact` uses ExactMoney: phone
 * shows one compact figure with exact one tap away (swap, never dual-mount);
 * tablet/desktop shows dollars+cents. No ellipsis; no title-only reachability.
 */
/** KPI cards use the short form from this many cents ($10,000.00). */
export const SHORT_MONEY_CENTS = 1_000_000;

export function Money({
  cents,
  signed = false,
  /** Leaf budget lines: exact dollars and cents at tablet/desktop. */
  exact = false,
  /**
   * At or above this many cents, show `usdShort` with the exact value in
   * `title` and `data-cents`. Below it, show static dollars and cents.
   */
  shortAboveCents,
}: {
  cents: number;
  signed?: boolean;
  exact?: boolean;
  shortAboveCents?: number;
}) {
  const tone = signed
    ? cents < 0
      ? "text-negative"
      : cents > 0
        ? "text-positive"
        : ""
    : "";
  const sign = signed && cents > 0 ? "+" : "";
  const title = `${sign}${usdCents(cents)}`;
  if (exact && shortAboveCents == null) {
    return <ExactMoney cents={cents} signed={signed} className={tone} />;
  }
  const asShort =
    shortAboveCents != null ? Math.abs(cents) >= shortAboveCents : true;
  return (
    <span
      className={cn("text-right tabular-nums", tone)}
      data-cents={cents}
      title={title}
    >
      {sign}
      {asShort ? usdShort(cents) : usdCents(cents)}
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

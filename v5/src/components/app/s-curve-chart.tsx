import type { CurvePoint } from "@/lib/curve";
import { usdShort } from "@/lib/ev";

/** Theme-token series colors — never hard-coded hex/rgb. */
const SERIES = [
  {
    key: "plannedCents" as const,
    label: "Planned value",
    stroke: "var(--chart-1)",
    kind: "linear" as const,
  },
  {
    key: "earnedCents" as const,
    label: "Earned value",
    stroke: "var(--chart-2)",
    kind: "step" as const,
  },
  {
    key: "actualCents" as const,
    label: "Actual cost",
    stroke: "var(--chart-3)",
    kind: "linear" as const,
  },
];

const W = 720;
const H = 280;
/** Left pad fits usdShort labels at TICK_FONT (readable at 320/390-wide SVG). */
const PAD = { top: 16, right: 16, bottom: 40, left: 64 };
/**
 * User units for axis ticks. Scaled with the viewBox: ~10px at 320 CSS px
 * width, ~11px at 390, ~20px near 1:1 desktop. Keep ≥18 (theme must-fail).
 */
const TICK_FONT = 20;

function dayLabel(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function maxCents(points: CurvePoint[]) {
  let m = 0;
  for (const p of points) {
    m = Math.max(m, p.plannedCents, p.earnedCents ?? 0, p.actualCents ?? 0);
  }
  return m > 0 ? m : 1;
}

function xAt(i: number, n: number) {
  const inner = W - PAD.left - PAD.right;
  if (n <= 1) return PAD.left + inner / 2;
  return PAD.left + (inner * i) / (n - 1);
}

function yAt(cents: number, max: number) {
  const inner = H - PAD.top - PAD.bottom;
  return PAD.top + inner * (1 - cents / max);
}

/** Linear polyline through finite points (skips nulls by breaking the path). */
function linearPath(
  points: CurvePoint[],
  key: "plannedCents" | "earnedCents" | "actualCents",
  max: number,
): string {
  const parts: string[] = [];
  let drawing = false;
  points.forEach((p, i) => {
    const v = p[key];
    if (v == null) {
      drawing = false;
      return;
    }
    const cmd = drawing ? "L" : "M";
    parts.push(`${cmd}${xAt(i, points.length).toFixed(1)} ${yAt(v, max).toFixed(1)}`);
    drawing = true;
  });
  return parts.join(" ");
}

/** Step-after path for earned value (flat between lock dates). */
function stepPath(
  points: CurvePoint[],
  key: "earnedCents" | "actualCents",
  max: number,
): string {
  const parts: string[] = [];
  let prev: { x: number; y: number } | null = null;
  points.forEach((p, i) => {
    const v = p[key];
    if (v == null) {
      prev = null;
      return;
    }
    const x = xAt(i, points.length);
    const y = yAt(v, max);
    if (!prev) {
      parts.push(`M${x.toFixed(1)} ${y.toFixed(1)}`);
    } else {
      parts.push(`L${x.toFixed(1)} ${prev.y.toFixed(1)}`);
      parts.push(`L${x.toFixed(1)} ${y.toFixed(1)}`);
    }
    prev = { x, y };
  });
  return parts.join(" ");
}

export function SCurveChart({
  points,
  cutoffOn,
  testId = "s-curve",
}: {
  points: CurvePoint[];
  cutoffOn: string | null;
  testId?: string;
}) {
  if (points.length === 0) return null;
  const last = points[points.length - 1]!;
  const max = maxCents(points);
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(max * t));
  const xLabelEvery = Math.max(1, Math.ceil(points.length / 6));

  return (
    <div
      data-testid={testId}
      data-cutoff={cutoffOn ?? ""}
      data-last-planned-cents={last.plannedCents}
      className="px-2 pb-3 pt-2"
    >
      {/* Machine-readable series for verify — not one DOM node per SVG vertex. */}
      <ol className="sr-only" data-testid="curve-points">
        {points.map((p) => (
          <li
            key={p.on}
            data-testid="curve-point"
            data-on={p.on}
            data-planned-cents={p.plannedCents}
            data-earned-cents={p.earnedCents ?? ""}
            data-actual-cents={p.actualCents ?? ""}
          />
        ))}
      </ol>

      <div className="mb-2 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
        {SERIES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span
              className="h-0.5 w-3 shrink-0 rounded-sm"
              style={{ backgroundColor: s.stroke }}
              aria-hidden
            />
            {s.label}
          </span>
        ))}
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="S-curve of planned value, earned value, and actual cost"
        className="h-auto w-full min-h-[220px] text-muted-foreground"
        data-testid="s-curve-svg"
      >
        {/* Horizontal grid */}
        {yTicks.map((cents) => {
          const y = yAt(cents, max);
          return (
            <g key={cents}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y}
                y2={y}
                stroke="var(--border)"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 8}
                y={y + 4}
                textAnchor="end"
                className="fill-muted-foreground"
                style={{ fontSize: TICK_FONT }}
                data-testid="s-curve-tick-y"
              >
                {usdShort(cents)}
              </text>
            </g>
          );
        })}

        {/* X labels */}
        {points.map((p, i) => {
          if (i % xLabelEvery !== 0 && i !== points.length - 1) return null;
          return (
            <text
              key={p.on}
              x={xAt(i, points.length)}
              y={H - 12}
              textAnchor="middle"
              className="fill-muted-foreground"
              style={{ fontSize: TICK_FONT }}
              data-testid="s-curve-tick-x"
            >
              {dayLabel(p.on)}
            </text>
          );
        })}

        {SERIES.map((s) => {
          const d =
            s.kind === "step"
              ? stepPath(points, s.key as "earnedCents", max)
              : linearPath(points, s.key, max);
          if (!d) return null;
          return (
            <path
              key={s.key}
              d={d}
              fill="none"
              stroke={s.stroke}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              data-series={s.key}
            />
          );
        })}
      </svg>

      {cutoffOn ? (
        <p className="px-2 text-xs text-muted-foreground">
          Cutoff {dayLabel(cutoffOn)} — earned and actual stop at the last locked
          period; cost since the lock stays on its own tile.
        </p>
      ) : (
        <p
          className="px-2 text-xs text-muted-foreground"
          data-testid="curve-no-lock-note"
        >
          Earned and actual cost appear after the first locked period.
        </p>
      )}
    </div>
  );
}

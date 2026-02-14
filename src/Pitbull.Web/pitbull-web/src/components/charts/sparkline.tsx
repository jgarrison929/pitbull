"use client";

import { useMemo } from "react";

interface SparklineProps {
  /** Data points for the sparkline */
  data: number[];
  /** Width in pixels (default 80) */
  width?: number;
  /** Height in pixels (default 24) */
  height?: number;
  /** Stroke color (default blue-500) */
  color?: string;
  /** Fill under the line */
  fill?: boolean;
  /** Stroke width (default 1.5) */
  strokeWidth?: number;
  /** Class name for the wrapper */
  className?: string;
}

export function Sparkline({
  data,
  width = 80,
  height = 24,
  color = "#3b82f6",
  fill = true,
  strokeWidth = 1.5,
  className = "",
}: SparklineProps) {
  const pathData = useMemo(() => {
    if (data.length < 2) return { line: "", area: "" };

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const padding = 2;
    const drawWidth = width - padding * 2;
    const drawHeight = height - padding * 2;

    const points = data.map((val, i) => {
      const x = padding + (i / (data.length - 1)) * drawWidth;
      const y = padding + drawHeight - ((val - min) / range) * drawHeight;
      return { x, y };
    });

    const lineSegments = points.map((p, i) =>
      i === 0 ? `M ${p.x},${p.y}` : `L ${p.x},${p.y}`
    );
    const line = lineSegments.join(" ");

    const area = `${line} L ${points[points.length - 1].x},${height} L ${points[0].x},${height} Z`;

    return { line, area };
  }, [data, width, height]);

  if (data.length < 2) return null;

  return (
    <svg
      width={width}
      height={height}
      className={className}
      role="img"
      aria-label={`Sparkline chart: ${data.join(", ")}`}
    >
      {fill && (
        <path
          d={pathData.area}
          fill={color}
          fillOpacity={0.15}
        />
      )}
      <path
        d={pathData.line}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Trend Indicator ────────────────────────────────────

interface TrendIndicatorProps {
  /** Current value */
  current: number;
  /** Previous value to compare against */
  previous: number;
  /** Format as percentage change (default true) */
  showPercentage?: boolean;
  /** Class name */
  className?: string;
}

export function TrendIndicator({
  current,
  previous,
  showPercentage = true,
  className = "",
}: TrendIndicatorProps) {
  if (previous === 0 && current === 0) return null;

  const diff = current - previous;
  const pctChange =
    previous !== 0 ? ((diff / Math.abs(previous)) * 100).toFixed(0) : "—";
  const isUp = diff > 0;
  const isFlat = diff === 0;

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium ${
        isFlat
          ? "text-muted-foreground"
          : isUp
          ? "text-green-600 dark:text-green-400"
          : "text-red-600 dark:text-red-400"
      } ${className}`}
    >
      {!isFlat && (
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          className={isUp ? "" : "rotate-180"}
        >
          <path
            d="M6 2.5L10 7.5H2L6 2.5Z"
            fill="currentColor"
          />
        </svg>
      )}
      {showPercentage && pctChange !== "—" && <span>{pctChange}%</span>}
    </span>
  );
}

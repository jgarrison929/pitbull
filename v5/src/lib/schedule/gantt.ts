/**
 * Pure Gantt layout helpers for 5.1.0-c.
 * Bars share one calendar-day axis; finish dates are inclusive.
 */
import { fromDayNumber, toDayNumber } from "@/lib/working-calendar";

/** Inclusive YYYY-MM-DD calendar days from `startOn` through `finishOn`. */
export function enumerateIsoDays(startOn: string, finishOn: string): string[] {
  const a = toDayNumber(startOn);
  const b = toDayNumber(finishOn);
  if (b < a) return [];
  const out: string[] = [];
  for (let d = a; d <= b; d++) out.push(fromDayNumber(d));
  return out;
}

/** Axis span for a set of activity early dates (inclusive). Null when empty. */
export function ganttAxisRange(
  activities: readonly { earlyStartOn: string; earlyFinishOn: string }[],
): { startOn: string; finishOn: string } | null {
  if (activities.length === 0) return null;
  let startOn = activities[0]!.earlyStartOn;
  let finishOn = activities[0]!.earlyFinishOn;
  for (const a of activities) {
    if (a.earlyStartOn < startOn) startOn = a.earlyStartOn;
    if (a.earlyFinishOn > finishOn) finishOn = a.earlyFinishOn;
  }
  return { startOn, finishOn };
}

/**
 * Left/width as percent of the shared axis for an inclusive bar.
 * Zero-width bars get a minimum visible width so a 1-day activity still paints.
 */
export function barPlacement(
  earlyStartOn: string,
  earlyFinishOn: string,
  axisStartOn: string,
  axisFinishOn: string,
): { leftPct: number; widthPct: number } {
  const axisStart = toDayNumber(axisStartOn);
  const axisFinish = toDayNumber(axisFinishOn);
  const span = axisFinish - axisStart + 1;
  if (span <= 0) return { leftPct: 0, widthPct: 0 };
  const start = toDayNumber(earlyStartOn);
  const finish = toDayNumber(earlyFinishOn);
  const left = Math.max(0, start - axisStart);
  const days = Math.max(1, finish - start + 1);
  const clipped = Math.min(days, span - left);
  return {
    leftPct: (left / span) * 100,
    widthPct: Math.max((clipped / span) * 100, 100 / span),
  };
}

/** Holidays that fall inside the axis (inclusive), for shaded columns. */
export function holidaysOnAxis(
  holidays: readonly { on: string; name: string }[],
  axisStartOn: string,
  axisFinishOn: string,
): { on: string; name: string; leftPct: number; widthPct: number }[] {
  const axisStart = toDayNumber(axisStartOn);
  const axisFinish = toDayNumber(axisFinishOn);
  const span = axisFinish - axisStart + 1;
  if (span <= 0) return [];
  return holidays
    .filter((h) => h.on >= axisStartOn && h.on <= axisFinishOn)
    .map((h) => {
      const day = toDayNumber(h.on);
      return {
        on: h.on,
        name: h.name,
        leftPct: ((day - axisStart) / span) * 100,
        widthPct: (1 / span) * 100,
      };
    });
}

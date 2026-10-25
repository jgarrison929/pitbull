/**
 * One working calendar: weekdays plus holiday dates.
 * Durations and lag count working days; dates are YYYY-MM-DD (UTC day).
 *
 * Working days are precomputed into a sorted index so addWorkingDays and
 * workingDayDelta are O(log n) binary searches — not per-day Date walks.
 */

export type WorkingCalendar = {
  /** True when `on` is a working day (weekday and not a holiday). */
  isWorkingDay(on: string): boolean;
  /** First working day strictly after `on`. */
  nextWorkingDay(on: string): string;
  /** First working day strictly before `on`. */
  prevWorkingDay(on: string): string;
  /**
   * Move `n` working days from `on`. Positive goes forward via nextWorkingDay;
   * negative goes backward via prevWorkingDay; zero returns `on` unchanged.
   */
  addWorkingDays(on: string, n: number): string;
  /**
   * Signed count of nextWorkingDay steps from `from` to `to` (0 when equal).
   * Both ends should be working days for float math.
   */
  workingDayDelta(from: string, to: string): number;
};

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Days since Unix epoch (UTC), from YYYY-MM-DD. */
export function toDayNumber(on: string): number {
  const y = Number(on.slice(0, 4));
  const m = Number(on.slice(5, 7));
  const d = Number(on.slice(8, 10));
  const era = Math.floor((y - (m <= 2 ? 1 : 0)) / 400);
  const yoe = y - (m <= 2 ? 1 : 0) - era * 400;
  const doy =
    Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** YYYY-MM-DD from UTC day-number. */
export function fromDayNumber(day: number): string {
  const z = day + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor(
    (doe -
      Math.floor(doe / 1460) +
      Math.floor(doe / 36524) -
      Math.floor(doe / 146096)) /
      365,
  );
  const y = yoe + era * 400;
  const doy =
    doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  const year = m <= 2 ? y + 1 : y;
  return `${String(year).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** 0 Sun … 6 Sat (1970-01-01 was Thursday). */
function dowOf(day: number): number {
  return ((day + 4) % 7 + 7) % 7;
}

function assertIsoDay(on: string): void {
  if (!ISO_DAY.test(on)) {
    throw new Error(`working calendar expects YYYY-MM-DD, got ${on}`);
  }
}

/** First index i with days[i] >= target; days.length if none. */
function lowerBound(days: readonly number[], target: number): number {
  let lo = 0;
  let hi = days.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (days[mid]! < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** First index i with days[i] > target; days.length if none. */
function upperBound(days: readonly number[], target: number): number {
  let lo = 0;
  let hi = days.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (days[mid]! <= target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export type WorkingCalendarOptions = {
  /** Inclusive range start (YYYY-MM-DD). Default 1990-01-01. */
  from?: string;
  /** Inclusive range end (YYYY-MM-DD). Default 2140-12-31. */
  to?: string;
};

/**
 * Mon–Fri calendar with an optional holiday set (YYYY-MM-DD).
 * Holidays never count as working days, even mid-week.
 * Builds a sorted working-day index over [from, to] for O(log n) arithmetic.
 */
export function createWorkingCalendar(
  holidays: readonly string[] = [],
  options: WorkingCalendarOptions = {},
): WorkingCalendar {
  const fromOn = options.from ?? "1990-01-01";
  const toOn = options.to ?? "2140-12-31";
  assertIsoDay(fromOn);
  assertIsoDay(toOn);

  const holidayDays = new Set<number>();
  for (const h of holidays) {
    assertIsoDay(h);
    holidayDays.add(toDayNumber(h));
  }

  const fromDay = toDayNumber(fromOn);
  const toDay = toDayNumber(toOn);
  if (toDay < fromDay) {
    throw new Error(`working calendar range inverted: ${fromOn} … ${toOn}`);
  }

  // Sorted working-day numbers in [fromDay, toDay].
  const days: number[] = [];
  for (let d = fromDay; d <= toDay; d++) {
    const dow = dowOf(d);
    if (dow === 0 || dow === 6) continue;
    if (holidayDays.has(d)) continue;
    days.push(d);
  }

  const at = (index: number): string => {
    if (index < 0 || index >= days.length) {
      throw new Error(
        `working calendar index ${index} out of range [0, ${days.length}) — widen from/to`,
      );
    }
    return fromDayNumber(days[index]!);
  };

  const isWorkingDay = (on: string): boolean => {
    assertIsoDay(on);
    const day = toDayNumber(on);
    const dow = dowOf(day);
    if (dow === 0 || dow === 6) return false;
    return !holidayDays.has(day);
  };

  const nextWorkingDay = (on: string): string => {
    assertIsoDay(on);
    const day = toDayNumber(on);
    const idx = upperBound(days, day); // first working day > on
    return at(idx);
  };

  const prevWorkingDay = (on: string): string => {
    assertIsoDay(on);
    const day = toDayNumber(on);
    const idx = lowerBound(days, day) - 1; // last working day < on
    return at(idx);
  };

  const addWorkingDays = (on: string, n: number): string => {
    assertIsoDay(on);
    if (n === 0) return on;
    const day = toDayNumber(on);
    if (n > 0) {
      // n× nextWorkingDay: days[upperBound(on) + n - 1]
      return at(upperBound(days, day) + n - 1);
    }
    // |n|× prevWorkingDay: days[lowerBound(on) + n]
    return at(lowerBound(days, day) + n);
  };

  const workingDayDelta = (from: string, to: string): number => {
    assertIsoDay(from);
    assertIsoDay(to);
    if (from === to) return 0;
    const fromDayNum = toDayNumber(from);
    const toDayNum = toDayNumber(to);
    // Indices of the working days themselves (both must be working for float).
    const fromIdx = lowerBound(days, fromDayNum);
    const toIdx = lowerBound(days, toDayNum);
    if (days[fromIdx] !== fromDayNum || days[toIdx] !== toDayNum) {
      // Fallback for non-working endpoints: count nextWorkingDay steps.
      if (toDayNum > fromDayNum) {
        let n = 0;
        let cursor = fromDayNum;
        const target = toDayNum;
        while (cursor < target) {
          const idx = upperBound(days, cursor);
          cursor = days[idx]!;
          n += 1;
          if (n > days.length) throw new Error("workingDayDelta diverged");
        }
        return n;
      }
      let n = 0;
      let cursor = fromDayNum;
      const target = toDayNum;
      while (cursor > target) {
        const idx = lowerBound(days, cursor) - 1;
        cursor = days[idx]!;
        n -= 1;
        if (n < -days.length) throw new Error("workingDayDelta diverged");
      }
      return n;
    }
    return toIdx - fromIdx;
  };

  return {
    isWorkingDay,
    nextWorkingDay,
    prevWorkingDay,
    addWorkingDays,
    workingDayDelta,
  };
}

// Rules for one daily-plan line. Pure, so the form, the server action and the assistant share them.

export const LIMITS = {
  workers: { min: 1, max: 50, step: 1 },
  hours: { min: 0.5, max: 24, step: 0.1 },
  qty: { min: 0, max: 10_000_000, step: 0.001 },
  manHours: { min: 0.5, max: 1200, step: 0.1 },
  text: { max: 120 },
  notes: { max: 500 },
} as const;

/** Daily report allows 0 MH / 0 qty; rejects negatives and extremes. */
export const REPORT_LIMITS = {
  manHours: { min: 0, max: 1200 },
  qty: { min: 0, max: 10_000_000 },
} as const;

/** Values as the form or the assistant sends them. Every field is optional; omitted fields keep their value. */
export type LineInput = {
  costItemId?: string;
  activity?: string;
  location?: string;
  qty?: string | number;
  workers?: string | number;
  hours?: string | number;
  manHours?: string | number;
  notes?: string;
};

export type LineValues = {
  costItemId: string;
  activity: string;
  location: string;
  qtyMilli: number;
  workers: number;
  hoursTenths: number;
  notes: string;
};

export type LineErrors = Partial<Record<keyof LineInput, string>>;

const num = (v: string | number | undefined) =>
  v === undefined || v === "" ? undefined : Number(String(v).replace(/,/g, ""));

/**
 * Meets a man-hours target by changing as little as possible: more or fewer workers when the
 * hours divide evenly (60 → 80 MH at 10 h is 6 → 8 workers), otherwise the hours, to 0.1 h.
 */
export function rebalance(
  workers: number,
  hoursTenths: number,
  manHours: number,
) {
  const targetTenths = Math.round(manHours * 10);
  if (hoursTenths > 0 && targetTenths % hoursTenths === 0) {
    const w = targetTenths / hoursTenths;
    if (w >= LIMITS.workers.min && w <= LIMITS.workers.max)
      return { workers: w, hoursTenths };
  }
  return { workers, hoursTenths: Math.round(targetTenths / workers) };
}

/** Applies a change to a line and validates it. allowedCostItems are this job's cost items. */
export function applyLineInput(
  current: LineValues,
  input: LineInput,
  allowedCostItems: string[],
):
  | { values: LineValues; errors?: undefined }
  | { errors: LineErrors; values?: undefined } {
  const errors: LineErrors = {};
  const v: LineValues = { ...current };

  if (input.costItemId !== undefined) {
    if (!allowedCostItems.includes(input.costItemId))
      errors.costItemId = "Pick a cost code from this job's list.";
    else v.costItemId = input.costItemId;
  }
  for (const key of ["activity", "location"] as const) {
    if (input[key] === undefined) continue;
    const s = input[key]!.trim();
    if (key === "activity" && !s) errors.activity = "Describe the activity.";
    else if (s.length > LIMITS.text.max)
      errors[key] = `Keep it under ${LIMITS.text.max} characters.`;
    else v[key] = s;
  }
  if (input.notes !== undefined) {
    const s = input.notes.trim();
    if (s.length > LIMITS.notes.max)
      errors.notes = `Keep notes under ${LIMITS.notes.max} characters.`;
    else v.notes = s;
  }
  const qty = num(input.qty);
  if (qty !== undefined) {
    if (!Number.isFinite(qty) || qty < LIMITS.qty.min || qty > LIMITS.qty.max)
      errors.qty = "Enter a quantity of 0 or more.";
    else v.qtyMilli = Math.round(qty * 1000);
  }
  const workers = num(input.workers);
  if (workers !== undefined) {
    if (
      !Number.isInteger(workers) ||
      workers < LIMITS.workers.min ||
      workers > LIMITS.workers.max
    )
      errors.workers = `Workers must be a whole number from ${LIMITS.workers.min} to ${LIMITS.workers.max}.`;
    else v.workers = workers;
  }
  const hours = num(input.hours);
  if (hours !== undefined) {
    if (
      !Number.isFinite(hours) ||
      hours < LIMITS.hours.min ||
      hours > LIMITS.hours.max
    )
      errors.hours = `Hours must be from ${LIMITS.hours.min} to ${LIMITS.hours.max}.`;
    else v.hoursTenths = Math.round(hours * 10);
  }
  const mh = num(input.manHours);
  if (mh !== undefined && !errors.workers && !errors.hours) {
    if (
      !Number.isFinite(mh) ||
      mh < LIMITS.manHours.min ||
      mh > LIMITS.manHours.max
    )
      errors.manHours = `Man-hours must be from ${LIMITS.manHours.min} to ${LIMITS.manHours.max}.`;
    else if (Math.round(mh * 10) !== v.workers * v.hoursTenths) {
      const r = rebalance(v.workers, v.hoursTenths, mh);
      if (
        r.hoursTenths / 10 > LIMITS.hours.max ||
        r.hoursTenths / 10 < LIMITS.hours.min
      )
        errors.manHours = `That needs ${r.hoursTenths / 10} h per worker. Change workers or hours instead.`;
      else Object.assign(v, r);
    }
  }
  return Object.keys(errors).length ? { errors } : { values: v };
}

export const manHoursOf = (v: Pick<LineValues, "workers" | "hoursTenths">) =>
  (v.workers * v.hoursTenths) / 10;

// Earned value math over integer cents and milli-quantities. Pure, so screens, actions and tests share it.
// Percent complete comes from a PM-locked progress claim. Actuals and installed qty come from field reports.

export type EvMethod = "units" | "milestones" | "pm_percent";

export type CostLineInput = {
  code: string;
  description: string;
  unit: string;
  budgetQtyMilli: number;
  installedQtyMilli: number;
  budgetCents: number;
  plannedCents: number;
  actualCents: number;
  budgetMhPerUnitMilli: number;
  /** Locked claim percent, in thousandths of 100% (500 = 50%). */
  claimedPercentMilli: number;
  evMethod: EvMethod;
  /** How this line's locked earned percent was derived (shown on the job page). */
  earnDerivation: string;
};

export type CostLine<T extends CostLineInput = CostLineInput> = T & {
  percent: number;
  earnedCents: number;
  /** Cost variance: earned minus actual. */
  varianceCents: number;
  /** Schedule variance: earned minus planned. */
  scheduleVarianceCents: number;
  cpi: number | null;
  spi: number | null;
};

/** Snapshot the percent a progress claim should freeze for one cost item. */
export function snapshotClaimPercent(input: {
  method: EvMethod;
  budgetQtyMilli: number;
  installedQtyMilli: number;
  unit: string;
  /** Sum of weights of completed milestones, in thousandths (1000 = 100%). */
  milestoneCompleteWeightMilli: number;
  /** Latest PM percent entry, in thousandths. */
  pmPercentMilli: number;
  milestones?: { name: string; weightMilli: number; complete: boolean }[];
}): { percentMilli: number; derivation: string } {
  const clamp = (n: number) => Math.max(0, Math.min(1000, Math.round(n)));
  if (input.method === "units") {
    const percentMilli =
      input.budgetQtyMilli === 0
        ? 0
        : clamp((input.installedQtyMilli * 1000) / input.budgetQtyMilli);
    const installed = input.installedQtyMilli / 1000;
    const budget = input.budgetQtyMilli / 1000;
    return {
      percentMilli,
      derivation: `units complete: ${fmtQty(installed)} of ${fmtQty(budget)} ${input.unit} installed`,
    };
  }
  if (input.method === "milestones") {
    const percentMilli = clamp(input.milestoneCompleteWeightMilli);
    const parts = (input.milestones ?? [])
      .map(
        (m) =>
          `${m.name} ${m.weightMilli / 10}%${m.complete ? " ✓" : " (open)"}`,
      )
      .join("; ");
    return {
      percentMilli,
      derivation: parts
        ? `weighted milestones: ${parts} → ${percentMilli / 10}%`
        : `weighted milestones: ${percentMilli / 10}% complete`,
    };
  }
  const percentMilli = clamp(input.pmPercentMilli);
  return {
    percentMilli,
    derivation: `PM percent complete: ${percentMilli / 10}%`,
  };
}

const fmtQty = (n: number) =>
  n.toLocaleString("en-US", { maximumFractionDigits: 2 });

/**
 * Linear time-phased planned value between planned start and finish (inclusive-ish).
 * Before start → 0; on/after finish → full budget.
 */
export function plannedValueCents(
  budgetCents: number,
  startOn: string,
  finishOn: string,
  asOf: Date,
): number {
  const start = Date.parse(`${startOn}T00:00:00Z`);
  const finish = Date.parse(`${finishOn}T00:00:00Z`);
  const t = Date.UTC(
    asOf.getUTCFullYear(),
    asOf.getUTCMonth(),
    asOf.getUTCDate(),
  );
  if (!(finish > start)) return budgetCents;
  if (t <= start) return 0;
  if (t >= finish) return budgetCents;
  return Math.round((budgetCents * (t - start)) / (finish - start));
}

/** Labor amount from man-hours and a cents-per-hour crew rate. */
export function laborCents(manHours: number, rateCentsPerHour: number) {
  return Math.round(manHours * rateCentsPerHour);
}

export function costLine<T extends CostLineInput>(c: T): CostLine<T> {
  const percent = c.claimedPercentMilli / 1000;
  const earnedCents = Math.round(c.budgetCents * percent);
  return {
    ...c,
    percent,
    earnedCents,
    varianceCents: earnedCents - c.actualCents,
    scheduleVarianceCents: earnedCents - c.plannedCents,
    cpi: c.actualCents === 0 ? null : earnedCents / c.actualCents,
    spi: c.plannedCents === 0 ? null : earnedCents / c.plannedCents,
  };
}

export type Rollup = {
  budgetCents: number;
  plannedCents: number;
  earnedCents: number;
  actualCents: number;
  costVarianceCents: number;
  scheduleVarianceCents: number;
  percent: number;
  cpi: number;
  spi: number;
  /** Estimate at completion, assuming the current CPI holds. */
  eacCents: number;
};

export function rollup(lines: CostLine[]): Rollup {
  const sum = (f: (l: CostLine) => number) =>
    lines.reduce((s, l) => s + f(l), 0);
  const budgetCents = sum((l) => l.budgetCents);
  const plannedCents = sum((l) => l.plannedCents);
  const earnedCents = sum((l) => l.earnedCents);
  const actualCents = sum((l) => l.actualCents);
  const cpi = actualCents === 0 ? 1 : earnedCents / actualCents;
  return {
    budgetCents,
    plannedCents,
    earnedCents,
    actualCents,
    costVarianceCents: earnedCents - actualCents,
    scheduleVarianceCents: earnedCents - plannedCents,
    percent: budgetCents === 0 ? 0 : earnedCents / budgetCents,
    cpi,
    spi: plannedCents === 0 ? 1 : earnedCents / plannedCents,
    eacCents: Math.round(budgetCents / cpi),
  };
}

export const usdShort = (cents: number) => {
  const n = cents / 100;
  const a = Math.abs(n);
  const s =
    a >= 1e6
      ? `$${(a / 1e6).toFixed(1)}M`
      : a >= 1e3
        ? `$${Math.round(a / 1e3)}K`
        : `$${Math.round(a)}`;
  return n < 0 ? `−${s}` : s;
};
export const pct = (n: number) => `${Math.round(n * 100)}%`;
export const idx = (n: number | null) => (n === null ? "—" : n.toFixed(2));
export const qty = (milli: number) =>
  (milli / 1000).toLocaleString("en-US", { maximumFractionDigits: 2 });

/** Default heavy-civil crew rate used when posting foreman hours to actuals. */
export const DEFAULT_LABOR_RATE_CENTS = 8500;

// Earned value and forecast math over integer cents and milli-quantities.
// Pure: screens, SQL roll-ups, actions, and tests share these formulas.
// Percent complete and AC for indices come from the last PM-locked period (one cutoff).
// Live installs and cost posted since that lock show as separate "since lock" figures.

export type EvMethod = "units" | "milestones" | "pm_percent";

/** Per-item forecast method. Only current_budget is selectable; average_performance was removed. */
export type ForecastMethod = "current_budget";

export type CostLineInput = {
  code: string;
  description: string;
  unit: string;
  budgetQtyMilli: number;
  /** Live installed from field reports — pending until PM locks. */
  installedQtyMilli: number;
  /**
   * Installed qty frozen on the last locked claim.
   * Units EV uses this so live installs cannot bypass the lock.
   */
  claimedInstalledQtyMilli: number;
  budgetCents: number;
  /**
   * Planned value as of the EV cutoff (last lock date, or today if never locked).
   * Must match plannedValueCents(budget, start, finish, cutoff).
   */
  plannedCents: number;
  /**
   * Actual cost at the EV cutoff (frozen on lock). Live cost above this is
   * `liveActualCents - actualCents` and is shown as "since lock", not in CPI.
   */
  actualCents: number;
  /** Live actual (sum of cost_entries). Defaults to actualCents when omitted. */
  liveActualCents?: number;
  /**
   * Planned value as of "today" (read time). Used only for the since-lock PV delta.
   * Defaults to plannedCents when omitted.
   */
  livePlannedCents?: number;
  budgetMhPerUnitMilli: number;
  /** Locked claim percent, in thousandths of 100% (500 = 50%). */
  claimedPercentMilli: number;
  evMethod: EvMethod;
  forecastMethod: ForecastMethod;
  /** How this line's locked earned percent was derived (shown on the job page). */
  earnDerivation: string;
  /**
   * Foreman-reported qty awaiting superintendent approval.
   * Not in installed/actual until approve — shown as pending on the job page.
   */
  approvalPendingQtyMilli?: number;
  /** Labor cents for those pending hours (rate × MH). */
  approvalPendingCents?: number;
};

export type CostLine<T extends CostLineInput = CostLineInput> = T & {
  percent: number;
  earnedCents: number;
  /** Cost variance: earned minus actual (at cutoff). */
  varianceCents: number;
  /** Schedule variance: earned minus planned (at cutoff). */
  scheduleVarianceCents: number;
  cpi: number | null;
  spi: number | null;
  /** Claimed installed above budget qty (units); flagged on the job page. */
  overBudgetQtyMilli: number;
  /** Earned man-hours in milli-MH (claimed qty × budget MH/unit). */
  earnedMhMilli: number;
  eacCents: number;
  etcCents: number;
  forecastDerivation: string;
  /** Live actual minus cutoff actual (cost posted since lock). */
  sinceLockActualCents: number;
  /** Live PV minus cutoff PV (schedule advance since lock). */
  sinceLockPlannedCents: number;
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
 * Linear time-phased planned value between planned start and finish.
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

/**
 * Units EV from claimed installed / budget qty, capped at BAC so over-install
 * cannot earn past budget. Milestones and PM percent use locked claim percent.
 * Exact fraction: 248/620 of $868,000 = $347,200 (no prior percent rounding).
 */
export function earnedCentsOf(
  c: Pick<
    CostLineInput,
    | "evMethod"
    | "budgetQtyMilli"
    | "budgetCents"
    | "claimedInstalledQtyMilli"
    | "claimedPercentMilli"
  >,
): number {
  if (c.evMethod === "units" && c.budgetQtyMilli > 0) {
    const raw = Math.round(
      (c.budgetCents * c.claimedInstalledQtyMilli) / c.budgetQtyMilli,
    );
    return Math.min(c.budgetCents, raw);
  }
  return Math.round((c.budgetCents * c.claimedPercentMilli) / 1000);
}

/** Claimed installed above budget quantity (units method). */
export function overBudgetQtyMilliOf(c: CostLineInput): number {
  if (c.evMethod !== "units" || c.budgetQtyMilli <= 0) return 0;
  return Math.max(0, c.claimedInstalledQtyMilli - c.budgetQtyMilli);
}

/**
 * Earned man-hours in milli-MH: claimed installed × budget MH per unit.
 * 248 CY × 1.600 MH/CY → 396.8 MH (396_800 milli).
 */
export function earnedMhMilliOf(c: CostLineInput): number {
  if (c.evMethod !== "units" || c.budgetQtyMilli <= 0) {
    // Milestones / PM %: earn MH in proportion to locked percent of budget MH total.
    const budgetMhMilli = Math.round(
      (c.budgetQtyMilli * c.budgetMhPerUnitMilli) / 1000,
    );
    return Math.round((budgetMhMilli * c.claimedPercentMilli) / 1000);
  }
  return Math.round(
    (c.claimedInstalledQtyMilli * c.budgetMhPerUnitMilli) / 1000,
  );
}

/** Live installed above the locked claim — shown as pending, not yet earned. */
export function pendingInstalledQtyMilli(c: CostLineInput): number {
  if (c.evMethod !== "units") return 0;
  return Math.max(0, c.installedQtyMilli - c.claimedInstalledQtyMilli);
}

/**
 * Per-item estimate at completion and estimate to complete.
 * current_budget only: EAC = AC + (BAC − EV).
 */
export function itemForecast(input: {
  forecastMethod: ForecastMethod;
  budgetCents: number;
  earnedCents: number;
  actualCents: number;
}): {
  eacCents: number;
  etcCents: number;
  forecastDerivation: string;
} {
  const bac = input.budgetCents;
  const ev = input.earnedCents;
  const ac = input.actualCents;
  const eacCents = ac + (bac - ev);
  return {
    eacCents,
    etcCents: eacCents - ac,
    forecastDerivation: `EAC ${usdPlain(eacCents)} = ${usdPlain(ac)} + (${usdPlain(bac)} − ${usdPlain(ev)}) (current budget)`,
  };
}

function usdPlain(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function costLine<T extends CostLineInput>(c: T): CostLine<T> {
  const earnedCents = earnedCentsOf(c);
  const percent = c.budgetCents === 0 ? 0 : earnedCents / c.budgetCents;
  const forecast = itemForecast({
    forecastMethod: c.forecastMethod,
    budgetCents: c.budgetCents,
    earnedCents,
    actualCents: c.actualCents,
  });
  const liveActual = c.liveActualCents ?? c.actualCents;
  const livePlanned = c.livePlannedCents ?? c.plannedCents;
  return {
    ...c,
    percent,
    earnedCents,
    varianceCents: earnedCents - c.actualCents,
    scheduleVarianceCents: earnedCents - c.plannedCents,
    cpi:
      c.budgetCents === 0 || c.actualCents === 0
        ? null
        : earnedCents / c.actualCents,
    spi:
      c.budgetCents === 0 || c.plannedCents === 0
        ? null
        : earnedCents / c.plannedCents,
    overBudgetQtyMilli: overBudgetQtyMilliOf(c),
    earnedMhMilli: earnedMhMilliOf(c),
    eacCents: forecast.eacCents,
    etcCents: forecast.etcCents,
    forecastDerivation: forecast.forecastDerivation,
    sinceLockActualCents: liveActual - c.actualCents,
    sinceLockPlannedCents: livePlanned - c.plannedCents,
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
  /** null when budget is $0 or nothing spent yet — screens show "—", not 1.00. */
  cpi: number | null;
  /** null when budget is $0 or nothing planned yet — screens show "—", not 1.00. */
  spi: number | null;
  /** Job / portfolio EAC = sum of per-item EACs (not BAC ÷ CPI). */
  eacCents: number;
  etcCents: number;
  sinceLockActualCents: number;
  sinceLockPlannedCents: number;
};

/** Build a Rollup from already-summed leaf totals (shared by JS and SQL paths). */
export function rollupFromTotals(t: {
  budgetCents: number;
  plannedCents: number;
  earnedCents: number;
  actualCents: number;
  eacCents: number;
  etcCents?: number;
  sinceLockActualCents?: number;
  sinceLockPlannedCents?: number;
}): Rollup {
  const {
    budgetCents,
    plannedCents,
    earnedCents,
    actualCents,
    eacCents,
  } = t;
  return {
    budgetCents,
    plannedCents,
    earnedCents,
    actualCents,
    costVarianceCents: earnedCents - actualCents,
    scheduleVarianceCents: earnedCents - plannedCents,
    percent: budgetCents === 0 ? 0 : earnedCents / budgetCents,
    cpi:
      budgetCents === 0 || actualCents === 0
        ? null
        : earnedCents / actualCents,
    spi:
      budgetCents === 0 || plannedCents === 0
        ? null
        : earnedCents / plannedCents,
    eacCents,
    etcCents: t.etcCents ?? eacCents - actualCents,
    sinceLockActualCents: t.sinceLockActualCents ?? 0,
    sinceLockPlannedCents: t.sinceLockPlannedCents ?? 0,
  };
}

export function rollup(lines: CostLine[]): Rollup {
  const sum = (f: (l: CostLine) => number) =>
    lines.reduce((s, l) => s + f(l), 0);
  return rollupFromTotals({
    budgetCents: sum((l) => l.budgetCents),
    plannedCents: sum((l) => l.plannedCents),
    earnedCents: sum((l) => l.earnedCents),
    actualCents: sum((l) => l.actualCents),
    eacCents: sum((l) => l.eacCents),
    etcCents: sum((l) => l.etcCents),
    sinceLockActualCents: sum((l) => l.sinceLockActualCents),
    sinceLockPlannedCents: sum((l) => l.sinceLockPlannedCents),
  });
}

/**
 * Daily S-curve points for a job. Cumulative PV is linear per item; EV and AC
 * at the cutoff are flat (period snapshot). Last PV point equals BAC.
 */
export function sCurvePoints(
  items: {
    budgetCents: number;
    plannedStartOn: string;
    plannedFinishOn: string;
    earnedCents: number;
    actualCents: number;
  }[],
  fromOn: string,
  toOn: string,
): { on: string; plannedCents: number; earnedCents: number; actualCents: number }[] {
  const bac = items.reduce((s, i) => s + i.budgetCents, 0);
  const earned = items.reduce((s, i) => s + i.earnedCents, 0);
  const actual = items.reduce((s, i) => s + i.actualCents, 0);
  const out: {
    on: string;
    plannedCents: number;
    earnedCents: number;
    actualCents: number;
  }[] = [];
  const start = Date.parse(`${fromOn}T00:00:00Z`);
  const end = Date.parse(`${toOn}T00:00:00Z`);
  for (let t = start; t <= end; t += 86_400_000) {
    const asOf = new Date(t);
    const on = asOf.toISOString().slice(0, 10);
    const plannedCents = items.reduce(
      (s, i) =>
        s +
        plannedValueCents(
          i.budgetCents,
          i.plannedStartOn,
          i.plannedFinishOn,
          asOf,
        ),
      0,
    );
    out.push({ on, plannedCents, earnedCents: earned, actualCents: actual });
  }
  if (out.length && out[out.length - 1]!.plannedCents !== bac) {
    // Guarantee the terminal PV equals BAC when the window reaches every finish.
    const last = out[out.length - 1]!;
    const allFinished = items.every((i) => i.plannedFinishOn <= toOn);
    if (allFinished) last.plannedCents = bac;
  }
  return out;
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
/** Exact dollars and cents from integer cents by integer math: 6_000_000 → "$60,000.00". */
export const usdCents = (cents: number) => {
  const a = Math.abs(cents);
  const dollars = Math.trunc(a / 100).toLocaleString("en-US");
  const s = `$${dollars}.${String(a % 100).padStart(2, "0")}`;
  return cents < 0 ? `−${s}` : s;
};
export const pct = (n: number) => `${Math.round(n * 100)}%`;
export const idx = (n: number | null) => (n === null ? "—" : n.toFixed(2));
export const qty = (milli: number) =>
  (milli / 1000).toLocaleString("en-US", { maximumFractionDigits: 2 });
export const mh = (milli: number) =>
  (milli / 1000).toLocaleString("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

/**
 * Installed quantities grouped by unit. Never sum CY + LB + DAY into one number.
 * Empty string when nothing was installed.
 */
export function formatInstalledByUnit(
  byUnit: Record<string, number>,
): string {
  const parts = Object.entries(byUnit)
    .filter(([, milli]) => milli !== 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([unit, milli]) => `${qty(milli)} ${unit}`);
  if (!parts.length) return "";
  return `${parts.join(", ")} installed`;
}

/** Default heavy-civil crew rate used when posting foreman hours to actuals. */
export const DEFAULT_LABOR_RATE_CENTS = 8500;

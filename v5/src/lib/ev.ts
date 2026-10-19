// Earned value math over integer cents and milli-quantities. Pure, so screens, actions and tests share it.

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
};

export type CostLine<T extends CostLineInput = CostLineInput> = T & {
  percent: number;
  earnedCents: number;
  varianceCents: number;
  cpi: number | null;
};

export function costLine<T extends CostLineInput>(c: T): CostLine<T> {
  const percent =
    c.budgetQtyMilli === 0 ? 0 : c.installedQtyMilli / c.budgetQtyMilli;
  const earnedCents = Math.round(c.budgetCents * percent);
  return {
    ...c,
    percent,
    earnedCents,
    varianceCents: earnedCents - c.actualCents,
    cpi: c.actualCents === 0 ? null : earnedCents / c.actualCents,
  };
}

export type Rollup = {
  budgetCents: number;
  plannedCents: number;
  earnedCents: number;
  actualCents: number;
  costVarianceCents: number;
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
    percent: budgetCents === 0 ? 0 : earnedCents / budgetCents,
    cpi,
    spi: plannedCents === 0 ? 1 : earnedCents / plannedCents,
    eacCents: Math.round(budgetCents / cpi),
  };
}

export type Health = "on-track" | "watch" | "at-risk";
/** Thresholds on the worse of CPI and SPI. */
export function health(index: number): Health {
  if (index >= 0.98) return "on-track";
  if (index >= 0.93) return "watch";
  return "at-risk";
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

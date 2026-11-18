/** One calendar day on the S-curve (civil YYYY-MM-DD). Shared by server + chart. */
export type CurvePoint = {
  on: string;
  plannedCents: number;
  /** null after the cutoff (and before the first lock). */
  earnedCents: number | null;
  /** null after the cutoff (and before the first lock). */
  actualCents: number | null;
};

export type CurveResult = {
  cutoffOn: string | null;
  points: CurvePoint[];
};

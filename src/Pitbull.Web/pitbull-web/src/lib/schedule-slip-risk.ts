/**
 * Schedule slip risk flag for field mobile entry (2.20.3).
 * Proxy labeled — never claims certainty or invents baseline dates.
 */

export type ScheduleSlipInput = {
  /** ISO date YYYY-MM-DD of report / work day */
  reportDate: string;
  /** Optional planned finish from schedule activity (ISO or empty) */
  plannedFinishDate?: string | null;
  /** Optional activity name for display */
  activityName?: string | null;
};

export type ScheduleSlipRisk = {
  /** When true, show amber risk chip */
  showFlag: boolean;
  /** Days late (positive = past planned finish); null if unknown */
  daysLate: number | null;
  label: string;
  truthNote: string;
  band: "none" | "watch" | "risk" | "insufficient";
};

function parseDay(iso: string): number | null {
  const t = iso.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const ms = Date.parse(`${t}T12:00:00.000Z`);
  if (Number.isNaN(ms)) return null;
  return Math.floor(ms / 86_400_000);
}

/**
 * Compare report day to planned finish. Missing planned date → insufficient (no fake risk).
 */
export function evaluateScheduleSlipRisk(input: ScheduleSlipInput): ScheduleSlipRisk {
  const report = parseDay(input.reportDate);
  const plannedRaw = input.plannedFinishDate?.trim() ?? "";
  if (!plannedRaw || report === null) {
    return {
      showFlag: false,
      daysLate: null,
      label: "",
      truthNote:
        "No planned finish on the linked activity — cannot score slip (not all-clear).",
      band: "insufficient",
    };
  }
  const planned = parseDay(plannedRaw);
  if (planned === null) {
    return {
      showFlag: false,
      daysLate: null,
      label: "",
      truthNote: "Planned finish unreadable — slip not scored (proxy unavailable).",
      band: "insufficient",
    };
  }

  const daysLate = report - planned;
  const act = input.activityName?.trim() || "Linked activity";

  if (daysLate <= 0) {
    return {
      showFlag: false,
      daysLate,
      label: "",
      truthNote:
        "Report day is on or before planned finish (proxy from dates only — not progress certainty).",
      band: "none",
    };
  }

  if (daysLate <= 3) {
    return {
      showFlag: true,
      daysLate,
      label: `Watch: ${act} ~${daysLate}d past planned finish*`,
      truthNote:
        "*Proxy from planned finish vs report date only — not a forecast. No invented % complete.",
      band: "watch",
    };
  }

  return {
    showFlag: true,
    daysLate,
    label: `Risk: ${act} ~${daysLate}d past planned finish*`,
    truthNote:
      "*Proxy from planned finish vs report date only — not a forecast. No invented % complete or cost.",
    band: "risk",
  };
}

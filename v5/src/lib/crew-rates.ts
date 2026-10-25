/** Spec 5.0.2 Part A — blended crew labor rates (cents per MH). */
export const CREW_LABOR_RATE_CENTS = {
  "Bridge Crew 2": 9250,
  "Culvert Crew A": 7800,
  "Interchange Crew 1": 8800,
} as const;

export type CrewLaborRateName = keyof typeof CREW_LABOR_RATE_CENTS;

/**
 * Expand-window DB DEFAULT on `crews.labor_rate_cents` (migration 0014).
 * Used when a plan has null `crew_id` and no matching crew name — not a
 * product flat rate for new writes.
 */
export const CREW_RATE_EXPAND_DEFAULT_CENTS = 8500;

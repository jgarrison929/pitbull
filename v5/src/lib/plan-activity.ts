/** Plan-line ↔ schedule activity helpers (shared by server + client picker). */

export type PlanActivityOption = {
  id: string;
  code: string;
  name: string;
  earlyStartOn: string;
  earlyFinishOn: string;
  /** First linked leaf cost item id, when any. */
  costItemId: string | null;
};

/** Activities whose early dates cover `planDate` (inclusive). */
export function activitiesCoveringDate(
  options: readonly PlanActivityOption[],
  planDate: string,
): PlanActivityOption[] {
  return options.filter(
    (a) => a.earlyStartOn <= planDate && a.earlyFinishOn >= planDate,
  );
}

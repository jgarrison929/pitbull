/**
 * Must-fail tests that share formulas with production (or hard-code both
 * inputs) stay green when the live behavior breaks — Verify FAIL on #715 / #719.
 */

/**
 * Past mistake (#715): budget = insertWorkStatementCount(rows) while
 * phases.statements also came from the same formula — scratch sequential
 * awaits stayed green. A live must-fail records the tx (maxInFlight /
 * records / pending.length), not the seed-bag formula.
 */
export function sharesStatementBudgetFormula(testSource: string): boolean {
  const usesFormula =
    /insertWorkStatementCount\s*\(/.test(testSource) ||
    /resetTransactionStatementCount\s*\(/.test(testSource);
  if (!usesFormula) return false;
  const observesRecordingTx =
    /maxInFlight/.test(testSource) ||
    /records\.length/.test(testSource) ||
    /pending\.length/.test(testSource);
  return !observesRecordingTx;
}

/**
 * Past mistake (#719): PV must-fail hard-coded finishExclusive and the cents
 * ladder — inclusive finish never went through plannedFinishExclusiveOn.
 */
export function weakPvMustFail(testSource: string): boolean {
  const mentionsPv =
    /plannedValueCents|finishExclusive|plannedFinishExclusiveOn/.test(
      testSource,
    );
  if (!mentionsPv) return false;
  const hardCodesBoth =
    /finishExclusive\s*[:=]\s*["']\d{4}-\d{2}-\d{2}["']/.test(testSource) &&
    /plannedValueCents\s*\(/.test(testSource) &&
    !/plannedFinishExclusiveOn\s*\(/.test(testSource);
  return hardCodesBoth;
}

/**
 * Past mistake (#719): backward pass only capped LF when outs.length === 0;
 * SS-only successors left LF past job finish. Correct: seed `lf = jobFinish`
 * then tighten with successor constraints.
 */
export function cpmCapsLfAtJobFinish(cpmSource: string): boolean {
  const seedsUnconditionally = /let\s+lf\s*=\s*jobFinish\b/.test(cpmSource);
  const onlyWhenNoOuts =
    /outs\.length\s*===\s*0\s*\?\s*jobFinish/.test(cpmSource) ||
    /!outs\.length\s*\?\s*jobFinish/.test(cpmSource) ||
    /\(outs\.length\s*===\s*0\)\s*\?\s*jobFinish/.test(cpmSource);
  return seedsUnconditionally && !onlyWhenNoOuts;
}

/**
 * Past mistake (#719): addWorkingDays walked one calendar day at a time with
 * Date + ISO strings (~80% of samples in addCalendarDays).
 */
export function calendarUsesIndexedArithmetic(calendarSource: string): boolean {
  const hasIndex =
    /lowerBound|upperBound|workingDays\s*[:=]|days\.length/.test(
      calendarSource,
    ) && /toDayNumber|fromDayNumber|dayNumber/.test(calendarSource);
  const dayWalkSmell =
    /addCalendarDays\s*\(/.test(calendarSource) ||
    /for\s*\(\s*let\s+\w+\s*=\s*0;\s*\w+\s*<\s*Math\.abs/.test(calendarSource);
  return hasIndex && !dayWalkSmell;
}

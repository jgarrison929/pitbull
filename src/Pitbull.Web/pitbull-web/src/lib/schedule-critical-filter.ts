/**
 * Mobile schedule critical-path filter (2.14.5).
 */
export function filterCriticalPathTasks<T extends { isCritical?: boolean }>(
  tasks: readonly T[],
  criticalOnly: boolean
): T[] {
  if (!criticalOnly) return [...tasks];
  return tasks.filter((t) => t.isCritical === true);
}

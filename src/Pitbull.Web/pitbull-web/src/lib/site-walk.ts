/**
 * Pure helpers for site-walk look-ahead schedule + subcontractor status surfaces.
 */

export interface ScheduleLookAheadTask {
  id: string;
  name: string;
  status: string;
  plannedStart: string | null;
  plannedFinish: string | null;
  percentComplete: number;
  isCritical: boolean;
  wbsCode?: string;
}

export interface SubStatusItem {
  id: string;
  name: string;
  trade?: string | null;
  status: string;
  lastUpdate?: string | null;
  openIssuesCount: number;
  /** on_track | at_risk | delayed — derived for at-a-glance UI */
  health: "on_track" | "at_risk" | "delayed";
}

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDay(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

/**
 * Near-term look-ahead: activities with planned start/finish in [today, today+days]
 * or currently in progress. Critical path items ranked first.
 */
export function filterLookAheadTasks(
  tasks: ScheduleLookAheadTask[],
  now: Date = new Date(),
  daysAhead = 7
): ScheduleLookAheadTask[] {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endWindow = startOfToday + daysAhead * DAY_MS;

  const filtered = tasks.filter((task) => {
    if (task.status === "Completed" || task.status === "complete") return false;
    const ps = parseDay(task.plannedStart);
    const pf = parseDay(task.plannedFinish);
    if (task.percentComplete > 0 && task.percentComplete < 100) return true;
    if (ps != null && ps >= startOfToday && ps <= endWindow) return true;
    if (pf != null && pf >= startOfToday && pf <= endWindow) return true;
    if (ps != null && pf != null && ps <= startOfToday && pf >= startOfToday) return true;
    return false;
  });

  return filtered.sort((a, b) => {
    if (a.isCritical !== b.isCritical) return a.isCritical ? -1 : 1;
    const as = parseDay(a.plannedStart) ?? Number.MAX_SAFE_INTEGER;
    const bs = parseDay(b.plannedStart) ?? Number.MAX_SAFE_INTEGER;
    return as - bs;
  });
}

/**
 * Map subcontract + open RFI count into at-a-glance health.
 */
export function deriveSubHealth(
  status: string,
  openIssuesCount: number,
  insuranceCurrent?: boolean
): SubStatusItem["health"] {
  const s = status.toLowerCase();
  if (
    s.includes("terminat") ||
    s.includes("default") ||
    s === "cancelled" ||
    openIssuesCount >= 5
  ) {
    return "delayed";
  }
  if (
    insuranceCurrent === false ||
    openIssuesCount >= 2 ||
    s.includes("hold") ||
    s.includes("suspend")
  ) {
    return "at_risk";
  }
  return "on_track";
}

export function buildSubStatusItems(
  subs: Array<{
    id: string;
    subcontractorName: string;
    tradeCode?: string | null;
    status: string;
    updatedAt?: string | null;
    createdAt?: string;
    insuranceCurrent?: boolean;
  }>,
  openIssuesBySubId: Record<string, number> = {}
): SubStatusItem[] {
  return subs.map((sub) => {
    const openIssuesCount = openIssuesBySubId[sub.id] ?? 0;
    return {
      id: sub.id,
      name: sub.subcontractorName,
      trade: sub.tradeCode,
      status: String(sub.status),
      lastUpdate: sub.updatedAt ?? sub.createdAt ?? null,
      openIssuesCount,
      health: deriveSubHealth(
        String(sub.status),
        openIssuesCount,
        sub.insuranceCurrent
      ),
    };
  });
}

export function buildSiteWalkHref(projectId: string): string {
  return `/projects/${projectId}/site-walk`;
}

/**
 * Schedule activity Kanban helpers (band 3.7 / 3.6.6–3.6.7).
 * Columns are real activity status enums only — no fake WIP invent.
 */

export const SCHEDULE_KANBAN_COLUMNS = [
  { id: "NotStarted", label: "Not started" },
  { id: "InProgress", label: "In progress" },
  { id: "OnHold", label: "On hold" },
  { id: "Completed", label: "Completed" },
] as const;

export type ScheduleKanbanColumnId = (typeof SCHEDULE_KANBAN_COLUMNS)[number]["id"];

export type ScheduleKanbanCard = {
  id: string;
  name: string;
  status: string;
  isCritical?: boolean | null;
};

export const SCHEDULE_KANBAN_EMPTY =
  "No activities in this column. Empty means none — not a WIP health score.";

/** Normalize server status strings to a known column; unknown → NotStarted (no invent complete). */
export function normalizeKanbanStatus(status: string | null | undefined): ScheduleKanbanColumnId {
  const s = (status ?? "").replace(/\s+/g, "");
  const known = SCHEDULE_KANBAN_COLUMNS.map((c) => c.id);
  if (known.includes(s as ScheduleKanbanColumnId)) return s as ScheduleKanbanColumnId;
  // Common aliases
  if (/^complete/i.test(s)) return "Completed";
  if (/^in.?progress/i.test(s)) return "InProgress";
  if (/^on.?hold/i.test(s)) return "OnHold";
  if (/^not.?started|^ns$/i.test(s)) return "NotStarted";
  return "NotStarted";
}

export function groupActivitiesByKanbanColumn(
  cards: ScheduleKanbanCard[]
): Record<ScheduleKanbanColumnId, ScheduleKanbanCard[]> {
  const groups: Record<ScheduleKanbanColumnId, ScheduleKanbanCard[]> = {
    NotStarted: [],
    InProgress: [],
    OnHold: [],
    Completed: [],
  };
  for (const card of cards) {
    const col = normalizeKanbanStatus(card.status);
    groups[col].push(card);
  }
  return groups;
}

/** Status mutations on Kanban require explicit confirm (no silent drag-post). */
export function kanbanStatusChangeRequiresConfirm(): boolean {
  return true;
}

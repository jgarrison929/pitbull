import { describe, expect, it } from "vitest";
import {
  SCHEDULE_KANBAN_COLUMNS,
  SCHEDULE_KANBAN_EMPTY,
  groupActivitiesByKanbanColumn,
  kanbanStatusChangeRequiresConfirm,
  normalizeKanbanStatus,
} from "./schedule-kanban";

describe("schedule-kanban (band 3.7 / 3.6.6–3.6.7)", () => {
  it("columns are real activity statuses only", () => {
    const ids = SCHEDULE_KANBAN_COLUMNS.map((c) => c.id);
    expect(ids).toEqual(["NotStarted", "InProgress", "OnHold", "Completed"]);
    expect(ids).not.toContain("Healthy");
    expect(ids).not.toContain("AtRisk");
  });

  it("groups cards without inventing WIP", () => {
    const groups = groupActivitiesByKanbanColumn([
      { id: "1", name: "A", status: "InProgress" },
      { id: "2", name: "B", status: "Completed" },
      { id: "3", name: "C", status: "WeirdStatus" },
    ]);
    expect(groups.InProgress).toHaveLength(1);
    expect(groups.Completed).toHaveLength(1);
    expect(groups.NotStarted).toHaveLength(1); // unknown → NotStarted, not invent complete
    expect(groups.OnHold).toHaveLength(0);
  });

  it("empty copy is honest", () => {
    expect(SCHEDULE_KANBAN_EMPTY.toLowerCase()).toMatch(/not a wip health|none/);
  });

  it("status mutations require confirm", () => {
    expect(kanbanStatusChangeRequiresConfirm()).toBe(true);
  });

  it("normalizes aliases", () => {
    expect(normalizeKanbanStatus("in progress")).toBe("InProgress");
    expect(normalizeKanbanStatus("Complete")).toBe("Completed");
  });
});

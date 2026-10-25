import { describe, it, expect } from "vitest";
import { filterCriticalPathTasks } from "./schedule-critical-filter";

describe("filterCriticalPathTasks (2.14.5)", () => {
  const tasks = [
    { id: "1", isCritical: true },
    { id: "2", isCritical: false },
    { id: "3", isCritical: true },
  ];

  it("returns all when filter off", () => {
    expect(filterCriticalPathTasks(tasks, false)).toHaveLength(3);
  });

  it("returns only critical when filter on", () => {
    expect(filterCriticalPathTasks(tasks, true).map((t) => t.id)).toEqual([
      "1",
      "3",
    ]);
  });

  it("honest empty when none critical", () => {
    expect(filterCriticalPathTasks([{ id: "x", isCritical: false }], true)).toEqual(
      []
    );
  });
});

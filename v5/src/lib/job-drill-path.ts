/** Shared path parse for proxy + tests (drill-down / schedule 404s). */

export type DrillPath =
  | { kind: "job"; number: string }
  | { kind: "changes"; number: string }
  | { kind: "schedule"; number: string }
  | { kind: "cost-item"; number: string; code: string }
  | { kind: "plan"; number: string; planId: string };

/** Parse drill-down paths; ignore typeahead search and unknown shapes. */
export function parseJobDrillPath(pathname: string): DrillPath | null {
  const parts = pathname.split("/").filter(Boolean);
  // app / jobs / :number [ / changes | / schedule | / cost-items / :code | / plans / :id ]
  if (parts[0] !== "app" || parts[1] !== "jobs" || !parts[2]) return null;
  const number = decodeURIComponent(parts[2]);
  if (parts.length === 3) return { kind: "job", number };
  if (parts.length === 4 && parts[3] === "changes") {
    return { kind: "changes", number };
  }
  if (parts.length === 4 && parts[3] === "schedule") {
    return { kind: "schedule", number };
  }
  if (
    parts.length === 5 &&
    parts[3] === "cost-items" &&
    parts[4] &&
    parts[4] !== "search"
  ) {
    return {
      kind: "cost-item",
      number,
      code: decodeURIComponent(parts[4]),
    };
  }
  if (parts.length === 5 && parts[3] === "plans" && parts[4]) {
    return {
      kind: "plan",
      number,
      planId: decodeURIComponent(parts[4]),
    };
  }
  return null;
}

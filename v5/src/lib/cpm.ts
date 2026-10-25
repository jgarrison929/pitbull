/**
 * CPM-lite: finish-to-start and start-to-start with whole-day lag,
 * one working calendar, forward + backward pass, total float, critical path.
 * Pure — no database. Throws CycleError when the link graph has a cycle.
 */

import {
  fromDayNumber,
  toDayNumber,
  type WorkingCalendar,
} from "./working-calendar";

export type LinkType = "finish_to_start" | "start_to_start";

export type CpmActivity = {
  id: string;
  durationDays: number;
  startNoEarlierOn: string | null;
  earlyStartOn: string;
  earlyFinishOn: string;
  lateStartOn: string;
  lateFinishOn: string;
  totalFloatDays: number;
  isCritical: boolean;
};

export type CpmLink = {
  predecessorId: string;
  successorId: string;
  type: LinkType;
  lagDays: number;
};

export class CycleError extends Error {
  readonly cycle: string[];

  constructor(cycle: string[]) {
    const named = cycle.join(" → ");
    super(`Cycle refused: ${named}`);
    this.name = "CycleError";
    this.cycle = cycle;
  }
}

/**
 * Inclusive activity early finish → exclusive finish date for `plannedValueCents`.
 * PV treats the finish calendar day as a full working day, so the mapping is
 * finish + 1 calendar day (not a working-day step).
 */
export function plannedFinishExclusiveOn(earlyFinishOn: string): string {
  return fromDayNumber(toDayNumber(earlyFinishOn) + 1);
}

/**
 * Pure function. calendar supplies nextWorkingDay / prevWorkingDay / addWorkingDays.
 * Throws CycleError with the cycle path when a cycle exists.
 * Durations and lag count working days. Early finish is inclusive.
 */
export function runCpm(
  activities: readonly CpmActivity[],
  links: readonly CpmLink[],
  jobStartOn: string,
  calendar: WorkingCalendar,
): CpmActivity[] {
  if (activities.length === 0) return [];

  const byId = new Map<string, CpmActivity>();
  for (const a of activities) {
    if (byId.has(a.id)) {
      throw new Error(`Duplicate activity id: ${a.id}`);
    }
    if (!Number.isInteger(a.durationDays) || a.durationDays < 1) {
      throw new Error(
        `Activity ${a.id}: durationDays must be an integer ≥ 1`,
      );
    }
    byId.set(a.id, a);
  }

  for (const link of links) {
    if (link.type !== "finish_to_start" && link.type !== "start_to_start") {
      throw new Error(
        `Unsupported link type; supported: finish_to_start, start_to_start`,
      );
    }
    if (!Number.isInteger(link.lagDays) || link.lagDays < 0) {
      throw new Error(`Negative or non-integer lag refused`);
    }
    if (!byId.has(link.predecessorId) || !byId.has(link.successorId)) {
      throw new Error(
        `Link references unknown activity: ${link.predecessorId} → ${link.successorId}`,
      );
    }
  }

  const incoming = new Map<string, CpmLink[]>();
  const outgoing = new Map<string, CpmLink[]>();
  for (const a of activities) {
    incoming.set(a.id, []);
    outgoing.set(a.id, []);
  }
  for (const link of links) {
    incoming.get(link.successorId)!.push(link);
    outgoing.get(link.predecessorId)!.push(link);
  }

  const order = topologicalOrder(activities, outgoing);

  const earlyStart = new Map<string, string>();
  const earlyFinish = new Map<string, string>();

  for (const id of order) {
    const a = byId.get(id)!;
    let es = jobStartOn;
    if (!calendar.isWorkingDay(es)) {
      es = calendar.nextWorkingDay(es);
    }
    if (a.startNoEarlierOn) {
      let sn = a.startNoEarlierOn;
      if (!calendar.isWorkingDay(sn)) sn = calendar.nextWorkingDay(sn);
      if (sn > es) es = sn;
    }

    for (const link of incoming.get(id)!) {
      const predEs = earlyStart.get(link.predecessorId)!;
      const predEf = earlyFinish.get(link.predecessorId)!;
      const constrained =
        link.type === "finish_to_start"
          ? calendar.addWorkingDays(predEf, link.lagDays + 1)
          : calendar.addWorkingDays(predEs, link.lagDays);
      if (constrained > es) es = constrained;
    }

    const ef =
      a.durationDays === 1
        ? es
        : calendar.addWorkingDays(es, a.durationDays - 1);
    earlyStart.set(id, es);
    earlyFinish.set(id, ef);
  }

  let jobFinish = earlyFinish.get(order[0]!)!;
  for (const id of order) {
    const ef = earlyFinish.get(id)!;
    if (ef > jobFinish) jobFinish = ef;
  }

  const lateFinish = new Map<string, string>();
  const lateStart = new Map<string, string>();

  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i]!;
    const a = byId.get(id)!;
    const outs = outgoing.get(id)!;
    // Always start at job finish, then tighten with successor limits.
    // SS-only successors can derive an LF after the job finish — still cap.
    let lf = jobFinish;
    for (const link of outs) {
      const succLs = lateStart.get(link.successorId)!;
      let predLf: string;
      if (link.type === "finish_to_start") {
        predLf = calendar.addWorkingDays(succLs, -(link.lagDays + 1));
      } else {
        const predLs = calendar.addWorkingDays(succLs, -link.lagDays);
        predLf =
          a.durationDays === 1
            ? predLs
            : calendar.addWorkingDays(predLs, a.durationDays - 1);
      }
      if (predLf < lf) lf = predLf;
    }

    const ls =
      a.durationDays === 1
        ? lf
        : calendar.addWorkingDays(lf, -(a.durationDays - 1));
    lateFinish.set(id, lf);
    lateStart.set(id, ls);
  }

  return activities.map((a) => {
    const es = earlyStart.get(a.id)!;
    const ef = earlyFinish.get(a.id)!;
    const ls = lateStart.get(a.id)!;
    const lf = lateFinish.get(a.id)!;
    const totalFloatDays =
      ls === es ? 0 : calendar.workingDayDelta(es, ls);
    return {
      ...a,
      earlyStartOn: es,
      earlyFinishOn: ef,
      lateStartOn: ls,
      lateFinishOn: lf,
      totalFloatDays,
      isCritical: totalFloatDays === 0,
    };
  });
}

function topologicalOrder(
  activities: readonly CpmActivity[],
  outgoing: Map<string, CpmLink[]>,
): string[] {
  const ids = activities.map((a) => a.id);
  const adj = new Map<string, string[]>();
  const indeg = new Map<string, number>();
  for (const id of ids) {
    adj.set(id, []);
    indeg.set(id, 0);
  }
  for (const [pred, outs] of outgoing) {
    for (const link of outs) {
      adj.get(pred)!.push(link.successorId);
      indeg.set(link.successorId, (indeg.get(link.successorId) ?? 0) + 1);
    }
  }

  const queue: string[] = [];
  for (const id of ids) {
    if ((indeg.get(id) ?? 0) === 0) queue.push(id);
  }
  const order: string[] = [];
  let qHead = 0;
  while (qHead < queue.length) {
    const id = queue[qHead++]!;
    order.push(id);
    for (const succ of adj.get(id) ?? []) {
      const next = (indeg.get(succ) ?? 0) - 1;
      indeg.set(succ, next);
      if (next === 0) queue.push(succ);
    }
  }

  if (order.length === ids.length) return order;

  const inOrder = new Set(order);
  const remaining = new Set(ids.filter((id) => !inOrder.has(id)));
  const durationById = new Map(
    activities
      .filter((a) => remaining.has(a.id))
      .map((a) => [a.id, a.durationDays]),
  );
  throw new CycleError(findCyclePath(remaining, adj, durationById));
}

function findCyclePath(
  remaining: Set<string>,
  adj: Map<string, string[]>,
  durationById: Map<string, number>,
): string[] {
  const cycles: string[][] = [];

  for (const start of [...remaining].sort()) {
    const stack: string[] = [];
    const onStack = new Set<string>();

    const dfs = (u: string): void => {
      stack.push(u);
      onStack.add(u);
      const outs = [...(adj.get(u) ?? [])]
        .filter((v) => remaining.has(v))
        .sort();
      for (const v of outs) {
        if (v === start && stack.length > 1) {
          cycles.push([...stack, start]);
          continue;
        }
        if (onStack.has(v)) continue;
        if (stack.includes(v)) continue;
        dfs(v);
      }
      stack.pop();
      onStack.delete(u);
    };

    dfs(start);
  }

  if (cycles.length === 0) {
    return [...remaining, [...remaining][0]!];
  }

  const score = (cycle: string[]) => {
    const nodes = cycle.slice(0, -1);
    return nodes.reduce((s, id) => s + (durationById.get(id) ?? 0), 0);
  };

  cycles.sort((a, b) => {
    const ds = score(b) - score(a);
    if (ds !== 0) return ds;
    return a.join(" → ").localeCompare(b.join(" → "));
  });
  return cycles[0]!;
}

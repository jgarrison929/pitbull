"use client";

import { useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { CostLine } from "@/lib/ev";
import { mh, pct, pendingInstalledQtyMilli, qty, rollup } from "@/lib/ev";
import { cn } from "@/lib/utils";
import { Money, Progress, StatusIndex } from "./format";
import { varianceStatus } from "@/lib/status";

export type WbsNode = {
  id: string;
  code: string;
  description: string;
  unit: string;
  depth: number;
  isLeaf: boolean;
  path: string;
  /** Present for leaves; summaries omit EV fields and show rolled children via UI. */
  line?: CostLine;
};

const hot = (l: CostLine) =>
  varianceStatus(l.cpi, l.varianceCents) === "at-risk";

/** Exact dollars for approval-pending (not usdShort's $2K rounding). */
function usdExact(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

/** Claimed installed drives the number; live above that is pending until lock. */
function InstalledCell({ l }: { l: CostLine }) {
  const pending = pendingInstalledQtyMilli(l);
  const approvalQty = l.approvalPendingQtyMilli ?? 0;
  const approvalCents = l.approvalPendingCents ?? 0;
  const shown =
    l.evMethod === "units" ? l.claimedInstalledQtyMilli : l.installedQtyMilli;
  return (
    <div className="text-right text-xs tabular-nums text-muted-foreground">
      <div>
        {qty(shown)} / {qty(l.budgetQtyMilli)} {l.unit}
      </div>
      {approvalQty > 0 || approvalCents > 0 ? (
        <div
          className="text-amber-700 dark:text-amber-400"
          data-testid={`approval-pending-${l.code}`}
          data-cents={approvalCents}
        >
          +{qty(approvalQty)} {l.unit}
          {approvalCents > 0
            ? ` · ${usdExact(approvalCents)} pending`
            : " pending approval"}
        </div>
      ) : null}
      {pending > 0 && (
        <div
          className="text-amber-700 dark:text-amber-400"
          data-testid={`pending-${l.code}`}
        >
          +{qty(pending)} pending lock
        </div>
      )}
      {l.overBudgetQtyMilli > 0 && (
        <div
          className="text-red-700 dark:text-red-400"
          data-testid={`over-qty-${l.code}`}
        >
          +{qty(l.overBudgetQtyMilli)} over budget qty
        </div>
      )}
      {l.earnedMhMilli > 0 && (
        <div data-testid={`earned-mh-${l.code}`}>{mh(l.earnedMhMilli)} MH earned</div>
      )}
    </div>
  );
}

/**
 * Budget vs earned value by cost code. Virtualized tree for large WBS;
 * phone list stays virtualized too so 10k rows never mount all DOM nodes.
 */
export function CostTable({
  nodes,
}: {
  /** Full WBS ordered by path (summaries + leaves). Leaf EV lives on node.line. */
  nodes: WbsNode[];
}) {
  // Roll up from nodes only — avoid a second 10k-line props list on the RSC payload.
  const lines = useMemo(
    () => nodes.flatMap((n) => (n.line ? [n.line] : [])),
    [nodes],
  );
  const t = rollup(lines);
  const [q, setQ] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  const visible = useMemo(() => {
    const query = q.trim().toLowerCase();
    const out: WbsNode[] = [];
    const skip = new Set<string>();
    for (const n of nodes) {
      if ([...skip].some((p) => n.path.startsWith(p))) continue;
      if (collapsed.has(n.id) && !n.isLeaf) skip.add(n.path);
      if (
        query &&
        !`${n.code} ${n.description}`.toLowerCase().includes(query) &&
        n.isLeaf
      )
        continue;
      if (query && !n.isLeaf) {
        // Keep a summary only if some descendant leaf matches.
        const has = nodes.some(
          (c) =>
            c.isLeaf &&
            c.path.startsWith(n.path) &&
            `${c.code} ${c.description}`.toLowerCase().includes(query),
        );
        if (!has) continue;
      }
      out.push(n);
    }
    return out;
  }, [nodes, q, collapsed]);

  function toggle(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div data-testid="cost-table">
      <div className="mb-3 flex items-center gap-2 px-1">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter cost codes…"
          className="w-full max-w-sm rounded-md border bg-background px-3 py-1.5 text-sm"
          data-testid="cost-tree-filter"
          aria-label="Filter cost codes"
        />
        <span className="text-xs text-muted-foreground tabular-nums">
          {visible.length} shown
        </span>
      </div>
      <div className="hidden md:block">
        <VirtualTreeDesktop
          rows={visible}
          onToggle={toggle}
          collapsed={collapsed}
        />
        <div
          className="mt-1 flex items-center justify-between gap-3 border-t-2 py-3 text-sm font-medium"
          data-testid="cost-job-total"
        >
          <span>Job total (leaves) · {pct(t.percent)}</span>
          <span className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 tabular-nums">
            <span>
              <span className="mr-1 text-xs font-normal text-muted-foreground">
                Budget
              </span>
              <Money cents={t.budgetCents} />
            </span>
            <span>
              <span className="mr-1 text-xs font-normal text-muted-foreground">
                Earned
              </span>
              <Money cents={t.earnedCents} />
            </span>
            <span>
              <span className="mr-1 text-xs font-normal text-muted-foreground">
                Actual
              </span>
              <Money cents={t.actualCents} />
            </span>
            <span>
              <span className="mr-1 text-xs font-normal text-muted-foreground">
                EAC
              </span>
              <Money cents={t.eacCents} />
            </span>
            <span>
              <span className="mr-1 text-xs font-normal text-muted-foreground">
                ETC
              </span>
              <Money cents={t.etcCents} />
            </span>
            <StatusIndex index={t.cpi} varianceCents={t.costVarianceCents} />
          </span>
        </div>
      </div>
      <div className="md:hidden" data-testid="cost-list">
        <VirtualTreeMobile
          rows={visible}
          onToggle={toggle}
          collapsed={collapsed}
        />
        <div className="flex items-center justify-between border-t py-3 text-sm font-medium">
          <span>Job total · {pct(t.percent)}</span>
          <span>
            CPI{" "}
            <StatusIndex index={t.cpi} varianceCents={t.costVarianceCents} />
          </span>
        </div>
      </div>
    </div>
  );
}

function VirtualTreeDesktop({
  rows,
  onToggle,
  collapsed,
}: {
  rows: WbsNode[];
  onToggle: (id: string) => void;
  collapsed: Set<string>;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44,
    overscan: 12,
  });
  return (
    <div>
      <div className="grid grid-cols-[minmax(9rem,1.6fr)_6.5rem_7rem_4.25rem_4.25rem_4.25rem_6.5rem] gap-x-3 border-b px-2 pb-2 text-xs font-medium text-muted-foreground">
        <div>Cost code</div>
        <div className="whitespace-nowrap text-right">Installed</div>
        <div className="whitespace-nowrap text-right">% complete</div>
        <div className="text-right">Budget</div>
        <div className="text-right">Earned</div>
        <div className="text-right">Actual</div>
        <div className="whitespace-nowrap text-right">CPI · variance</div>
      </div>
      <div
        ref={parentRef}
        className="h-[min(32rem,70vh)] overflow-auto"
        data-testid="cost-tree-scroll"
      >
        <div
          style={{
            height: virtualizer.getTotalSize(),
            position: "relative",
            width: "100%",
          }}
        >
          {virtualizer.getVirtualItems().map((v) => {
            const n = rows[v.index]!;
            const l = n.line;
            return (
              <div
                key={n.id}
                className={cn(
                  "absolute left-0 grid w-full grid-cols-[minmax(9rem,1.6fr)_6.5rem_7rem_4.25rem_4.25rem_4.25rem_6.5rem] items-center gap-x-3 border-b px-2 text-sm",
                  l && hot(l) && "bg-negative-soft/60",
                )}
                style={{
                  height: v.size,
                  transform: `translateY(${v.start}px)`,
                }}
                data-testid="cost-tree-row"
                data-code={n.code}
              >
                <div
                  className="min-w-0"
                  style={{ paddingLeft: n.depth * 12 }}
                >
                  {!n.isLeaf ? (
                    <button
                      type="button"
                      className="mr-1 text-xs text-muted-foreground"
                      onClick={() => onToggle(n.id)}
                      aria-expanded={!collapsed.has(n.id)}
                    >
                      {collapsed.has(n.id) ? "▸" : "▾"}
                    </button>
                  ) : null}
                  <span className="mr-2 font-mono text-xs text-muted-foreground">
                    {n.code}
                  </span>
                  <span
                    className={cn(
                      "font-medium",
                      !n.isLeaf && "text-muted-foreground",
                    )}
                  >
                    {n.description}
                  </span>
                  {l?.earnDerivation ? (
                    <div
                      className="truncate text-xs text-muted-foreground"
                      data-testid="earn-derivation"
                    >
                      {l.earnDerivation}
                    </div>
                  ) : null}
                  {l?.forecastDerivation ? (
                    <div
                      className="truncate text-xs text-muted-foreground"
                      data-testid="forecast-derivation"
                    >
                      {l.forecastDerivation}
                    </div>
                  ) : null}
                </div>
                {l ? (
                  <>
                    <InstalledCell l={l} />
                    <div className="flex items-center justify-end gap-1.5">
                      <Progress value={l.percent} className="w-10 shrink-0" />
                      <span className="w-9 shrink-0 text-right text-xs tabular-nums">
                        {pct(l.percent)}
                      </span>
                    </div>
                    <div className="text-right">
                      <Money cents={l.budgetCents} />
                    </div>
                    <div className="text-right">
                      <Money cents={l.earnedCents} />
                    </div>
                    <div className="text-right">
                      <Money cents={l.actualCents} />
                    </div>
                    <div className="text-right">
                      <StatusIndex
                        index={l.cpi}
                        varianceCents={l.varianceCents}
                      />
                    </div>
                  </>
                ) : (
                  <div className="col-span-6 text-xs text-muted-foreground">
                    Summary
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function VirtualTreeMobile({
  rows,
  onToggle,
  collapsed,
}: {
  rows: WbsNode[];
  onToggle: (id: string) => void;
  collapsed: Set<string>;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 88,
    overscan: 8,
  });
  return (
    <div
      ref={parentRef}
      className="h-[min(28rem,65vh)] overflow-auto"
      data-testid="cost-tree-scroll-mobile"
    >
      <div
        style={{
          height: virtualizer.getTotalSize(),
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((v) => {
          const n = rows[v.index]!;
          const l = n.line;
          return (
            <div
              key={n.id}
              className={cn(
                "absolute left-0 w-full border-b py-2",
                l && hot(l) && "bg-negative-soft/60",
              )}
              style={{
                height: v.size,
                transform: `translateY(${v.start}px)`,
                paddingLeft: 8 + n.depth * 10,
              }}
              data-testid="cost-tree-row"
              data-code={n.code}
            >
              <div className="flex items-baseline justify-between gap-2 pr-2">
                <div className="min-w-0">
                  {!n.isLeaf ? (
                    <button
                      type="button"
                      className="mr-1 text-xs"
                      onClick={() => onToggle(n.id)}
                    >
                      {collapsed.has(n.id) ? "▸" : "▾"}
                    </button>
                  ) : null}
                  <span className="mr-1 font-mono text-xs text-muted-foreground">
                    {n.code}
                  </span>
                  <span className="font-medium">{n.description}</span>
                </div>
                {l ? (
                  <StatusIndex index={l.cpi} varianceCents={l.varianceCents} />
                ) : null}
              </div>
              {l ? (
                <div className="mt-1 grid grid-cols-3 gap-2 pr-2 text-xs">
                  <div>
                    <div className="text-muted-foreground">Earned</div>
                    <Money cents={l.earnedCents} />
                  </div>
                  <div>
                    <div className="text-muted-foreground">Actual</div>
                    <Money cents={l.actualCents} />
                  </div>
                  <div className="text-right">
                    <div className="text-muted-foreground">Budget</div>
                    <Money cents={l.budgetCents} />
                  </div>
                  {(l.approvalPendingQtyMilli ?? 0) > 0 ||
                  (l.approvalPendingCents ?? 0) > 0 ? (
                    <div
                      className="col-span-3 text-amber-700 dark:text-amber-400"
                      data-testid={`approval-pending-${l.code}`}
                      data-cents={l.approvalPendingCents ?? 0}
                    >
                      +{qty(l.approvalPendingQtyMilli ?? 0)} {l.unit}
                      {(l.approvalPendingCents ?? 0) > 0
                        ? ` · ${usdExact(l.approvalPendingCents!)} pending`
                        : " pending approval"}
                    </div>
                  ) : null}
                  {pendingInstalledQtyMilli(l) > 0 && (
                    <div
                      className="col-span-3 text-amber-700 dark:text-amber-400"
                      data-testid={`pending-${l.code}`}
                    >
                      +{qty(pendingInstalledQtyMilli(l))} {l.unit} pending lock
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">Summary</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

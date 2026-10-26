"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { ValueSet, WbsMoney } from "@/lib/budget";
import type { CostLine } from "@/lib/ev";
import { mh, pct, pendingInstalledQtyMilli, qty, rollup } from "@/lib/ev";
import { cn } from "@/lib/utils";
import { Money, Progress, StatusIndex } from "./format";
import { DerivationText, TreeToggleIcon } from "./ui-glyphs";
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
  /** Precomputed on the server; summaries carry their leaves' sums. */
  money: WbsMoney;
};

const VALUE_SETS: Record<ValueSet, { label: string; title: string }> = {
  ob: {
    label: "Original",
    title: "Original Budget: frozen when the estimate is approved",
  },
  cb: {
    label: "Current",
    title: "Current Budget: Original plus approved changes",
  },
  ce: { label: "Estimate", title: "Current Estimate: the imported estimate" },
};

const centsOf = (m: WbsMoney, set: ValueSet) => m[`${set}Cents`];

function rowData(n: WbsNode) {
  return {
    "data-id": n.id,
    "data-code": n.code,
    "data-ob-cents": n.money.obCents,
    "data-cb-cents": n.money.cbCents,
    "data-ce-cents": n.money.ceCents,
    "data-mh-milli": n.money.mhMilli,
    "data-qty": n.money.qtyMilli ?? "",
  };
}

function BudgetCell({
  money,
  set,
  exact,
}: {
  money: WbsMoney;
  set: ValueSet;
  /** Leaves show exact cents; summary roll-ups stay compact. */
  exact?: boolean;
}) {
  return (
    <div className="text-right">
      <Money cents={centsOf(money, set)} exact={exact} />
      {money.mhMilli > 0 ? (
        <div className="text-xs tabular-nums text-muted-foreground">
          {mh(money.mhMilli)} MH
        </div>
      ) : null}
    </div>
  );
}

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
          className="text-caution"
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
          className="text-caution"
          data-testid={`pending-${l.code}`}
        >
          +{qty(pending)} pending lock
        </div>
      )}
      {l.overBudgetQtyMilli > 0 && (
        <div
          className="text-negative"
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

function MetricDash() {
  return (
    <span
      className="text-muted-foreground tabular-nums"
      data-testid="metric-dash"
    >
      —
    </span>
  );
}

/**
 * Budget vs earned value by cost code. Virtualized tree for large WBS;
 * phone list stays virtualized too so 10k rows never mount all DOM nodes.
 */
export function CostTable({
  nodes,
  jobMoney,
  defaultValueSet,
  estimateDraft = false,
  jobNumber,
}: {
  /** Full WBS ordered by path (summaries + leaves). Leaf EV lives on node.line. */
  nodes: WbsNode[];
  jobMoney: WbsMoney;
  defaultValueSet: ValueSet;
  /** Draft estimate: money and CPI show "—" (never $0 / EAC $0). */
  estimateDraft?: boolean;
  /** When set, leaf cost codes link to the cost-item drill-down. */
  jobNumber?: string;
}) {
  // Roll up from nodes only — avoid a second 10k-line props list on the RSC payload.
  const lines = useMemo(
    () => nodes.flatMap((n) => (n.line ? [n.line] : [])),
    [nodes],
  );
  const t = rollup(lines);
  const [valueSet, setValueSet] = useState(defaultValueSet);
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
      <div className="mb-3 flex flex-wrap items-center gap-2 px-1">
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
        <div
          role="radiogroup"
          aria-label="Budget column shows"
          className="ml-auto flex overflow-hidden rounded-md border text-xs"
          data-testid="value-set"
          data-set={valueSet}
        >
          {(Object.keys(VALUE_SETS) as ValueSet[]).map((set) => (
            <button
              key={set}
              type="button"
              role="radio"
              aria-checked={valueSet === set}
              title={VALUE_SETS[set].title}
              onClick={() => setValueSet(set)}
              className={cn(
                "px-2.5 py-1 text-muted-foreground",
                valueSet === set && "bg-muted font-medium text-foreground",
              )}
              data-testid={`value-set-${set}`}
            >
              {VALUE_SETS[set].label}
            </button>
          ))}
        </div>
      </div>
      {/*
        The desktop grid's column minimums, gaps, and padding are 58rem.
        60rem leaves room for the vertical scrollbar so the tree's
        overflow-x-hidden does not cut status or money. Below lg the
        assistant rail is gone; at 768–820px a tree that wide was expanding
        document scrollWidth (#671). Scroll that width inside the card.
        The job total stays full width below the scroller.
      */}
      <div className="hidden min-w-0 md:block">
        <div className="overflow-x-auto">
          <VirtualTreeDesktop
            rows={visible}
            onToggle={toggle}
            collapsed={collapsed}
            valueSet={valueSet}
            estimateDraft={estimateDraft}
            jobNumber={jobNumber}
          />
        </div>
        <div
          className="mt-1 flex min-w-0 flex-wrap items-center justify-between gap-3 border-t-2 py-3 text-sm font-medium"
          data-testid="cost-job-total"
        >
          <span>
            Job total (leaves)
            {estimateDraft ? null : ` · ${pct(t.percent)}`}
          </span>
          <span className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 tabular-nums">
            {(Object.keys(VALUE_SETS) as ValueSet[]).map((set) => (
              <span key={set} data-testid={`cost-total-${set}`}>
                <span className="mr-1 text-xs font-normal text-muted-foreground">
                  {VALUE_SETS[set].label}
                </span>
                {/* Draft: CE is real; OB/CB stay — until Approve (never $0). */}
                {estimateDraft && set !== "ce" ? (
                  <MetricDash />
                ) : (
                  <Money cents={centsOf(jobMoney, set)} />
                )}
              </span>
            ))}
            <span>
              <span className="mr-1 text-xs font-normal text-muted-foreground">
                Earned
              </span>
              {estimateDraft ? <MetricDash /> : <Money cents={t.earnedCents} />}
            </span>
            <span>
              <span className="mr-1 text-xs font-normal text-muted-foreground">
                Actual
              </span>
              {estimateDraft ? <MetricDash /> : <Money cents={t.actualCents} />}
            </span>
            <span>
              <span className="mr-1 text-xs font-normal text-muted-foreground">
                EAC
              </span>
              {estimateDraft ? <MetricDash /> : <Money cents={t.eacCents} />}
            </span>
            <span>
              <span className="mr-1 text-xs font-normal text-muted-foreground">
                ETC
              </span>
              {estimateDraft ? <MetricDash /> : <Money cents={t.etcCents} />}
            </span>
            {estimateDraft ? (
              <MetricDash />
            ) : (
              <StatusIndex index={t.cpi} varianceCents={t.costVarianceCents} />
            )}
          </span>
        </div>
      </div>
      <div className="md:hidden" data-testid="cost-list">
        <VirtualTreeMobile
          rows={visible}
          onToggle={toggle}
          collapsed={collapsed}
          valueSet={valueSet}
          estimateDraft={estimateDraft}
          jobNumber={jobNumber}
        />
        <div className="flex items-center justify-between border-t py-3 text-sm font-medium">
          <span>
            Job total
            {estimateDraft ? null : ` · ${pct(t.percent)}`}
          </span>
          <span>
            CPI{" "}
            {estimateDraft ? (
              <MetricDash />
            ) : (
              <StatusIndex index={t.cpi} varianceCents={t.costVarianceCents} />
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

function CostCodeLabel({
  n,
  jobNumber,
}: {
  n: WbsNode;
  jobNumber?: string;
}) {
  const codeClass = "mr-2 font-mono text-xs text-muted-foreground";
  if (n.isLeaf && jobNumber) {
    return (
      <Link
        href={`/app/jobs/${jobNumber}/cost-items/${encodeURIComponent(n.code)}`}
        className={cn(codeClass, "hover:underline hover:text-foreground")}
        data-testid={`cost-code-link-${n.code}`}
      >
        {n.code}
      </Link>
    );
  }
  return <span className={codeClass}>{n.code}</span>;
}

function VirtualTreeDesktop({
  rows,
  onToggle,
  collapsed,
  valueSet,
  estimateDraft,
  jobNumber,
}: {
  rows: WbsNode[];
  onToggle: (id: string) => void;
  collapsed: Set<string>;
  valueSet: ValueSet;
  estimateDraft: boolean;
  jobNumber?: string;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52,
    // Measure real row height so multi-line derivations are not clipped.
    measureElement: (el) => el.getBoundingClientRect().height,
    overscan: 12,
  });
  return (
    <div className="min-w-[60rem]">
      <div className="grid grid-cols-[minmax(9rem,1.6fr)_6.5rem_7rem_7.5rem_7.5rem_7.5rem_7.5rem] gap-x-3 border-b px-2 pb-2 text-xs font-medium text-muted-foreground">
        <div>Cost code</div>
        <div className="whitespace-nowrap text-right">Installed</div>
        <div className="whitespace-nowrap text-right">% complete</div>
        <div className="text-right" title={VALUE_SETS[valueSet].title}>
          {VALUE_SETS[valueSet].label}
        </div>
        <div className="text-right">Earned</div>
        <div className="text-right">Actual</div>
        <div className="whitespace-nowrap text-right">CPI · variance</div>
      </div>
      <div
        ref={parentRef}
        className="h-[min(32rem,70vh)] overflow-y-auto overflow-x-hidden"
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
                ref={virtualizer.measureElement}
                data-index={v.index}
                className={cn(
                  "absolute left-0 grid w-full grid-cols-[minmax(9rem,1.6fr)_6.5rem_7rem_7.5rem_7.5rem_7.5rem_7.5rem] items-start gap-x-3 border-b px-2 py-1.5 text-sm",
                  l && !estimateDraft && hot(l) && "bg-negative-soft/60",
                )}
                style={{
                  transform: `translateY(${v.start}px)`,
                }}
                data-testid="cost-tree-row"
                {...rowData(n)}
              >
                <div
                  className="min-w-0"
                  style={{ paddingLeft: n.depth * 12 }}
                >
                  {!n.isLeaf ? (
                    <button
                      type="button"
                      className="mr-1 inline-flex items-center text-xs text-muted-foreground"
                      onClick={() => onToggle(n.id)}
                      aria-expanded={!collapsed.has(n.id)}
                    >
                      <TreeToggleIcon expanded={!collapsed.has(n.id)} />
                    </button>
                  ) : null}
                  <CostCodeLabel n={n} jobNumber={jobNumber} />
                  <span
                    className={cn(
                      "font-medium",
                      !n.isLeaf && "text-muted-foreground",
                    )}
                  >
                    {n.description}
                  </span>
                  {!estimateDraft && l?.earnDerivation ? (
                    <div
                      className="text-xs text-pretty text-muted-foreground whitespace-normal"
                      data-testid="earn-derivation"
                    >
                      <DerivationText text={l.earnDerivation} />
                    </div>
                  ) : null}
                  {!estimateDraft && l?.forecastDerivation ? (
                    <div
                      className="text-xs text-pretty text-muted-foreground whitespace-normal"
                      data-testid="forecast-derivation"
                    >
                      <DerivationText text={l.forecastDerivation} />
                    </div>
                  ) : null}
                </div>
                {l ? (
                  <>
                    {estimateDraft ? (
                      <div className="text-right text-xs">
                        <MetricDash />
                      </div>
                    ) : (
                      <InstalledCell l={l} />
                    )}
                    <div className="flex items-center justify-end gap-1.5">
                      {estimateDraft ? (
                        <MetricDash />
                      ) : (
                        <>
                          <Progress
                            value={l.percent}
                            className="w-10 shrink-0"
                          />
                          <span className="w-9 shrink-0 text-right text-xs tabular-nums">
                            {pct(l.percent)}
                          </span>
                        </>
                      )}
                    </div>
                    {estimateDraft && valueSet !== "ce" ? (
                      <div className="text-right">
                        <MetricDash />
                      </div>
                    ) : (
                      <BudgetCell money={n.money} set={valueSet} exact />
                    )}
                    <div className="text-right">
                      {estimateDraft ? (
                        <MetricDash />
                      ) : (
                        <Money cents={l.earnedCents} exact />
                      )}
                    </div>
                    <div className="text-right">
                      {estimateDraft ? (
                        <MetricDash />
                      ) : (
                        <Money cents={l.actualCents} exact />
                      )}
                    </div>
                    <div className="text-right">
                      {estimateDraft ? (
                        <MetricDash />
                      ) : (
                        <StatusIndex
                          index={l.cpi}
                          varianceCents={l.varianceCents}
                        />
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="col-span-2" />
                    {estimateDraft && valueSet !== "ce" ? (
                      <div className="text-right">
                        <MetricDash />
                      </div>
                    ) : (
                      <BudgetCell money={n.money} set={valueSet} />
                    )}
                    <div className="col-span-3" />
                  </>
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
  valueSet,
  estimateDraft,
  jobNumber,
}: {
  rows: WbsNode[];
  onToggle: (id: string) => void;
  collapsed: Set<string>;
  valueSet: ValueSet;
  estimateDraft: boolean;
  jobNumber?: string;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 88,
    measureElement: (el) => el.getBoundingClientRect().height,
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
              ref={virtualizer.measureElement}
              data-index={v.index}
              className={cn(
                "absolute left-0 w-full border-b py-2",
                l && !estimateDraft && hot(l) && "bg-negative-soft/60",
              )}
              style={{
                transform: `translateY(${v.start}px)`,
                paddingLeft: 8 + n.depth * 10,
              }}
              data-testid="cost-tree-row"
              {...rowData(n)}
            >
              <div className="flex items-baseline justify-between gap-2 pr-2">
                <div className="min-w-0">
                  {!n.isLeaf ? (
                    <button
                      type="button"
                      className="mr-1 inline-flex items-center text-xs"
                      onClick={() => onToggle(n.id)}
                      aria-expanded={!collapsed.has(n.id)}
                    >
                      <TreeToggleIcon expanded={!collapsed.has(n.id)} />
                    </button>
                  ) : null}
                  <CostCodeLabel n={n} jobNumber={jobNumber} />
                  <span className="font-medium">{n.description}</span>
                </div>
                {l ? (
                  estimateDraft ? (
                    <MetricDash />
                  ) : (
                    <StatusIndex
                      index={l.cpi}
                      varianceCents={l.varianceCents}
                    />
                  )
                ) : null}
              </div>
              {l ? (
                <div className="mt-1 grid grid-cols-3 gap-2 pr-2 text-xs">
                  <div>
                    <div className="text-muted-foreground">Earned</div>
                    {estimateDraft ? (
                      <MetricDash />
                    ) : (
                      <Money cents={l.earnedCents} exact />
                    )}
                  </div>
                  <div>
                    <div className="text-muted-foreground">Actual</div>
                    {estimateDraft ? (
                      <MetricDash />
                    ) : (
                      <Money cents={l.actualCents} exact />
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-muted-foreground">
                      {VALUE_SETS[valueSet].label}
                    </div>
                    {estimateDraft && valueSet !== "ce" ? (
                      <MetricDash />
                    ) : (
                      <BudgetCell money={n.money} set={valueSet} exact />
                    )}
                  </div>
                  {!estimateDraft &&
                  ((l.approvalPendingQtyMilli ?? 0) > 0 ||
                    (l.approvalPendingCents ?? 0) > 0) ? (
                    <div
                      className="col-span-3 text-caution"
                      data-testid={`approval-pending-${l.code}`}
                      data-cents={l.approvalPendingCents ?? 0}
                    >
                      +{qty(l.approvalPendingQtyMilli ?? 0)} {l.unit}
                      {(l.approvalPendingCents ?? 0) > 0
                        ? ` · ${usdExact(l.approvalPendingCents!)} pending`
                        : " pending approval"}
                    </div>
                  ) : null}
                  {!estimateDraft && pendingInstalledQtyMilli(l) > 0 && (
                    <div
                      className="col-span-3 text-caution"
                      data-testid={`pending-${l.code}`}
                    >
                      +{qty(pendingInstalledQtyMilli(l))} {l.unit} pending lock
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-1 flex items-baseline justify-between gap-2 pr-2 text-xs">
                  <span className="text-muted-foreground">
                    {VALUE_SETS[valueSet].label}
                  </span>
                  {estimateDraft && valueSet !== "ce" ? (
                    <MetricDash />
                  ) : (
                    <BudgetCell money={n.money} set={valueSet} />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

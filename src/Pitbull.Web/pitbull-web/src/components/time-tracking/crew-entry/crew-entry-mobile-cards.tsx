"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EntityLookupField } from "@/components/ui/entity-lookup-field";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CopyCheck,
  Minus,
  Plus,
} from "lucide-react";
import type { CrewMemberEntryData } from "@/types/crew-entry.types";
import type { CostCode, Equipment, Phase } from "@/lib/types";
import type { EntityOption } from "@/lib/entity-lookup";

interface CrewEntryMobileCardsProps {
  entries: CrewMemberEntryData[];
  equipmentList?: Equipment[];
  phases?: Phase[];
  costCodes?: CostCode[];
  recentCostCodeIds?: string[];
  recentEquipmentIds?: string[];
  onRecentCostCode?: (id: string, label: string) => void;
  onRecentEquipment?: (id: string, label: string) => void;
  onUpdateEntry: (
    employeeId: string,
    field: keyof CrewMemberEntryData,
    value: string
  ) => void;
}

/** Touch-friendly stepper for hours in crew mobile cards */
function MiniHoursStepper({
  label,
  value,
  onChange,
  colorClass,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  colorClass: string;
  disabled?: boolean;
}) {
  const numVal = parseFloat(value) || 0;
  const step = (delta: number) => {
    const next = Math.max(0, Math.min(24, numVal + delta));
    onChange(next.toString());
  };

  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className={`flex items-center gap-0.5 ${disabled ? "opacity-50" : ""}`}>
        <button
          type="button"
          onClick={() => step(-0.5)}
          disabled={disabled}
          className="flex items-center justify-center w-10 h-10 rounded-l-md border border-input bg-background hover:bg-muted active:bg-muted/80 transition-colors touch-manipulation disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={`Decrease ${label}`}
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          max="24"
          step="0.5"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={`w-14 h-10 border-y border-input bg-background text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed ${colorClass}`}
        />
        <button
          type="button"
          onClick={() => step(0.5)}
          disabled={disabled}
          className="flex items-center justify-center w-10 h-10 rounded-r-md border border-input bg-background hover:bg-muted active:bg-muted/80 transition-colors touch-manipulation disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={`Increase ${label}`}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function CrewEntryMobileCards({
  entries,
  equipmentList = [],
  phases = [],
  costCodes = [],
  recentCostCodeIds = [],
  recentEquipmentIds = [],
  onRecentCostCode,
  onRecentEquipment,
  onUpdateEntry,
}: CrewEntryMobileCardsProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showApplyAll, setShowApplyAll] = useState(false);
  const [applyPhaseId, setApplyPhaseId] = useState<string>("");
  const [applyEquipmentId, setApplyEquipmentId] = useState<string>("");
  const [applyCostCodeId, setApplyCostCodeId] = useState<string>("");
  const touchStartX = useRef<number>(0);
  const touchStartId = useRef<string>("");

  const phaseItems: EntityOption[] = useMemo(
    () =>
      phases.map((p) => ({
        id: p.id,
        label: p.name,
        sublabel: p.costCode,
        searchText: `${p.name} ${p.costCode ?? ""}`,
      })),
    [phases]
  );

  const equipmentItems: EntityOption[] = useMemo(
    () =>
      equipmentList.map((eq) => ({
        id: eq.id,
        label: eq.code,
        sublabel: eq.name,
        searchText: `${eq.code} ${eq.name}`,
      })),
    [equipmentList]
  );

  const costCodeItems: EntityOption[] = useMemo(
    () =>
      costCodes.map((c) => ({
        id: c.id,
        label: c.code,
        sublabel: c.description,
        searchText: `${c.code} ${c.description}`,
      })),
    [costCodes]
  );

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  function applyPhaseToAll() {
    entries.forEach((e) => {
      onUpdateEntry(e.employeeId, "phaseId", applyPhaseId);
    });
    setShowApplyAll(false);
  }

  function applyEquipmentToAll() {
    entries.forEach((e) => {
      onUpdateEntry(e.employeeId, "equipmentId", applyEquipmentId);
    });
    setShowApplyAll(false);
  }

  function applyCostCodeToAll() {
    entries.forEach((e) => {
      onUpdateEntry(e.employeeId, "costCodeId", applyCostCodeId);
    });
    if (applyCostCodeId) {
      const cc = costCodes.find((c) => c.id === applyCostCodeId);
      if (cc) onRecentCostCode?.(applyCostCodeId, `${cc.code} - ${cc.description}`);
    }
    setShowApplyAll(false);
  }

  function isEntryComplete(entry: CrewMemberEntryData): boolean {
    const total =
      (parseFloat(entry.regularHours) || 0) +
      (parseFloat(entry.overtimeHours) || 0) +
      (parseFloat(entry.doubletimeHours) || 0);
    return total > 0;
  }

  // Swipe handling for mark complete
  const handleTouchStart = useCallback((e: React.TouchEvent, employeeId: string) => {
    touchStartX.current = e.touches[0]!.clientX;
    touchStartId.current = employeeId;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const endX = e.changedTouches[0]!.clientX;
    const delta = endX - touchStartX.current;

    // Swipe right to mark as 8 hours if empty
    if (delta > 80 && touchStartId.current) {
      const entry = entries.find((en) => en.employeeId === touchStartId.current);
      if (entry) {
        const total =
          (parseFloat(entry.regularHours) || 0) +
          (parseFloat(entry.overtimeHours) || 0) +
          (parseFloat(entry.doubletimeHours) || 0);
        if (total === 0) {
          onUpdateEntry(touchStartId.current, "regularHours", "8");
        }
      }
    }
  }, [entries, onUpdateEntry]);

  return (
    <div className="space-y-3">
      {/* Apply to All (mobile) - collapsible searchable lookups */}
      {(phases.length > 0 || equipmentList.length > 0 || costCodes.length > 0) && (
        <div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowApplyAll((prev) => !prev)}
            className="w-full gap-2 min-h-[48px] touch-manipulation"
          >
            <CopyCheck className="h-4 w-4" />
            {showApplyAll ? "Hide" : "Apply to All Crew"}
          </Button>
          {showApplyAll && (
            <Card className="mt-2 animate-in fade-in-50 slide-in-from-top-1 duration-200">
              <CardContent className="pt-4 space-y-3">
                {costCodes.length > 0 && (
                  <div className="space-y-2">
                    <EntityLookupField
                      label="Cost code for all"
                      value={applyCostCodeId}
                      onSelect={setApplyCostCodeId}
                      items={costCodeItems}
                      recentIds={recentCostCodeIds}
                      placeholder="Search cost codes..."
                      emptyOptionLabel="No cost code"
                    />
                    <Button
                      onClick={applyCostCodeToAll}
                      disabled={!applyCostCodeId}
                      className="w-full min-h-[48px] bg-amber-500 hover:bg-amber-600 text-white touch-manipulation"
                    >
                      Apply cost code to all
                    </Button>
                  </div>
                )}
                {phases.length > 0 && (
                  <div className="space-y-2">
                    <EntityLookupField
                      label="Phase for all"
                      value={applyPhaseId}
                      onSelect={setApplyPhaseId}
                      items={phaseItems}
                      placeholder="Search phases..."
                      emptyOptionLabel="No phase"
                    />
                    <Button
                      onClick={applyPhaseToAll}
                      disabled={!applyPhaseId}
                      className="w-full min-h-[48px] bg-amber-500 hover:bg-amber-600 text-white touch-manipulation"
                    >
                      Apply phase to all
                    </Button>
                  </div>
                )}
                {equipmentList.length > 0 && (
                  <div className="space-y-2">
                    <EntityLookupField
                      label="Equipment for all"
                      value={applyEquipmentId}
                      onSelect={setApplyEquipmentId}
                      items={equipmentItems}
                      recentIds={recentEquipmentIds}
                      placeholder="Search equipment..."
                      emptyOptionLabel="No equipment"
                    />
                    <Button
                      onClick={applyEquipmentToAll}
                      disabled={!applyEquipmentId}
                      className="w-full min-h-[48px] bg-amber-500 hover:bg-amber-600 text-white touch-manipulation"
                    >
                      Apply equipment to all
                    </Button>
                  </div>
                )}
                <p className="text-xs text-muted-foreground text-center">
                  Sets cost code / phase / equipment on all {entries.length} crew members
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">
        Tap a crew member to expand • Swipe right on empty rows to quick-fill 8 hrs
      </p>

      {/* Expandable Crew Cards */}
      {entries.map((entry) => {
        const totalHours =
          (parseFloat(entry.regularHours) || 0) +
          (parseFloat(entry.overtimeHours) || 0) +
          (parseFloat(entry.doubletimeHours) || 0);
        const isExpanded = expandedIds.has(entry.employeeId);
        const complete = isEntryComplete(entry);

        return (
          <Card
            key={entry.employeeId}
            className={`overflow-hidden transition-all ${
              entry.error
                ? "border-destructive"
                : complete
                ? "border-green-300 bg-green-50/30 dark:bg-green-900/15"
                : ""
            }`}
            onTouchStart={(e) => handleTouchStart(e, entry.employeeId)}
            onTouchEnd={handleTouchEnd}
          >
            {/* Collapsed Header - always visible */}
            <button
              type="button"
              onClick={() => toggleExpand(entry.employeeId)}
              className="w-full flex items-center justify-between px-4 py-3.5 touch-manipulation text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                {/* Status icon */}
                {complete ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                ) : entry.error ? (
                  <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
                ) : (
                  <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-base truncate">{entry.employeeName}</p>
                  <p className="text-xs text-muted-foreground">{entry.employeeNumber}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {totalHours > 0 && (
                  <div className="text-right">
                    <span className="text-xl font-bold">{totalHours.toFixed(1)}</span>
                    <span className="text-xs text-muted-foreground ml-0.5">hrs</span>
                  </div>
                )}
                {isExpanded ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </button>

            {/* Expanded Content */}
            {isExpanded && (
              <CardContent className="pt-0 pb-4 px-4 space-y-4 animate-in slide-in-from-top-1 fade-in-50 duration-200">
                {/* Error */}
                {entry.error && (
                  <div className="flex items-center gap-2 text-destructive bg-destructive/10 p-3 rounded-md">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span className="text-sm">{entry.error}</span>
                  </div>
                )}

                {/* Cost code, phase, equipment — searchable entity lookups */}
                <div className="grid gap-3 grid-cols-1">
                  {costCodes.length > 0 && (
                    <EntityLookupField
                      label="Cost code"
                      value={entry.costCodeId}
                      onSelect={(id) => {
                        onUpdateEntry(entry.employeeId, "costCodeId", id);
                        const cc = costCodes.find((c) => c.id === id);
                        if (cc) onRecentCostCode?.(id, `${cc.code} - ${cc.description}`);
                      }}
                      items={costCodeItems}
                      recentIds={recentCostCodeIds}
                      placeholder="Search cost codes..."
                      emptyOptionLabel="Auto / none"
                    />
                  )}
                  {phases.length > 0 && (
                    <EntityLookupField
                      label="Phase"
                      value={entry.phaseId}
                      onSelect={(id) =>
                        onUpdateEntry(entry.employeeId, "phaseId", id)
                      }
                      items={phaseItems}
                      placeholder="Search phases..."
                      emptyOptionLabel="No phase"
                    />
                  )}
                  {equipmentList.length > 0 && (
                    <EntityLookupField
                      label="Equipment"
                      value={entry.equipmentId}
                      onSelect={(id) => {
                        onUpdateEntry(entry.employeeId, "equipmentId", id);
                        if (!id) {
                          onUpdateEntry(entry.employeeId, "equipmentHours", "0");
                        } else {
                          const eq = equipmentList.find((e) => e.id === id);
                          if (eq) onRecentEquipment?.(id, `${eq.code} - ${eq.name}`);
                        }
                      }}
                      items={equipmentItems}
                      recentIds={recentEquipmentIds}
                      placeholder="Search equipment..."
                      emptyOptionLabel="No equipment"
                    />
                  )}
                </div>

                {/* Equipment Hours (shown when equipment is available) */}
                {equipmentList.length > 0 && (
                  <MiniHoursStepper
                    label="Equipment Hrs"
                    value={entry.equipmentHours}
                    onChange={(v) => onUpdateEntry(entry.employeeId, "equipmentHours", v)}
                    colorClass="text-amber-600"
                    disabled={!entry.equipmentId}
                  />
                )}

                {/* Hours with Steppers */}
                <div className="grid grid-cols-3 gap-2">
                  <MiniHoursStepper
                    label="Regular"
                    value={entry.regularHours}
                    onChange={(v) => onUpdateEntry(entry.employeeId, "regularHours", v)}
                    colorClass="text-blue-600"
                  />
                  <MiniHoursStepper
                    label="OT (1.5x)"
                    value={entry.overtimeHours}
                    onChange={(v) => onUpdateEntry(entry.employeeId, "overtimeHours", v)}
                    colorClass="text-amber-600"
                  />
                  <MiniHoursStepper
                    label="DT (2x)"
                    value={entry.doubletimeHours}
                    onChange={(v) => onUpdateEntry(entry.employeeId, "doubletimeHours", v)}
                    colorClass="text-red-600"
                  />
                </div>

                {/* Notes */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Notes (optional)</label>
                  <textarea
                    value={entry.description}
                    onChange={(e) =>
                      onUpdateEntry(entry.employeeId, "description", e.target.value)
                    }
                    placeholder="Work description, location, etc."
                    rows={2}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-ring resize-none touch-manipulation"
                  />
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}

      {/* Summary at bottom */}
      <div className="flex justify-center gap-2 flex-wrap py-2">
        {entries.map((entry) => {
          const complete = isEntryComplete(entry);
          const hasError = !!entry.error;

          return (
            <button
              key={entry.employeeId}
              onClick={() => {
                // Expand this one
                setExpandedIds((prev) => {
                  const next = new Set(prev);
                  next.add(entry.employeeId);
                  return next;
                });
                // Scroll to card
                const el = document.getElementById(`crew-card-${entry.employeeId}`);
                el?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
              className={`w-3.5 h-3.5 rounded-full transition-colors touch-manipulation ${
                hasError
                  ? "bg-red-500"
                  : complete
                  ? "bg-green-500"
                  : "bg-muted-foreground/30"
              }`}
              aria-label={`${entry.employeeName} - ${complete ? "complete" : "incomplete"}`}
            />
          );
        })}
      </div>
    </div>
  );
}

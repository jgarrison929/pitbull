"use client";

import { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

interface CrewEntryMobileCardsProps {
  entries: CrewMemberEntryData[];
  costCodes: CostCode[];
  equipmentList?: Equipment[];
  phases?: Phase[];
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  colorClass: string;
}) {
  const numVal = parseFloat(value) || 0;
  const step = (delta: number) => {
    const next = Math.max(0, Math.min(24, numVal + delta));
    onChange(next.toString());
  };

  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => step(-0.5)}
          className="flex items-center justify-center w-10 h-10 rounded-l-md border border-input bg-background hover:bg-muted active:bg-muted/80 transition-colors touch-manipulation"
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
          className={`w-14 h-10 border-y border-input bg-background text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-ring ${colorClass}`}
        />
        <button
          type="button"
          onClick={() => step(0.5)}
          className="flex items-center justify-center w-10 h-10 rounded-r-md border border-input bg-background hover:bg-muted active:bg-muted/80 transition-colors touch-manipulation"
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
  costCodes,
  equipmentList = [],
  phases = [],
  onUpdateEntry,
}: CrewEntryMobileCardsProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showApplyAll, setShowApplyAll] = useState(false);
  const [applyPhaseId, setApplyPhaseId] = useState<string>("");
  const [applyEquipmentId, setApplyEquipmentId] = useState<string>("");
  const touchStartX = useRef<number>(0);
  const touchStartId = useRef<string>("");

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
      if (applyEquipmentId) {
        onUpdateEntry(e.employeeId, "equipmentHours", e.regularHours);
      }
    });
    setShowApplyAll(false);
  }

  function isEntryComplete(entry: CrewMemberEntryData): boolean {
    const total =
      (parseFloat(entry.regularHours) || 0) +
      (parseFloat(entry.overtimeHours) || 0) +
      (parseFloat(entry.doubletimeHours) || 0);
    return total > 0 && !!entry.costCodeId;
  }

  function isEntryMissingRequired(entry: CrewMemberEntryData): boolean {
    const total =
      (parseFloat(entry.regularHours) || 0) +
      (parseFloat(entry.overtimeHours) || 0) +
      (parseFloat(entry.doubletimeHours) || 0);
    return total > 0 && !entry.costCodeId;
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
      {/* Apply to All (mobile) - collapsible */}
      {(phases.length > 0 || equipmentList.length > 0) && (
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
                {phases.length > 0 && (
                  <div className="flex gap-2">
                    <select
                      value={applyPhaseId}
                      onChange={(e) => setApplyPhaseId(e.target.value)}
                      className="flex-1 h-12 rounded-md border border-input bg-background px-3 text-base focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">Select phase...</option>
                      {phases.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <Button
                      onClick={applyPhaseToAll}
                      disabled={!applyPhaseId}
                      className="min-h-[48px] bg-amber-500 hover:bg-amber-600 text-white touch-manipulation"
                    >
                      Apply
                    </Button>
                  </div>
                )}
                {equipmentList.length > 0 && (
                  <div className="flex gap-2">
                    <select
                      value={applyEquipmentId}
                      onChange={(e) => setApplyEquipmentId(e.target.value)}
                      className="flex-1 h-12 rounded-md border border-input bg-background px-3 text-base focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">Select equipment...</option>
                      {equipmentList.map((eq) => (
                        <option key={eq.id} value={eq.id}>
                          {eq.code} - {eq.name}
                        </option>
                      ))}
                    </select>
                    <Button
                      onClick={applyEquipmentToAll}
                      disabled={!applyEquipmentId}
                      className="min-h-[48px] bg-amber-500 hover:bg-amber-600 text-white touch-manipulation"
                    >
                      Apply
                    </Button>
                  </div>
                )}
                <p className="text-xs text-muted-foreground text-center">
                  This will set the selected phase/equipment on all {entries.length} crew members
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
        const missingReq = isEntryMissingRequired(entry);

        return (
          <Card
            key={entry.employeeId}
            className={`overflow-hidden transition-all ${
              entry.error
                ? "border-destructive"
                : complete
                ? "border-green-300 bg-green-50/30"
                : missingReq
                ? "border-amber-300 bg-amber-50/30"
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
                ) : missingReq ? (
                  <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
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

                {/* Cost Code */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Cost Code <span className="text-destructive">*</span></label>
                  <select
                    value={entry.costCodeId}
                    onChange={(e) =>
                      onUpdateEntry(entry.employeeId, "costCodeId", e.target.value)
                    }
                    className={`w-full min-h-[48px] rounded-md border bg-background px-3 text-base focus:outline-none focus:ring-2 focus:ring-ring touch-manipulation ${
                      missingReq ? "border-amber-400" : "border-input"
                    }`}
                  >
                    <option value="">Select cost code...</option>
                    {costCodes.map((cc) => (
                      <option key={cc.id} value={cc.id}>
                        {cc.code} - {cc.description}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Phase & Equipment */}
                <div className="grid gap-3 grid-cols-1 min-[480px]:grid-cols-2">
                  {phases.length > 0 && (
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Phase</label>
                      <select
                        value={entry.phaseId}
                        onChange={(e) =>
                          onUpdateEntry(entry.employeeId, "phaseId", e.target.value)
                        }
                        className="w-full min-h-[48px] rounded-md border border-input bg-background px-3 text-base focus:outline-none focus:ring-2 focus:ring-ring touch-manipulation"
                      >
                        <option value="">No phase</option>
                        {phases.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.costCode})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {equipmentList.length > 0 && (
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Equipment</label>
                      <select
                        value={entry.equipmentId}
                        onChange={(e) => {
                          const newEquipmentId = e.target.value;
                          onUpdateEntry(entry.employeeId, "equipmentId", newEquipmentId);
                          if (newEquipmentId) {
                            onUpdateEntry(entry.employeeId, "equipmentHours", entry.regularHours);
                          } else {
                            onUpdateEntry(entry.employeeId, "equipmentHours", "0");
                          }
                        }}
                        className="w-full min-h-[48px] rounded-md border border-input bg-background px-3 text-base focus:outline-none focus:ring-2 focus:ring-ring touch-manipulation"
                      >
                        <option value="">No equipment</option>
                        {equipmentList.map((eq) => (
                          <option key={eq.id} value={eq.id}>
                            {eq.code} - {eq.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

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
          const missingReq = isEntryMissingRequired(entry);
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
                  : missingReq
                  ? "bg-amber-500"
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

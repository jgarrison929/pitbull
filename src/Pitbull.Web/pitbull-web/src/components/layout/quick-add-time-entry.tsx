"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Clock, X, ChevronUp, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import api from "@/lib/api";
import type {
  Project,
  CostCode,
  PagedResult,
} from "@/lib/types";

// ─── localStorage helpers ────────────────────────────────────────────────────

const LAST_USED_KEY = "pitbull_quick_add_last_used";

interface LastUsedState {
  projectId: string;
  projectName: string;
  costCodeId: string;
  costCodeDescription: string;
}

function loadLastUsed(): LastUsedState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LAST_USED_KEY);
    return raw ? (JSON.parse(raw) as LastUsedState) : null;
  } catch {
    return null;
  }
}

function saveLastUsed(state: LastUsedState) {
  try {
    localStorage.setItem(LAST_USED_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export function QuickAddTimeEntry() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  // Form state
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [projectId, setProjectId] = useState("");
  const [costCodeId, setCostCodeId] = useState("");
  const [hours, setHours] = useState("");
  const [description, setDescription] = useState("");

  // Lookup data
  const [projects, setProjects] = useState<Project[]>([]);
  const [costCodes, setCostCodes] = useState<CostCode[]>([]);
  const [isLoadingLookups, setIsLoadingLookups] = useState(false);

  // Pre-fill from last used
  useEffect(() => {
    const last = loadLastUsed();
    if (last) {
      setProjectId(last.projectId);
      setCostCodeId(last.costCodeId);
    }
  }, []);

  // Load projects and cost codes when opened
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    async function load() {
      setIsLoadingLookups(true);
      try {
        const [projectsRes, costCodesRes] = await Promise.all([
          api<PagedResult<Project>>("/api/projects?pageSize=100").catch(() => null),
          api<PagedResult<CostCode>>("/api/cost-codes?pageSize=200").catch(() => null),
        ]);
        if (cancelled) return;
        if (projectsRes) setProjects(projectsRes.items);
        if (costCodesRes) setCostCodes(costCodesRes.items);
      } catch {
        // Silently fail - user can still type
      } finally {
        if (!cancelled) setIsLoadingLookups(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (formRef.current && !formRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!projectId || !costCodeId || !hours) {
        toast.error("Please fill in project, cost code, and hours");
        return;
      }

      const hoursNum = parseFloat(hours);
      if (isNaN(hoursNum) || hoursNum <= 0 || hoursNum > 24) {
        toast.error("Hours must be between 0 and 24");
        return;
      }

      setIsSubmitting(true);
      try {
        await api("/api/time-entries", {
          method: "POST",
          body: {
            date,
            projectId,
            costCodeId,
            regularHours: hoursNum,
            description: description || undefined,
          },
        });

        // Save last used
        const selectedProject = projects.find((p) => p.id === projectId);
        const selectedCostCode = costCodes.find((c) => c.id === costCodeId);
        if (selectedProject && selectedCostCode) {
          saveLastUsed({
            projectId,
            projectName: selectedProject.name,
            costCodeId,
            costCodeDescription: selectedCostCode.description,
          });
        }

        toast.success(`${hoursNum}h logged successfully`, {
          action: {
            label: "View",
            onClick: () => router.push("/time-tracking"),
          },
        });

        // Reset form
        setHours("");
        setDescription("");
        setIsOpen(false);
      } catch {
        toast.error("Failed to log time entry", {
          action: {
            label: "Retry",
            onClick: () => {
              void handleSubmit(e);
            },
          },
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [date, projectId, costCodeId, hours, description, projects, costCodes, router]
  );

  return (
    <>
      {/* FAB Button – visible on all screen sizes at bottom-right */}
      <div className="fixed bottom-6 right-6 z-50">
        {/* Expanded Form */}
        {isOpen && (
          <div
            ref={formRef}
            className="absolute bottom-16 right-0 w-[320px] animate-in slide-in-from-bottom-4 fade-in-0 duration-200"
          >
            <Card className="shadow-xl border-2">
              <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-500" />
                  Quick Time Entry
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => setIsOpen(false)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </CardHeader>
              <CardContent className="pb-4">
                <form onSubmit={handleSubmit} className="space-y-3">
                  {/* Date */}
                  <div className="space-y-1">
                    <Label htmlFor="qa-date" className="text-xs">
                      Date
                    </Label>
                    <Input
                      id="qa-date"
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>

                  {/* Project */}
                  <div className="space-y-1">
                    <Label htmlFor="qa-project" className="text-xs">
                      Project
                    </Label>
                    <select
                      id="qa-project"
                      value={projectId}
                      onChange={(e) => setProjectId(e.target.value)}
                      className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      disabled={isLoadingLookups}
                    >
                      <option value="">
                        {isLoadingLookups ? "Loading…" : "Select project"}
                      </option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.number} – {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Cost Code */}
                  <div className="space-y-1">
                    <Label htmlFor="qa-costcode" className="text-xs">
                      Cost Code
                    </Label>
                    <select
                      id="qa-costcode"
                      value={costCodeId}
                      onChange={(e) => setCostCodeId(e.target.value)}
                      className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      disabled={isLoadingLookups}
                    >
                      <option value="">
                        {isLoadingLookups ? "Loading…" : "Select cost code"}
                      </option>
                      {costCodes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code} – {c.description}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Hours */}
                  <div className="space-y-1">
                    <Label htmlFor="qa-hours" className="text-xs">
                      Hours
                    </Label>
                    <Input
                      id="qa-hours"
                      type="number"
                      step="0.25"
                      min="0"
                      max="24"
                      placeholder="8"
                      value={hours}
                      onChange={(e) => setHours(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-1">
                    <Label htmlFor="qa-desc" className="text-xs">
                      Notes{" "}
                      <span className="text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      id="qa-desc"
                      type="text"
                      placeholder="What did you work on?"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>

                  {/* Submit */}
                  <Button
                    type="submit"
                    size="sm"
                    className="w-full h-8 text-sm"
                    disabled={isSubmitting || !projectId || !costCodeId || !hours}
                  >
                    {isSubmitting ? (
                      "Submitting…"
                    ) : (
                      <>
                        <Send className="mr-1 h-3.5 w-3.5" />
                        Log Time
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {/* FAB */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-all duration-200 hover:shadow-xl active:scale-95",
            isOpen
              ? "bg-neutral-700 hover:bg-neutral-600 text-white"
              : "bg-amber-500 hover:bg-amber-600 text-white"
          )}
          aria-label={isOpen ? "Close quick time entry" : "Quick add time entry"}
          aria-expanded={isOpen}
        >
          {isOpen ? (
            <ChevronUp className="h-5 w-5" />
          ) : (
            <Clock className="h-5 w-5" />
          )}
        </button>
      </div>
    </>
  );
}

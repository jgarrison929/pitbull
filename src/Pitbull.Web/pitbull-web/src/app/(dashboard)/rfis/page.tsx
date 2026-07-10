"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRegisterShortcut } from "@/contexts/keyboard-shortcuts-context";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { TableSkeleton, CardListSkeleton } from "@/components/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { Download, HelpCircle, Search } from "lucide-react";
import api from "@/lib/api";
import type { PagedResult, Rfi, Project, RfiStatus, RfiPriority } from "@/lib/types";
import { toast } from "sonner";
import { useCompany } from "@/contexts/company-context";

function statusColor(status: RfiStatus) {
  switch (status) {
    case 0: // Open
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 hover:bg-blue-100";
    case 1: // Answered
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 hover:bg-green-100";
    case 2: // Closed
      return "bg-neutral-100 text-neutral-600 hover:bg-neutral-100";
    default:
      return "";
  }
}

function statusLabel(status: RfiStatus) {
  switch (status) {
    case 0:
      return "Open";
    case 1:
      return "Answered";
    case 2:
      return "Closed";
    default:
      return "Unknown";
  }
}

function priorityColor(priority: RfiPriority) {
  switch (priority) {
    case 0: // Low
      return "bg-neutral-100 text-neutral-600 hover:bg-neutral-100";
    case 1: // Normal
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 hover:bg-blue-100";
    case 2: // High
      return "bg-orange-100 text-orange-700 hover:bg-orange-100";
    case 3: // Urgent
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 hover:bg-red-100";
    default:
      return "";
  }
}

function priorityLabel(priority: RfiPriority) {
  switch (priority) {
    case 0:
      return "Low";
    case 1:
      return "Normal";
    case 2:
      return "High";
    case 3:
      return "Urgent";
    default:
      return "Unknown";
  }
}

const RFI_STATUS_NAME_MAP: Record<string, string> = {
  open: "0",
  answered: "1",
  closed: "2",
};

/** Matches role-kpi drill parseRfiDrillParams: notClosed | single enum | all */
function resolveRfiStatusParam(param: string | null): string {
  if (!param) return "all";
  const lower = param.toLowerCase();
  // Headline OpenRfiCount = Status != Closed (Open + Answered)
  if (lower === "notclosed" || lower === "openoranswered") return "notClosed";
  const mapped = RFI_STATUS_NAME_MAP[lower];
  if (mapped) return mapped;
  if (["0", "1", "2"].includes(param)) return param;
  return "all";
}

export default function RfisPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeCompany } = useCompany();
  const [rfis, setRfis] = useState<Rfi[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingRfis, setIsLoadingRfis] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const initialStatusFromUrl = useRef(resolveRfiStatusParam(searchParams.get("status")));

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(initialStatusFromUrl.current);
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  // Register keyboard shortcuts
  const handleNew = useCallback(() => {
    if (selectedProjectId) {
      router.push(`/rfis/new?projectId=${selectedProjectId}`);
    }
  }, [router, selectedProjectId]);

  const handleSearch = useCallback(() => {
    searchInputRef.current?.focus();
  }, []);

  useRegisterShortcut("n", "Create new RFI", handleNew, {
    enabled: !!selectedProjectId,
  });
  useRegisterShortcut("/", "Focus search", handleSearch);

  // Load projects on mount and when company changes
  useEffect(() => {
    async function fetchProjects() {
      setIsLoading(true);
      try {
        const result = await api<PagedResult<Project>>(
          "/api/projects?pageSize=100"
        );
        setProjects(result.items);
        // Auto-select first project if available
        if (result.items.length > 0) {
          setSelectedProjectId(result.items[0].id);
        } else {
          setSelectedProjectId("");
          setRfis([]);
        }
      } catch {
        toast.error("Failed to load projects");
      } finally {
        setIsLoading(false);
      }
    }
    fetchProjects();
  }, [activeCompany?.id]);

  // Load RFIs when project changes
  useEffect(() => {
    if (!selectedProjectId) {
      setRfis([]);
      return;
    }

    async function fetchRfis() {
      setIsLoadingRfis(true);
      try {
        const result = await api<PagedResult<Rfi>>(
          `/api/projects/${selectedProjectId}/rfis?pageSize=50`
        );
        setRfis(result.items);
      } catch {
        toast.error("Failed to load RFIs");
      } finally {
        setIsLoadingRfis(false);
      }
    }
    fetchRfis();
  }, [selectedProjectId]);

  // Filter RFIs based on search and filters
  const filteredRfis = useMemo(() => {
    return rfis.filter((rfi) => {
      // Search filter - check subject and question
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSubject = rfi.subject.toLowerCase().includes(query);
        const matchesQuestion = rfi.question?.toLowerCase().includes(query);
        if (!matchesSubject && !matchesQuestion) {
          return false;
        }
      }

      // Status filter — notClosed = Open(0) + Answered(1), matches executive KPI
      if (statusFilter !== "all") {
        if (statusFilter === "notClosed") {
          if (rfi.status === 2) return false; // exclude Closed only
        } else if (rfi.status !== parseInt(statusFilter)) {
          return false;
        }
      }

      // Priority filter
      if (priorityFilter !== "all") {
        if (rfi.priority !== parseInt(priorityFilter)) {
          return false;
        }
      }

      return true;
    });
  }, [rfis, searchQuery, statusFilter, priorityFilter]);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  // Export filtered RFIs to CSV
  const exportToCsv = useCallback(() => {
    if (!filteredRfis.length || !selectedProject) return;

    // CSV header
    const headers = [
      "RFI Number",
      "Subject",
      "Status",
      "Priority",
      "Due Date",
      "Created Date",
      "Has Cost Impact",
      "Estimated Cost",
    ];

    // Helper to escape CSV values
    const escapeCSV = (value: string | number | boolean | null | undefined): string => {
      if (value === null || value === undefined) return "";
      const str = String(value);
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    // Build CSV rows
    const rows = filteredRfis.map((rfi) => [
      `RFI-${String(rfi.number).padStart(3, "0")}`,
      escapeCSV(rfi.subject),
      statusLabel(rfi.status),
      priorityLabel(rfi.priority),
      rfi.dueDate ? new Date(rfi.dueDate).toLocaleDateString() : "",
      rfi.createdAt ? new Date(rfi.createdAt).toLocaleDateString() : "",
      rfi.hasCostImpact ? "Yes" : "No",
      rfi.estimatedCostImpact != null ? rfi.estimatedCostImpact.toFixed(2) : "",
    ]);

    // Combine header and rows
    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    // Create blob and download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    
    // Generate filename with project name and date
    const projectName = selectedProject.name.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
    const date = new Date().toISOString().split("T")[0];
    link.setAttribute("download", `rfis-${projectName}-${date}.csv`);
    link.setAttribute("href", url);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success("Export complete", {
      description: `Exported ${filteredRfis.length} RFIs to CSV`,
    });
  }, [filteredRfis, selectedProject]);

  // Reset filters when project changes, but preserve URL-driven status on first project load
  const hasAppliedUrlFilter = useRef(false);
  useEffect(() => {
    setSearchQuery("");
    setPriorityFilter("all");
    if (hasAppliedUrlFilter.current) {
      setStatusFilter("all");
    } else {
      hasAppliedUrlFilter.current = true;
    }
  }, [selectedProjectId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">RFIs</h1>
          <p className="text-muted-foreground">
            Track Requests for Information
          </p>
        </div>
        <div className="flex gap-3">
          <Select
            value={selectedProjectId}
            onValueChange={setSelectedProjectId}
          >
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Select a project" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.number} - {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedProjectId && (
            <Button
              asChild
              className="bg-amber-500 hover:bg-amber-600 text-white min-h-[44px] shrink-0"
            >
              <Link href={`/rfis/new?projectId=${selectedProjectId}`}>
                + New RFI
              </Link>
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {selectedProject
              ? `RFIs for ${selectedProject.number} - ${selectedProject.name}`
              : "Select a Project"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Search and Filter Controls */}
          {selectedProjectId && !isLoading && !isLoadingRfis && rfis.length > 0 && (
            <div className="mb-6 space-y-4">
              {/* Search input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  placeholder="Search by subject or question..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              {/* Filter dropdowns */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 sm:max-w-[200px]">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="notClosed">Open + Answered</SelectItem>
                      <SelectItem value="0">Open</SelectItem>
                      <SelectItem value="1">Answered</SelectItem>
                      <SelectItem value="2">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 sm:max-w-[200px]">
                  <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Priorities</SelectItem>
                      <SelectItem value="0">Low</SelectItem>
                      <SelectItem value="1">Normal</SelectItem>
                      <SelectItem value="2">High</SelectItem>
                      <SelectItem value="3">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {/* Show result count when filters are active */}
                {(searchQuery || statusFilter !== "all" || priorityFilter !== "all") && (
                  <div className="flex items-center text-sm text-muted-foreground">
                    Showing {filteredRfis.length} of {rfis.length} RFIs
                  </div>
                )}
                {/* Export button */}
                <div className="flex-1 sm:flex-none sm:ml-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportToCsv}
                    disabled={filteredRfis.length === 0}
                    className="w-full sm:w-auto"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Export to CSV
                  </Button>
                </div>
              </div>
            </div>
          )}

          {isLoading || isLoadingRfis ? (
            <>
              <CardListSkeleton rows={5} />
              <div className="hidden sm:block">
                <TableSkeleton
                  headers={[
                    "RFI #",
                    "Subject",
                    "Status",
                    "Priority",
                    "Ball In Court",
                    "Due Date",
                  ]}
                  rows={5}
                />
              </div>
            </>
          ) : !selectedProjectId ? (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">
                Please select a project to view RFIs
              </p>
            </div>
          ) : rfis.length === 0 ? (
            <EmptyState
              icon={HelpCircle}
              title="No RFIs yet"
              description="Create your first RFI to track questions about construction documents, specifications, or drawings."
              actionLabel="+ Create First RFI"
              actionHref={`/rfis/new?projectId=${selectedProjectId}`}
            />
          ) : filteredRfis.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">
                No RFIs match your search criteria
              </p>
              <Button
                variant="link"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                  setPriorityFilter("all");
                }}
                className="mt-2"
              >
                Clear filters
              </Button>
            </div>
          ) : (
            <>
              {/* Mobile card layout */}
              <div className="sm:hidden space-y-3">
                {filteredRfis.map((rfi) => (
                  <div key={rfi.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/rfis/${rfi.id}?projectId=${selectedProjectId}`}
                          className="font-medium text-amber-700 hover:underline text-sm"
                        >
                          {rfi.subject}
                        </Link>
                        <p className="text-xs text-muted-foreground font-mono mt-1">
                          RFI-{String(rfi.number).padStart(3, "0")}
                        </p>
                      </div>
                      <Badge
                        variant="secondary"
                        className={`${statusColor(rfi.status)} text-xs shrink-0`}
                      >
                        {statusLabel(rfi.status)}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground text-xs">
                          Priority
                        </span>
                        <div>
                          <Badge
                            variant="secondary"
                            className={`${priorityColor(rfi.priority)} text-xs`}
                          >
                            {priorityLabel(rfi.priority)}
                          </Badge>
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">
                          Ball In Court
                        </span>
                        <p className="font-medium">
                          {rfi.ballInCourtName || "—"}
                        </p>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Due{" "}
                      {rfi.dueDate
                        ? new Date(rfi.dueDate).toLocaleDateString()
                        : "—"}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table layout */}
              <div className="hidden sm:block">
                <div className="overflow-x-auto"><Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>RFI #</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Ball In Court</TableHead>
                      <TableHead>Due Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRfis.map((rfi) => (
                      <TableRow key={rfi.id}>
                        <TableCell className="font-mono text-sm">
                          RFI-{String(rfi.number).padStart(3, "0")}
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/rfis/${rfi.id}?projectId=${selectedProjectId}`}
                            className="font-medium text-amber-700 hover:underline"
                          >
                            {rfi.subject}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={statusColor(rfi.status)}
                          >
                            {statusLabel(rfi.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={priorityColor(rfi.priority)}
                          >
                            {priorityLabel(rfi.priority)}
                          </Badge>
                        </TableCell>
                        <TableCell>{rfi.ballInCourtName || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {rfi.dueDate
                            ? new Date(rfi.dueDate).toLocaleDateString()
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table></div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

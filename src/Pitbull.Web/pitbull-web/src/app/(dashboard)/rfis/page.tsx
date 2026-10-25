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
import type { PagedResult, Project } from "@/lib/types";
import {
  formatRfiDueLabel,
  normalizeRfiStatus,
  rfiMobileListUrl,
  rfiStatusBadgeClass,
  type RfiMobileListItem,
  RFI_LIST_EMPTY_DESCRIPTION,
  RFI_LIST_EMPTY_TITLE,
  RFI_LIST_ERROR_DESCRIPTION,
  RFI_LIST_ERROR_TITLE,
} from "@/lib/rfi-mobile-list";
import { toast } from "sonner";
import { useCompany } from "@/contexts/company-context";

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
  const [rfis, setRfis] = useState<RfiMobileListItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingRfis, setIsLoadingRfis] = useState(false);
  const [listError, setListError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const initialStatusFromUrl = useRef(resolveRfiStatusParam(searchParams.get("status")));

  // Filter states (status only on slim list — priority lives on full DTO / detail)
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(initialStatusFromUrl.current);

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
      setListError(false);
      try {
        // Band 3.4.4: slim mobile list DTO (id, number, subject, status, dueDate, …)
        const result = await api<PagedResult<RfiMobileListItem>>(
          rfiMobileListUrl(selectedProjectId, 50)
        );
        setRfis(result.items);
      } catch {
        setRfis([]);
        setListError(true);
        toast.error(RFI_LIST_ERROR_TITLE);
      } finally {
        setIsLoadingRfis(false);
      }
    }
    fetchRfis();
  }, [selectedProjectId, reloadToken]);

  // Filter RFIs based on search and status (slim list has no priority / question body)
  const filteredRfis = useMemo(() => {
    return rfis.filter((rfi) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!rfi.subject.toLowerCase().includes(query)) {
          return false;
        }
      }

      // Status filter — notClosed = Open + Answered; numeric URL codes map via normalize
      if (statusFilter !== "all") {
        const label = normalizeRfiStatus(rfi.status).toLowerCase();
        if (statusFilter === "notClosed") {
          if (label === "closed") return false;
        } else {
          const wanted = normalizeRfiStatus(statusFilter).toLowerCase();
          if (label !== wanted) return false;
        }
      }

      return true;
    });
  }, [rfis, searchQuery, statusFilter]);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  // Export filtered RFIs to CSV (slim list fields only)
  const exportToCsv = useCallback(() => {
    if (!filteredRfis.length || !selectedProject) return;

    const headers = ["RFI Number", "Subject", "Status", "Due Date"];

    const escapeCSV = (value: string | number | boolean | null | undefined): string => {
      if (value === null || value === undefined) return "";
      const str = String(value);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = filteredRfis.map((rfi) => [
      `RFI-${String(rfi.number).padStart(3, "0")}`,
      escapeCSV(rfi.subject),
      normalizeRfiStatus(rfi.status),
      rfi.dueDate ? new Date(rfi.dueDate).toLocaleDateString() : "",
    ]);

    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
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
            Job RFIs — status and due date first (phone-friendly list)
          </p>
        </div>
        <div className="flex flex-col xs:flex-row gap-3 w-full sm:w-auto">
          <Select
            value={selectedProjectId}
            onValueChange={setSelectedProjectId}
          >
            <SelectTrigger className="w-full sm:w-[250px] min-h-[44px]">
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
                  placeholder="Search by subject..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 min-h-[44px]"
                />
              </div>
              
              {/* Status filter only — slim list omits priority (see detail for full row) */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 sm:max-w-[200px]">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="min-h-[44px]">
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
                {(searchQuery || statusFilter !== "all") && (
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
                  headers={["RFI #", "Subject", "Status", "Due Date"]}
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
          ) : listError ? (
            <EmptyState
              icon={HelpCircle}
              title={RFI_LIST_ERROR_TITLE}
              description={RFI_LIST_ERROR_DESCRIPTION}
              actionLabel="Retry"
              onAction={() => {
                setListError(false);
                setReloadToken((n) => n + 1);
              }}
            />
          ) : rfis.length === 0 ? (
            <EmptyState
              icon={HelpCircle}
              title={RFI_LIST_EMPTY_TITLE}
              description={RFI_LIST_EMPTY_DESCRIPTION}
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
                }}
                className="mt-2"
              >
                Clear filters
              </Button>
            </div>
          ) : (
            <>
              {/* Phone card layout — one column, status + due/overdue, large tap targets */}
              <div className="sm:hidden space-y-3">
                {filteredRfis.map((rfi) => {
                  const due = formatRfiDueLabel(rfi.dueDate, rfi.status);
                  return (
                    <Link
                      key={rfi.id}
                      href={`/rfis/${rfi.id}?projectId=${selectedProjectId}`}
                      className="block border rounded-lg p-4 space-y-2 min-h-[72px] active:bg-muted/50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-amber-700 text-base leading-snug break-words">
                            {rfi.subject}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono mt-1">
                            RFI-{String(rfi.number).padStart(3, "0")}
                          </p>
                        </div>
                        <Badge
                          variant="secondary"
                          className={`${rfiStatusBadgeClass(rfi.status)} text-xs shrink-0`}
                        >
                          {normalizeRfiStatus(rfi.status)}
                        </Badge>
                      </div>
                      <p
                        className={`text-sm font-medium ${
                          due.overdue
                            ? "text-red-600 dark:text-red-400"
                            : "text-muted-foreground"
                        }`}
                      >
                        {due.text}
                      </p>
                    </Link>
                  );
                })}
              </div>

              {/* Desktop table — slim columns only (no horizontal priority/BIC clutter) */}
              <div className="hidden sm:block">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>RFI #</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Due Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRfis.map((rfi) => {
                        const due = formatRfiDueLabel(rfi.dueDate, rfi.status);
                        return (
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
                                className={rfiStatusBadgeClass(rfi.status)}
                              >
                                {normalizeRfiStatus(rfi.status)}
                              </Badge>
                            </TableCell>
                            <TableCell
                              className={
                                due.overdue
                                  ? "text-red-600 dark:text-red-400 font-medium"
                                  : "text-muted-foreground"
                              }
                            >
                              {due.text}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNewShortcut } from "@/hooks/use-page-shortcuts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TableSkeleton, CardListSkeleton } from "@/components/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { HardHat } from "lucide-react";
import api from "@/lib/api";
import { ProjectStatus, type PagedResult, type Project } from "@/lib/types";
import { projectStatusBadgeClass, projectStatusLabel } from "@/lib/projects";
import { toast } from "sonner";
import { useCompany } from "@/contexts/company-context";
import { parseProjectsDrillParams } from "@/lib/role-kpi-drills";

const ALL_VALUE = "__all__";
const DEFAULT_PAGE_SIZE = 25;

const STATUS_NAME_MAP: Record<string, string> = {
  bidding: String(ProjectStatus.Bidding),
  "pre-construction": String(ProjectStatus.PreConstruction),
  preconstruction: String(ProjectStatus.PreConstruction),
  active: String(ProjectStatus.Active),
  completed: String(ProjectStatus.Completed),
  closed: String(ProjectStatus.Closed),
  "on-hold": String(ProjectStatus.OnHold),
  onhold: String(ProjectStatus.OnHold),
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(amount);
}

function resolveStatusParam(param: string | null): string {
  if (!param) return ALL_VALUE;
  const mapped = STATUS_NAME_MAP[param.toLowerCase()];
  if (mapped) return mapped;
  // Allow numeric values directly (e.g. ?status=2)
  const num = Number(param);
  if (!isNaN(num) && num >= 0 && num <= 5) return String(num);
  return ALL_VALUE;
}

export default function ProjectsPage() {
  const searchParams = useSearchParams();
  const { activeCompany } = useCompany();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(() =>
    resolveStatusParam(searchParams.get("status"))
  );
  const drill = parseProjectsDrillParams(searchParams);
  const [budgetAlertFilter] = useState<boolean>(() => drill.budgetAlert);
  const [unbilledFilter] = useState<boolean>(() => drill.unbilled);
  const [budgetAlertPercent] = useState<number>(() => drill.budgetAlertPercent);
  const [excludeCompletedFilter] = useState<boolean>(() => drill.excludeCompleted);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Register "n" shortcut to create new project
  useNewShortcut("/projects/new");

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, activeCompany?.id]);

  const fetchProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(DEFAULT_PAGE_SIZE));
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter !== ALL_VALUE) params.set("status", statusFilter);
      if (budgetAlertFilter) {
        params.set("budgetAlert", "true");
        params.set("budgetAlertPercent", String(budgetAlertPercent));
      }
      if (unbilledFilter) params.set("unbilled", "true");
      if (excludeCompletedFilter) params.set("excludeCompleted", "true");
      const result = await api<PagedResult<Project>>(
        `/api/projects?${params.toString()}`
      );
      setProjects(result.items);
      setTotalPages(result.totalPages);
      setTotalCount(result.totalCount);
    } catch {
      toast.error("Failed to load projects");
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- activeCompany?.id triggers refetch on company switch
  }, [page, search, statusFilter, budgetAlertFilter, budgetAlertPercent, unbilledFilter, excludeCompletedFilter, activeCompany?.id]);

  useEffect(() => {
    const timer = setTimeout(fetchProjects, 250);
    return () => clearTimeout(timer);
  }, [fetchProjects]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground">
            {unbilledFilter
              ? "Projects with remaining unbilled contract value (portfolio − G702 billed)"
              : budgetAlertFilter
                ? `Projects where labor spend ≥ ${budgetAlertPercent}% of contract (labor proxy)`
                : excludeCompletedFilter
                  ? "Non-completed projects (matches executive Active Projects KPI)"
                : "Manage your construction projects"}
          </p>
          {(unbilledFilter || budgetAlertFilter || excludeCompletedFilter) && (
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
              Drill filter active — {totalCount} project{totalCount !== 1 ? "s" : ""} match
              {unbilledFilter
                ? " unbilled backlog"
                : budgetAlertFilter
                  ? " budget alert"
                  : " exclude-completed"}{" "}
              criteria.
            </p>
          )}
        </div>
        <Button
          asChild
          className="bg-amber-500 hover:bg-amber-600 text-white min-h-[44px] shrink-0"
        >
          <Link href="/projects/new">+ New Project</Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="project-search">Search</Label>
              <Input
                id="project-search"
                placeholder="Name or project number..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-status">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="project-status">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>All statuses</SelectItem>
                  <SelectItem value={String(ProjectStatus.Bidding)}>Bidding</SelectItem>
                  <SelectItem value={String(ProjectStatus.PreConstruction)}>Pre-Construction</SelectItem>
                  <SelectItem value={String(ProjectStatus.Active)}>Active</SelectItem>
                  <SelectItem value={String(ProjectStatus.Completed)}>Completed</SelectItem>
                  <SelectItem value={String(ProjectStatus.Closed)}>Closed</SelectItem>
                  <SelectItem value={String(ProjectStatus.OnHold)}>On Hold</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All Projects</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <>
              <CardListSkeleton rows={5} />
              <div className="hidden sm:block">
                <TableSkeleton
                  headers={[
                    "Number",
                    "Name",
                    "Status",
                    "Client",
                    "Contract",
                    "Created",
                  ]}
                  rows={5}
                />
              </div>
            </>
          ) : projects.length === 0 ? (
            <EmptyState
              icon={HardHat}
              title="No projects yet"
              description="Kick things off by creating your first project. Track budgets, timelines, and keep your crew on the same page."
              actionLabel="+ Create Your First Project"
              actionHref="/projects/new"
            />
          ) : (
            <>
              {/* Mobile card layout */}
              <div className="sm:hidden space-y-3">
                {projects.map((project) => (
                  <div
                    key={project.id}
                    className="border rounded-lg p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/projects/${project.id}`}
                          className="font-medium text-amber-700 hover:underline text-sm"
                        >
                          {project.name}
                        </Link>
                        <p className="text-xs text-muted-foreground font-mono mt-1">
                          {project.number}
                        </p>
                      </div>
                      <Badge
                        variant="secondary"
                        className={`${projectStatusBadgeClass(project.status)} text-xs shrink-0`}
                      >
                        {projectStatusLabel(project.status)}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground text-xs">
                          Client
                        </span>
                        <p className="font-medium">{project.clientName || "—"}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">
                          Contract
                        </span>
                        <p className="font-medium font-mono">
                          {formatCurrency(project.contractAmount)}
                        </p>
                      </div>
                      {unbilledFilter && (
                        <>
                          <div>
                            <span className="text-muted-foreground text-xs">Billed</span>
                            <p className="font-medium font-mono">
                              {formatCurrency(project.billedToDate ?? 0)}
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-xs">Unbilled</span>
                            <p className="font-medium font-mono text-amber-700">
                              {formatCurrency(project.unbilledAmount ?? 0)}
                            </p>
                          </div>
                        </>
                      )}
                      {budgetAlertFilter && project.laborPercentOfContract != null && (
                        <div className="col-span-2">
                          <span className="text-muted-foreground text-xs">Labor % of contract</span>
                          <p className="font-medium">
                            {project.laborPercentOfContract.toFixed(0)}% (
                            {formatCurrency(project.laborSpent ?? 0)})
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Created{" "}
                      {project.createdAt
                        ? new Date(project.createdAt).toLocaleDateString()
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
                      <TableHead>Number</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead className="text-right">Contract</TableHead>
                      {unbilledFilter && (
                        <>
                          <TableHead className="text-right">Billed</TableHead>
                          <TableHead className="text-right">Unbilled</TableHead>
                        </>
                      )}
                      {budgetAlertFilter && (
                        <TableHead className="text-right">Labor %</TableHead>
                      )}
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projects.map((project) => (
                      <TableRow key={project.id}>
                        <TableCell className="font-mono text-sm">
                          {project.number}
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/projects/${project.id}`}
                            className="font-medium text-amber-700 hover:underline"
                          >
                            {project.name}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={projectStatusBadgeClass(project.status)}
                          >
                            {projectStatusLabel(project.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>{project.clientName || "—"}</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(project.contractAmount)}
                        </TableCell>
                        {unbilledFilter && (
                          <>
                            <TableCell className="text-right font-mono">
                              {formatCurrency(project.billedToDate ?? 0)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-amber-700">
                              {formatCurrency(project.unbilledAmount ?? 0)}
                            </TableCell>
                          </>
                        )}
                        {budgetAlertFilter && (
                          <TableCell className="text-right font-mono">
                            {project.laborPercentOfContract != null
                              ? `${project.laborPercentOfContract.toFixed(0)}%`
                              : "—"}
                          </TableCell>
                        )}
                        <TableCell className="text-muted-foreground">
                          {project.createdAt
                            ? new Date(project.createdAt).toLocaleDateString()
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table></div>
              </div>
            </>
          )}

          {/* Pagination */}
          {!isLoading && projects.length > 0 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-sm text-muted-foreground">
                Showing {(page - 1) * DEFAULT_PAGE_SIZE + 1}-
                {Math.min(page * DEFAULT_PAGE_SIZE, totalCount)} of {totalCount}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { TableSkeleton, CardListSkeleton } from "@/components/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { HelpCircle } from "lucide-react";
import api from "@/lib/api";
import type { PagedResult, Rfi, Project, RfiStatus, RfiPriority } from "@/lib/types";
import { toast } from "sonner";

function statusColor(status: RfiStatus) {
  switch (status) {
    case 0: // Open
      return "bg-blue-100 text-blue-700 hover:bg-blue-100";
    case 1: // Answered
      return "bg-green-100 text-green-700 hover:bg-green-100";
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
      return "bg-blue-100 text-blue-700 hover:bg-blue-100";
    case 2: // High
      return "bg-orange-100 text-orange-700 hover:bg-orange-100";
    case 3: // Urgent
      return "bg-red-100 text-red-700 hover:bg-red-100";
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

export default function RfisPage() {
  const [rfis, setRfis] = useState<Rfi[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingRfis, setIsLoadingRfis] = useState(false);

  // Load projects on mount
  useEffect(() => {
    async function fetchProjects() {
      try {
        const result = await api<PagedResult<Project>>(
          "/api/projects?pageSize=100"
        );
        setProjects(result.items);
        // Auto-select first project if available
        if (result.items.length > 0) {
          setSelectedProjectId(result.items[0].id);
        }
      } catch {
        toast.error("Failed to load projects");
      } finally {
        setIsLoading(false);
      }
    }
    fetchProjects();
  }, []);

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

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

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
          ) : (
            <>
              {/* Mobile card layout */}
              <div className="sm:hidden space-y-3">
                {rfis.map((rfi) => (
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
                <Table>
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
                    {rfis.map((rfi) => (
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
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

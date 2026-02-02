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
import { TableSkeleton, CardListSkeleton } from "@/components/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { HardHat } from "lucide-react";
import api from "@/lib/api";
import type { PagedResult, Project } from "@/lib/types";
import { toast } from "sonner";

function statusColor(status: string) {
  switch (status) {
    case "Active":
      return "bg-green-100 text-green-700 hover:bg-green-100";
    case "OnHold":
      return "bg-yellow-100 text-yellow-700 hover:bg-yellow-100";
    case "Preconstruction":
      return "bg-blue-100 text-blue-700 hover:bg-blue-100";
    case "Complete":
      return "bg-neutral-100 text-neutral-600 hover:bg-neutral-100";
    case "Closed":
      return "bg-neutral-200 text-neutral-500 hover:bg-neutral-200";
    default:
      return "";
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "OnHold":
      return "On Hold";
    default:
      return status;
  }
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchProjects() {
      try {
        const result = await api<PagedResult<Project>>(
          "/api/projects?pageSize=50"
        );
        setProjects(result.items);
      } catch {
        toast.error("Failed to load projects");
      } finally {
        setIsLoading(false);
      }
    }
    fetchProjects();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground">Manage your construction projects</p>
        </div>
        <Button asChild className="bg-amber-500 hover:bg-amber-600 text-white min-h-[44px] shrink-0">
          <Link href="/projects/new">+ New Project</Link>
        </Button>
      </div>

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
                  headers={['Number', 'Name', 'Status', 'Client', 'Est. Value', 'Created']}
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
                  <div key={project.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/projects/${project.id}`}
                          className="font-medium text-amber-700 hover:underline text-sm"
                        >
                          {project.name}
                        </Link>
                        <p className="text-xs text-muted-foreground font-mono mt-1">
                          {project.projectNumber}
                        </p>
                      </div>
                      <Badge
                        variant="secondary"
                        className={`${statusColor(project.status)} text-xs shrink-0`}
                      >
                        {statusLabel(project.status)}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground text-xs">Client</span>
                        <p className="font-medium">{project.clientName || "—"}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">Est. Value</span>
                        <p className="font-medium font-mono">
                          {project.estimatedValue ? formatCurrency(project.estimatedValue) : "—"}
                        </p>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Created {project.createdAt ? new Date(project.createdAt).toLocaleDateString() : "—"}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table layout */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Number</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead className="text-right">Est. Value</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projects.map((project) => (
                      <TableRow key={project.id}>
                        <TableCell className="font-mono text-sm">
                          {project.projectNumber}
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
                            className={statusColor(project.status)}
                          >
                            {statusLabel(project.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>{project.clientName || "—"}</TableCell>
                        <TableCell className="text-right font-mono">
                          {project.estimatedValue
                            ? formatCurrency(project.estimatedValue)
                            : "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {project.createdAt
                            ? new Date(project.createdAt).toLocaleDateString()
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

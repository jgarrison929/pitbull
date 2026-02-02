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
import { Skeleton } from "@/components/ui/skeleton";
import api from "@/lib/api";
import type { PaginatedResult, Project } from "@/lib/types";
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
        const result = await api<PaginatedResult<Project>>(
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground">Manage your construction projects</p>
        </div>
        <Button asChild className="bg-amber-500 hover:bg-amber-600 text-white">
          <Link href="/projects/new">+ New Project</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All Projects</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">No projects yet.</p>
              <Button asChild variant="outline" className="mt-4">
                <Link href="/projects/new">Create your first project</Link>
              </Button>
            </div>
          ) : (
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}

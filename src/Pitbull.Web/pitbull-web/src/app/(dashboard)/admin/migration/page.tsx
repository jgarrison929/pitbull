"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import api from "@/lib/api";
import { toast } from "sonner";
import { Plus, Database, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

interface MigrationProject {
  id: string;
  name: string;
  sourceSystem: string;
  status: string;
  totalRecords: number;
  importedRecords: number;
  errorCount: number;
  createdAt: string;
  completedAt: string | null;
}

function statusBadgeVariant(status: string): string {
  switch (status) {
    case "Complete":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200";
    case "Failed":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200";
    case "InProgress":
    case "Validating":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200";
    case "Validated":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200";
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200";
  }
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function MigrationDashboardPage() {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const [projects, setProjects] = useState<MigrationProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api<MigrationProject[]>("/api/migration/projects");
      setProjects(data);
    } catch {
      toast.error("Failed to load migration projects");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      router.push("/");
      toast.error("Access denied. Admin privileges required.");
      return;
    }
    fetchProjects();
  }, [isAdmin, router, fetchProjects]);

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Admin", href: "/admin/company" }, { label: "Data Migration" }]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Data Migration</h1>
          <p className="text-muted-foreground">
            Migrate data from Vista, Sage, QuickBooks, or CSV into Pitbull
          </p>
        </div>
        <Button asChild className="bg-amber-500 hover:bg-amber-600 text-white">
          <Link href="/admin/migration/new">
            <Plus className="mr-2 h-4 w-4" />
            New Migration
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Migration Projects</CardTitle>
          <CardDescription>Track import progress and review results</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <EmptyState
              icon={Database}
              title="No migration projects"
              description="Start a new migration to import data from your existing systems."
              actionLabel="New Migration"
              actionHref="/admin/migration/new"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Records</TableHead>
                  <TableHead className="text-right">Errors</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell className="font-medium">{project.name}</TableCell>
                    <TableCell>{project.sourceSystem}</TableCell>
                    <TableCell>
                      <Badge className={statusBadgeVariant(project.status)}>
                        {project.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {project.importedRecords}/{project.totalRecords}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {project.errorCount > 0 ? (
                        <span className="text-red-600">{project.errorCount}</span>
                      ) : (
                        "0"
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(project.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">
                        <ArrowRight className="h-4 w-4" />
                      </Button>
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

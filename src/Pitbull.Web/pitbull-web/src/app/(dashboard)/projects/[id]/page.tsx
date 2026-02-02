"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { DetailPageSkeleton } from "@/components/skeletons";
import api from "@/lib/api";
import { ProjectStatus, ProjectType, type Project } from "@/lib/types";
import { toast } from "sonner";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(amount);
}

function statusColor(status: ProjectStatus) {
  switch (status) {
    case ProjectStatus.Active:
      return "bg-green-100 text-green-700";
    case ProjectStatus.OnHold:
      return "bg-yellow-100 text-yellow-700";
    case ProjectStatus.PreConstruction:
      return "bg-blue-100 text-blue-700";
    case ProjectStatus.Bidding:
      return "bg-purple-100 text-purple-700";
    case ProjectStatus.Completed:
      return "bg-neutral-100 text-neutral-600";
    case ProjectStatus.Closed:
      return "bg-neutral-200 text-neutral-500";
    default:
      return "";
  }
}

function statusLabel(status: ProjectStatus) {
  switch (status) {
    case ProjectStatus.OnHold:
      return "On Hold";
    case ProjectStatus.PreConstruction:
      return "Pre-Construction";
    default:
      return ProjectStatus[status];
  }
}

function typeLabel(type: ProjectType) {
  switch (type) {
    case ProjectType.TenantImprovement:
      return "Tenant Improvement";
    default:
      return ProjectType[type];
  }
}

function formatLocation(project: Project) {
  const parts = [project.address, project.city, project.state, project.zipCode].filter(Boolean);
  return parts.length ? parts.join(", ") : "—";
}

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProject() {
      try {
        const data = await api<Project>(`/api/projects/${id}`);
        setProject(data);
      } catch {
        setError("Failed to load project");
        toast.error("Failed to load project");
      } finally {
        setIsLoading(false);
      }
    }
    fetchProject();
  }, [id]);

  if (isLoading) {
    return <DetailPageSkeleton />;
  }

  if (error || !project) {
    return (
      <div className="space-y-6">
        <div className="py-12 text-center">
          <p className="text-muted-foreground">{error || "Project not found"}</p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/projects">Back to Projects</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
            <Badge variant="secondary" className={statusColor(project.status)}>
              {statusLabel(project.status)}
            </Badge>
          </div>
          <p className="text-muted-foreground font-mono text-sm">{project.number}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Project Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">Client</span>
              <span className="font-medium">{project.clientName || "—"}</span>

              <span className="text-muted-foreground">Type</span>
              <span className="font-medium">{typeLabel(project.type)}</span>

              <span className="text-muted-foreground">Location</span>
              <span className="font-medium">{formatLocation(project)}</span>

              <span className="text-muted-foreground">Contract</span>
              <span className="font-medium font-mono">{formatCurrency(project.contractAmount)}</span>

              <span className="text-muted-foreground">Start Date</span>
              <span className="font-medium">
                {project.startDate ? new Date(project.startDate).toLocaleDateString() : "—"}
              </span>

              <span className="text-muted-foreground">Est. Completion</span>
              <span className="font-medium">
                {project.estimatedCompletionDate
                  ? new Date(project.estimatedCompletionDate).toLocaleDateString()
                  : "—"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {project.description || "No description provided."}
            </p>
          </CardContent>
        </Card>
      </div>

      <Separator />

      <div className="flex">
        <Button variant="ghost" asChild className="min-h-[44px]">
          <Link href="/projects">← Back to Projects</Link>
        </Button>
      </div>
    </div>
  );
}

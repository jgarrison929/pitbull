"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { DetailPageSkeleton } from "@/components/skeletons";
import { AiInsights } from "@/components/ui/ai-insights";
import { HealthScoreBadge } from "@/components/ui/health-score-gauge";
import api from "@/lib/api";
import { ProjectLaborSummary } from "@/components/projects/project-labor-summary";
import type { AiProjectSummary, Project } from "@/lib/types";
import {
  projectStatusBadgeClass,
  projectStatusLabel,
  projectTypeLabel,
} from "@/lib/projects";
import { toast } from "sonner";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(amount);
}

function formatLocation(project: Project): string {
  const parts = [project.address, project.city, project.state, project.zipCode]
    .map((p) => (p ?? "").trim())
    .filter(Boolean);
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

  // AI Insights state
  const [aiSummary, setAiSummary] = useState<AiProjectSummary | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showAiInsights, setShowAiInsights] = useState(false);

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

  const fetchAiInsights = useCallback(async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const data = await api<AiProjectSummary>(`/api/projects/${id}/ai-summary`);
      setAiSummary(data);
      if (!showAiInsights) setShowAiInsights(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to generate AI insights";
      setAiError(message);
      toast.error("AI insights unavailable", { description: message });
    } finally {
      setAiLoading(false);
    }
  }, [id, showAiInsights]);

  if (isLoading) return <DetailPageSkeleton />;

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
            <Badge
              variant="secondary"
              className={projectStatusBadgeClass(project.status)}
            >
              {projectStatusLabel(project.status)}
            </Badge>
            {aiSummary && aiSummary.success && (
              <HealthScoreBadge score={aiSummary.healthScore} />
            )}
          </div>
          <p className="text-muted-foreground font-mono text-sm">{project.number}</p>
        </div>
        <Button
          onClick={fetchAiInsights}
          disabled={aiLoading}
          variant={showAiInsights ? "secondary" : "default"}
          className="gap-2"
        >
          <Sparkles className={`h-4 w-4 ${aiLoading ? "animate-spin" : ""}`} />
          {aiLoading ? "Analyzing..." : showAiInsights ? "Refresh AI Insights" : "Get AI Insights"}
        </Button>
      </div>

      {/* Labor Summary */}
      <ProjectLaborSummary projectId={id} />

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
              <span className="font-medium">{projectTypeLabel(project.type)}</span>

              <span className="text-muted-foreground">Location</span>
              <span className="font-medium">{formatLocation(project)}</span>

              <span className="text-muted-foreground">Contract Amount</span>
              <span className="font-medium font-mono">
                {formatCurrency(project.contractAmount)}
              </span>

              <span className="text-muted-foreground">Start Date</span>
              <span className="font-medium">
                {project.startDate
                  ? new Date(project.startDate).toLocaleDateString()
                  : "—"}
              </span>

              <span className="text-muted-foreground">Estimated Completion</span>
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

      {/* AI Insights Section */}
      {(showAiInsights || aiLoading) && (
        <AiInsights
          projectId={id}
          summary={aiSummary}
          isLoading={aiLoading}
          error={aiError}
          onRefresh={fetchAiInsights}
        />
      )}

      <Separator />

      <div className="flex">
        <Button variant="ghost" asChild className="min-h-[44px]">
          <Link href="/projects">← Back to Projects</Link>
        </Button>
      </div>
    </div>
  );
}

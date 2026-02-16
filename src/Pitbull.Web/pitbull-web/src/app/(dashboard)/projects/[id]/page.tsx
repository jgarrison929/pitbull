"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Link2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { DetailPageSkeleton } from "@/components/skeletons";
import { AiInsights } from "@/components/ui/ai-insights";
import { HealthScoreBadge } from "@/components/ui/health-score-gauge";
import api from "@/lib/api";
import { ProjectLaborSummary } from "@/components/projects/project-labor-summary";
import { ProjectPhasesTable } from "@/components/projects/project-phases-table";
import { ProjectEquipmentSummary } from "@/components/projects/project-equipment-summary";
import { RfiCostWidget } from "@/components/rfis";
import { HoursTrendChart } from "@/components/charts/hours-trend-chart";
import { CostDistributionChart } from "@/components/charts/cost-distribution-chart";
import { PhaseProgressChart } from "@/components/charts/phase-progress-chart";
import { useRecentProjects } from "@/hooks/use-recent-projects";
import { useRecentlyViewed } from "@/hooks/use-recently-viewed";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
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

const pmNavItems = [
  { label: "Schedule", href: "schedule" },
  { label: "Job Cost", href: "job-cost" },
  { label: "RFIs", href: "rfis" },
  { label: "Submittals", href: "submittals" },
  { label: "Plans & Specs", href: "plans-specs" },
  { label: "Communications", href: "communications" },
  { label: "Daily Reports", href: "daily-reports" },
  { label: "Progress", href: "progress" },
  { label: "Projections", href: "projections" },
  { label: "Meetings", href: "meetings" },
  { label: "Documents", href: "documents" },
  { label: "Tasks", href: "tasks" },
  { label: "Narratives", href: "narratives" },
];

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

  const { addRecentProject } = useRecentProjects();
  const { addRecentItem } = useRecentlyViewed();

  useEffect(() => {
    async function fetchProject() {
      try {
        const data = await api<Project>(`/api/projects/${id}`);
        setProject(data);
        // Track this project as recently viewed (for project switcher)
        addRecentProject({
          id: data.id,
          name: data.name,
          number: data.number,
        });
        // Track for general recently viewed (dashboard widget)
        addRecentItem({
          id: data.id,
          type: "project",
          name: data.name,
          identifier: data.number,
        });
      } catch {
        setError("Failed to load project");
        toast.error("Failed to load project");
      } finally {
        setIsLoading(false);
      }
    }
    fetchProject();
  }, [id, addRecentProject, addRecentItem]);

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
      <Breadcrumbs
        items={[
          { label: "Projects", href: "/projects" },
          { label: project.name },
        ]}
      />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                toast.success("Link copied to clipboard");
              }}
              title="Copy link" aria-label="Copy link"
            >
              <Link2 className="h-4 w-4" />
            </Button>
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

      {/* Visual Charts: Hours Trend + Cost Distribution */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <HoursTrendChart projectId={id} title="Project Hours Trend" days={42} />
        </div>
        <CostDistributionChart projectId={id} title="Project Costs" />
      </div>

      {/* Phase Progress Chart */}
      <PhaseProgressChart projectId={id} title="Phase Progress & Budget" />

      {/* Labor Summary */}
      <ProjectLaborSummary projectId={id} />

      {/* Phase Progress & Budget Tracking (Table) */}
      <ProjectPhasesTable projectId={id} />

      {/* Equipment Hours + RFI Cost Impact */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ProjectEquipmentSummary projectId={id} />
        <RfiCostWidget projectId={id} />
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Project Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {pmNavItems.map((item) => (
              <Button key={item.href} variant="outline" asChild className="justify-start">
                <Link href={`/projects/${id}/${item.href}`}>{item.label}</Link>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Separator />

      <div className="flex">
        <Button variant="ghost" asChild className="min-h-[44px]">
          <Link href="/projects">← Back to Projects</Link>
        </Button>
      </div>
    </div>
  );
}

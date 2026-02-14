"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Layers, ExternalLink } from "lucide-react";
import api from "@/lib/api";
import type { Project, Phase } from "@/lib/types";
import { ProjectStatus } from "@/lib/types";

interface ProjectPhaseData {
  projectId: string;
  projectName: string;
  projectNumber: string;
  phases: Phase[];
  overallProgress: number;
}

export function PhaseProgressWidget() {
  const [projects, setProjects] = useState<ProjectPhaseData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const result = await api<{ items: Project[] }>(
          "/api/projects?pageSize=100&status=Active"
        );

        // Fetch phases for active projects (up to 5)
        const activeProjects = result.items
          .filter((p) => p.status === ProjectStatus.Active)
          .slice(0, 5);

        const projectPhases = await Promise.all(
          activeProjects.map(async (project) => {
            try {
              const phases = await api<Phase[]>(
                `/api/projects/${project.id}/phases`
              );
              const totalPhases = phases.length;
              const overallProgress =
                totalPhases > 0
                  ? phases.reduce((sum, p) => sum + p.percentComplete, 0) /
                    totalPhases
                  : 0;

              return {
                projectId: project.id,
                projectName: project.name,
                projectNumber: project.number,
                phases,
                overallProgress,
              };
            } catch {
              return {
                projectId: project.id,
                projectName: project.name,
                projectNumber: project.number,
                phases: [],
                overallProgress: 0,
              };
            }
          })
        );

        setProjects(projectPhases.filter((p) => p.phases.length > 0));
      } catch {
        // Silently handle
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-36" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-2 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (projects.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-4 w-4 text-indigo-500" />
            Phase Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No active projects with phases yet. Add phases to your projects to
            track progress.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Layers className="h-4 w-4 text-indigo-500" />
          Phase Progress
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {projects.map((project) => (
          <Link
            key={project.projectId}
            href={`/projects/${project.projectId}`}
            className="block group"
          >
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-xs font-mono text-muted-foreground">
                    {project.projectNumber}
                  </span>
                  <span className="text-sm font-medium truncate group-hover:text-amber-500 transition-colors">
                    {project.projectName}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs font-semibold">
                    {Math.round(project.overallProgress)}%
                  </span>
                  <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
              <Progress value={project.overallProgress} className="h-2" />
              <div className="text-[10px] text-muted-foreground">
                {project.phases.length} phase{project.phases.length !== 1 ? "s" : ""} •{" "}
                {project.phases.filter((p) => p.percentComplete >= 100).length} completed
              </div>
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

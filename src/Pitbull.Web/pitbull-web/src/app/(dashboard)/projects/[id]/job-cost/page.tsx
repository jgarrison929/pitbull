"use client";

import { use } from "react";
import { ProjectModulePage } from "@/components/project-management/project-module-page";

export default function JobCostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <ProjectModulePage
      projectId={id}
      title="Job Cost"
      description="Budget, actuals, commitments, and forecast rollups."
      endpoint={`/api/projects/${id}/job-cost/budgets`}
    />
  );
}

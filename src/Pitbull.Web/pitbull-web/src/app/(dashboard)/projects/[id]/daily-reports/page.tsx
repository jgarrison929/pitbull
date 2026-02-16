"use client";

import { use } from "react";
import { ProjectModulePage } from "@/components/project-management/project-module-page";

export default function DailyReportsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <ProjectModulePage
      projectId={id}
      title="Daily Reports"
      description="Field reports, weather, crews, equipment, and safety logs."
      endpoint={`/api/projects/${id}/daily-reports`}
    />
  );
}

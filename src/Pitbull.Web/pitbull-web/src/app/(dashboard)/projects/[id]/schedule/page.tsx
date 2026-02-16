"use client";

import { use } from "react";
import { ProjectModulePage } from "@/components/project-management/project-module-page";

export default function SchedulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <ProjectModulePage
      projectId={id}
      title="Schedule"
      description="Project schedule, activities, dependencies, and baselines."
      endpoint={`/api/projects/${id}/schedules`}
    />
  );
}

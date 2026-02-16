"use client";

import { use } from "react";
import { ProjectModulePage } from "@/components/project-management/project-module-page";

export default function ProjectionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <ProjectModulePage
      projectId={id}
      title="Projections"
      description="Monthly revenue and cost projection management."
      endpoint={`/api/projects/${id}/monthly-projections`}
    />
  );
}

"use client";

import { use } from "react";
import { ProjectModulePage } from "@/components/project-management/project-module-page";

export default function ProgressPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <ProjectModulePage
      projectId={id}
      title="Progress"
      description="Progress entries, earned value, and S-curve tracking."
      endpoint={`/api/projects/${id}/progress-entries`}
    />
  );
}

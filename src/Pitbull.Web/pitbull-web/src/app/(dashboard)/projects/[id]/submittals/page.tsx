"use client";

import { use } from "react";
import { ProjectModulePage } from "@/components/project-management/project-module-page";

export default function SubmittalsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <ProjectModulePage
      projectId={id}
      title="Submittals"
      description="Submittal register, workflow, and attachments."
      endpoint={`/api/projects/${id}/submittals`}
    />
  );
}

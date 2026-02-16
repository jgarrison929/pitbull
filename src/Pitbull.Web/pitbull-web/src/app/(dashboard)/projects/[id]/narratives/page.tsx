"use client";

import { use } from "react";
import { ProjectModulePage } from "@/components/project-management/project-module-page";

export default function NarrativesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <ProjectModulePage
      projectId={id}
      title="Narratives"
      description="Monthly project narratives and revision history."
      endpoint={`/api/projects/${id}/narratives`}
    />
  );
}

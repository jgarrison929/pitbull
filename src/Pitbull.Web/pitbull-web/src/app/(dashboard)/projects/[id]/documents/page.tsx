"use client";

import { use } from "react";
import { ProjectModulePage } from "@/components/project-management/project-module-page";

export default function DocumentGenerationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <ProjectModulePage
      projectId={id}
      title="Document Generation"
      description="Templates and generated project documents."
      endpoint={`/api/projects/${id}/generated-documents`}
    />
  );
}

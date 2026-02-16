"use client";

import { use } from "react";
import { ProjectModulePage } from "@/components/project-management/project-module-page";

export default function CommunicationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <ProjectModulePage
      projectId={id}
      title="Communications"
      description="Incoming and outgoing project communications log."
      endpoint={`/api/projects/${id}/communications`}
    />
  );
}

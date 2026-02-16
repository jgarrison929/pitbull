"use client";

import { use } from "react";
import { ProjectModulePage } from "@/components/project-management/project-module-page";

export default function TasksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <ProjectModulePage
      projectId={id}
      title="Tasks"
      description="Project task assignments and comments."
      endpoint={`/api/projects/${id}/tasks`}
    />
  );
}

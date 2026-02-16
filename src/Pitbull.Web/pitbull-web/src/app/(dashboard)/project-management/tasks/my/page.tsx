"use client";

import { ProjectModulePage } from "@/components/project-management/project-module-page";

export default function MyTasksPage() {
  return (
    <ProjectModulePage
      projectId=""
      title="My Tasks"
      description="Open tasks across all projects assigned to me."
      endpoint="/api/project-management/tasks/my"
    />
  );
}

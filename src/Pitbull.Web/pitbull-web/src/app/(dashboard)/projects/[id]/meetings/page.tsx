"use client";

import { use } from "react";
import { ProjectModulePage } from "@/components/project-management/project-module-page";

export default function MeetingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <ProjectModulePage
      projectId={id}
      title="Meetings"
      description="Meeting series, agendas, minutes, and action items."
      endpoint={`/api/projects/${id}/meetings`}
    />
  );
}

"use client";

import { use } from "react";
import { ProjectModulePage } from "@/components/project-management/project-module-page";

export default function PlansSpecsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <ProjectModulePage
      projectId={id}
      title="Plans & Specs"
      description="Plan sets, sheets, spec sections, and distributions."
      endpoint={`/api/projects/${id}/plan-sets`}
    />
  );
}

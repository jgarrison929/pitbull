import { ProjectSubNav } from "@/components/projects/project-sub-nav";

/**
 * Shared project chrome: field-first mobile hub + searchable "More on this job".
 * Applies to overview, site walk, RFIs, and every other project submodule.
 */
export default async function ProjectIdLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="space-y-4">
      <ProjectSubNav projectId={id} />
      {children}
    </div>
  );
}

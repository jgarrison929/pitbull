/** Site walk analytics (2.14.9). viewport_class attached by captureProductEvent. */
export const SITE_WALK_STARTED_EVENT = "site_walk_started";

export function buildSiteWalkStartedProps(projectId: string) {
  return { project_id: projectId };
}

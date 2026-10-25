/**
 * Twin zone drill analytics (2.16.1) — diagnostic timing only.
 * viewport_class is injected by captureProductEvent.
 */

export const TWIN_ZONE_DRILL_EVENT = "twin_zone_drill";

export function buildTwinZoneDrillProps(opts: {
  projectId: string;
  spatialNodeId: string;
  /** Zone detail fetch duration in ms (diagnostic). */
  durationMs: number;
  /** Whether photo pins request completed with zero pins. */
  pinsEmpty?: boolean;
}): Record<string, string | number | boolean> {
  return {
    project_id: opts.projectId,
    spatial_node_id: opts.spatialNodeId,
    duration_ms: Math.max(0, Math.round(opts.durationMs)),
    pins_empty: opts.pinsEmpty ?? true,
  };
}

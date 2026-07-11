/** API shapes for zones-first digital twin (project-scoped spatial graph). */

export interface SpatialNodeDto {
  id: string;
  parentNodeId?: string | null;
  nodeType: string;
  code: string;
  name: string;
  sortOrder: number;
  levelIndex?: number | null;
  isActive: boolean;
  centroidX?: number | null;
  centroidY?: number | null;
  centroidZ?: number | null;
}

export interface SpatialGraphResponse {
  hasGraph: boolean;
  message?: string | null;
  graphId?: string | null;
  projectId?: string | null;
  graphName?: string | null;
  version?: number | null;
  status?: string | null;
  nodes: SpatialNodeDto[];
}

export interface SpatialOverlayNodeDto {
  spatialNodeId: string;
  band: string;
  label: string;
  source: string;
  isProxy: boolean;
  formula?: string | null;
  insufficientReason?: string | null;
}

export interface SpatialOverlayResponse {
  hasGraph: boolean;
  message?: string | null;
  mode: string;
  asOf: string;
  truthNote: string;
  nodes: SpatialOverlayNodeDto[];
}

export type OverlayMode = "progress" | "schedule" | "rfi";

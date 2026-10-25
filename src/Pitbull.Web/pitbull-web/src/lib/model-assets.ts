/**
 * Twin model assets client helpers (2.16.3 API / 2.16.4 admin UI).
 * IsReady only when conversion Succeeded — never while Pending/Processing.
 */

export interface ModelAssetDto {
  id: string;
  projectId: string;
  displayName: string;
  sourceFormat: string;
  conversionStatus: string;
  conversionError?: string | null;
  sourceBlobKey?: string | null;
  runtimeBlobKey?: string | null;
  licenseAttribution?: string | null;
  isActiveVersion: boolean;
  versionNumber: number;
  isReady: boolean;
}

export interface ModelAssetListResponse {
  projectId: string;
  message: string;
  assets: ModelAssetDto[];
}

export interface RegisterModelAssetRequest {
  displayName?: string;
  sourceFormat: string;
  sourceBlobKey?: string;
  licenseAttribution?: string;
}

export function buildModelAssetsUrl(projectId: string): string {
  return `/api/projects/${projectId}/spatial/model-assets`;
}

export function buildStartConversionUrl(
  projectId: string,
  modelAssetId: string
): string {
  return `/api/projects/${projectId}/spatial/model-assets/${modelAssetId}/start-conversion`;
}

export function buildSetActiveModelUrl(
  projectId: string,
  modelAssetId: string
): string {
  return `/api/projects/${projectId}/spatial/model-assets/${modelAssetId}/set-active`;
}

export function buildRetryConversionUrl(
  projectId: string,
  modelAssetId: string
): string {
  return `/api/projects/${projectId}/spatial/model-assets/${modelAssetId}/retry-conversion`;
}

export function buildFailConversionUrl(
  projectId: string,
  modelAssetId: string
): string {
  return `/api/projects/${projectId}/spatial/model-assets/${modelAssetId}/fail-conversion`;
}

/** Status badge copy — never "ready" for Pending/Processing. */
export function modelAssetStatusLabel(asset: ModelAssetDto): string {
  if (asset.isReady) return "Ready";
  const s = (asset.conversionStatus || "").toLowerCase();
  if (s === "processing") return "Processing…";
  if (s === "failed") return "Failed";
  if (s === "pending") return "Pending (not ready)";
  return asset.conversionStatus || "Unknown";
}

export function isModelAssetReady(asset: ModelAssetDto | null | undefined): boolean {
  return asset?.isReady === true;
}

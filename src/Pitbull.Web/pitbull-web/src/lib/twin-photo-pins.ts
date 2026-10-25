/**
 * Twin zone panel photo pins (2.15.3 API contract + 2.15.4 UI helpers).
 * Empty pins are neutral — never treat as "all clear" or invent green.
 */

export interface TwinPhotoPinDto {
  photoId: string;
  spatialNodeId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  thumbnailUrl?: string | null;
  capturedAt?: string | null;
  placementSource: string;
}

export interface TwinPhotoPinsResponse {
  projectId: string;
  spatialNodeId?: string | null;
  message: string;
  pins: TwinPhotoPinDto[];
}

/** Neutral empty copy for zone panel (not all-clear). */
export const TWIN_PHOTO_THUMBS_EMPTY =
  "No photos linked to this zone yet — empty is not all-clear.";

export function buildPhotoPinsUrl(
  projectId: string,
  spatialNodeId?: string | null
): string {
  const base = `/api/projects/${projectId}/spatial/photo-pins`;
  if (!spatialNodeId) return base;
  return `${base}?spatialNodeId=${encodeURIComponent(spatialNodeId)}`;
}

/** Pins with a displayable thumbnail URL only. */
export function pinsWithThumbnails(
  pins: TwinPhotoPinDto[] | null | undefined
): TwinPhotoPinDto[] {
  if (!pins?.length) return [];
  return pins.filter((p) => typeof p.thumbnailUrl === "string" && p.thumbnailUrl.trim().length > 0);
}

export function photoThumbsEmptyMessage(
  pins: TwinPhotoPinDto[] | null | undefined,
  apiMessage?: string | null
): string {
  if (pinsWithThumbnails(pins).length > 0) return "";
  const msg = (apiMessage ?? "").trim();
  if (msg) return msg;
  return TWIN_PHOTO_THUMBS_EMPTY;
}

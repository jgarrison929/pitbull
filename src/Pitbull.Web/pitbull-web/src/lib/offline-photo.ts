/**
 * Offline photo helpers — embed images on the daily report queue.
 * Large jobsite photos are downscaled when possible; still-too-large
 * photos are marked skipped (honest UI — never fake “all photos offline”).
 */

export const MAX_OFFLINE_PHOTO_BYTES = 1_200_000; // ~1.2MB each after prep
export const MAX_OFFLINE_PHOTOS = 10;
/** Longest edge after downscale (keeps jobsite stills readable). */
export const OFFLINE_PHOTO_MAX_EDGE = 1600;
export const OFFLINE_PHOTO_JPEG_QUALITY = 0.72;

export interface OfflinePhotoMeta {
  id: string;
  name: string;
  type: string;
  size: number;
  /** data URL (base64) when embeddable */
  dataUrl?: string;
  latitude?: number;
  longitude?: number;
  caption?: string;
  /** true when photo could not be embedded offline */
  skippedForSize?: boolean;
  /** true when we shrank the original to fit the offline budget */
  wasDownscaled?: boolean;
}

export type ImageDownscaler = (
  file: File,
  maxBytes: number
) => Promise<{ dataUrl: string; size: number; type: string } | null>;

let customDownscaler: ImageDownscaler | null = null;

/** Test hook — inject a downscaler without a real canvas. */
export function setOfflineImageDownscaler(fn: ImageDownscaler | null): void {
  customDownscaler = fn;
}

export function canEmbedOffline(size: number): boolean {
  return size > 0 && size <= MAX_OFFLINE_PHOTO_BYTES;
}

/**
 * Pure layout helper for downscale (unit-tested without canvas).
 */
export function computeDownscaleDimensions(
  width: number,
  height: number,
  maxEdge: number = OFFLINE_PHOTO_MAX_EDGE
): { width: number; height: number; scale: number } {
  if (width <= 0 || height <= 0) {
    return { width: 0, height: 0, scale: 0 };
  }
  const longest = Math.max(width, height);
  if (longest <= maxEdge) {
    return { width, height, scale: 1 };
  }
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scale,
  };
}

/**
 * Read a File into a data URL. Rejects on read error.
 */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Could not read file"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("FileReader failed"));
    reader.readAsDataURL(file);
  });
}

async function defaultBrowserDownscaler(
  file: File,
  maxBytes: number
): Promise<{ dataUrl: string; size: number; type: string } | null> {
  if (typeof document === "undefined") return null;
  if (!file.type.startsWith("image/") && !/\.(jpe?g|png|webp|heic)$/i.test(file.name)) {
    return null;
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("image load failed"));
      el.src = objectUrl;
    });

    const { width, height } = computeDownscaleDimensions(
      img.naturalWidth || img.width,
      img.naturalHeight || img.height
    );
    if (width <= 0 || height <= 0) return null;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, width, height);

    let quality = OFFLINE_PHOTO_JPEG_QUALITY;
    let dataUrl = canvas.toDataURL("image/jpeg", quality);
    // Tighten quality if still over budget
    while (dataUrlApproximateBytes(dataUrl) > maxBytes && quality > 0.4) {
      quality -= 0.08;
      dataUrl = canvas.toDataURL("image/jpeg", quality);
    }
    const size = dataUrlApproximateBytes(dataUrl);
    if (size > maxBytes) return null;
    return { dataUrl, size, type: "image/jpeg" };
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** Approximate binary size from a base64 data URL. */
export function dataUrlApproximateBytes(dataUrl: string): number {
  const i = dataUrl.indexOf(",");
  const b64 = i >= 0 ? dataUrl.slice(i + 1) : dataUrl;
  // 4 base64 chars → 3 bytes; ignore padding for upper bound
  return Math.floor((b64.length * 3) / 4);
}

/**
 * Prepare one file for offline embed: pass-through if small, else downscale.
 */
export async function prepareFileForOfflineEmbed(
  file: File
): Promise<{
  dataUrl?: string;
  size: number;
  type: string;
  wasDownscaled: boolean;
  skippedForSize: boolean;
}> {
  const type = file.type || "image/jpeg";
  if (canEmbedOffline(file.size)) {
    try {
      const dataUrl = await fileToDataUrl(file);
      return {
        dataUrl,
        size: file.size,
        type,
        wasDownscaled: false,
        skippedForSize: false,
      };
    } catch {
      return { size: file.size, type, wasDownscaled: false, skippedForSize: true };
    }
  }

  const scaler = customDownscaler ?? defaultBrowserDownscaler;
  try {
    const result = await scaler(file, MAX_OFFLINE_PHOTO_BYTES);
    if (result && canEmbedOffline(result.size)) {
      return {
        dataUrl: result.dataUrl,
        size: result.size,
        type: result.type || "image/jpeg",
        wasDownscaled: true,
        skippedForSize: false,
      };
    }
  } catch {
    /* fall through to skip */
  }

  return {
    size: file.size,
    type,
    wasDownscaled: false,
    skippedForSize: true,
  };
}

/**
 * Build offline photo list from UI file items (max count; downscale when needed).
 */
export async function buildOfflinePhotos(
  items: Array<{
    id: string;
    name: string;
    type?: string;
    size?: number;
    file?: File;
    latitude?: number;
    longitude?: number;
    caption?: string;
  }>
): Promise<OfflinePhotoMeta[]> {
  const slice = items.slice(0, MAX_OFFLINE_PHOTOS);
  const out: OfflinePhotoMeta[] = [];

  for (const item of slice) {
    const size = item.file?.size ?? item.size ?? 0;
    const type = item.file?.type || item.type || "image/jpeg";
    const base: OfflinePhotoMeta = {
      id: item.id,
      name: item.name || item.file?.name || "photo.jpg",
      type,
      size,
      latitude: item.latitude,
      longitude: item.longitude,
      caption: item.caption,
    };

    if (!item.file) {
      out.push({ ...base, skippedForSize: true });
      continue;
    }

    const prepared = await prepareFileForOfflineEmbed(item.file);
    if (prepared.skippedForSize || !prepared.dataUrl) {
      out.push({
        ...base,
        size: prepared.size || size,
        type: prepared.type || type,
        skippedForSize: true,
        wasDownscaled: prepared.wasDownscaled,
      });
      continue;
    }

    out.push({
      ...base,
      size: prepared.size,
      type: prepared.type,
      dataUrl: prepared.dataUrl,
      wasDownscaled: prepared.wasDownscaled,
      skippedForSize: false,
    });
  }

  return out;
}

/**
 * Convert data URL back to a Blob for upload on sync.
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(",");
  if (!data) throw new Error("Invalid data URL");
  const mimeMatch = /data:([^;]+)/.exec(header ?? "");
  const mime = mimeMatch?.[1] ?? "image/jpeg";
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

export function countEmbeddedPhotos(photos: OfflinePhotoMeta[]): number {
  return photos.filter((p) => !!p.dataUrl).length;
}

export function countSkippedPhotos(photos: OfflinePhotoMeta[]): number {
  return photos.filter((p) => p.skippedForSize).length;
}

/** Honest field-report copy for offline photo outcomes. */
export function formatOfflinePhotoStatusCopy(photos: OfflinePhotoMeta[]): string {
  const embedded = countEmbeddedPhotos(photos);
  const skipped = countSkippedPhotos(photos);
  const downscaled = photos.filter((p) => p.wasDownscaled && p.dataUrl).length;
  const parts: string[] = [];
  if (embedded > 0) {
    parts.push(`${embedded} photo(s) queued offline`);
    if (downscaled > 0) parts.push(`${downscaled} downscaled to fit`);
  }
  if (skipped > 0) {
    parts.push(
      `${skipped} skipped (still too large — retake smaller or upload when online)`
    );
  }
  if (parts.length === 0) return "No photos queued offline";
  return parts.join(" · ");
}

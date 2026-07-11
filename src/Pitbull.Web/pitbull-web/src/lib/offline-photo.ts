/**
 * Offline photo helpers — store small images as data URLs with the daily report queue.
 * Large files are skipped (truth: we do not claim full offline media for every camera).
 */

export const MAX_OFFLINE_PHOTO_BYTES = 1_200_000; // ~1.2MB each
export const MAX_OFFLINE_PHOTOS = 5;

export interface OfflinePhotoMeta {
  id: string;
  name: string;
  type: string;
  size: number;
  /** data URL (base64) when small enough to queue */
  dataUrl?: string;
  latitude?: number;
  longitude?: number;
  caption?: string;
  /** true when photo was too large to embed offline */
  skippedForSize?: boolean;
}

export function canEmbedOffline(size: number): boolean {
  return size > 0 && size <= MAX_OFFLINE_PHOTO_BYTES;
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

/**
 * Build offline photo list from UI file items (max count; embed when small).
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

    if (!canEmbedOffline(size)) {
      out.push({ ...base, skippedForSize: true });
      continue;
    }

    try {
      const dataUrl = await fileToDataUrl(item.file);
      out.push({ ...base, dataUrl });
    } catch {
      out.push({ ...base, skippedForSize: true });
    }
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

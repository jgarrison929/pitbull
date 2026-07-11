import { describe, expect, it } from "vitest";
import {
  canEmbedOffline,
  countEmbeddedPhotos,
  dataUrlToBlob,
  MAX_OFFLINE_PHOTO_BYTES,
  type OfflinePhotoMeta,
} from "./offline-photo";

describe("canEmbedOffline", () => {
  it("allows small images and rejects oversized", () => {
    expect(canEmbedOffline(1000)).toBe(true);
    expect(canEmbedOffline(MAX_OFFLINE_PHOTO_BYTES)).toBe(true);
    expect(canEmbedOffline(MAX_OFFLINE_PHOTO_BYTES + 1)).toBe(false);
    expect(canEmbedOffline(0)).toBe(false);
  });
});

describe("dataUrlToBlob", () => {
  it("round-trips a tiny data URL used on sync upload", () => {
    // 1x1 png
    const dataUrl =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const blob = dataUrlToBlob(dataUrl);
    expect(blob.type).toBe("image/png");
    expect(blob.size).toBeGreaterThan(0);
  });
});

describe("countEmbeddedPhotos", () => {
  it("counts only photos with dataUrl", () => {
    const photos: OfflinePhotoMeta[] = [
      { id: "1", name: "a.jpg", type: "image/jpeg", size: 10, dataUrl: "data:..." },
      { id: "2", name: "b.jpg", type: "image/jpeg", size: 9_000_000, skippedForSize: true },
    ];
    expect(countEmbeddedPhotos(photos)).toBe(1);
  });
});

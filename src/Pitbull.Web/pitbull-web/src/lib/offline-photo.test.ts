import { afterEach, describe, expect, it } from "vitest";
import {
  buildOfflinePhotos,
  canEmbedOffline,
  computeDownscaleDimensions,
  countEmbeddedPhotos,
  countSkippedPhotos,
  dataUrlApproximateBytes,
  dataUrlToBlob,
  formatOfflinePhotoStatusCopy,
  MAX_OFFLINE_PHOTO_BYTES,
  MAX_OFFLINE_PHOTOS,
  prepareFileForOfflineEmbed,
  setOfflineImageDownscaler,
} from "./offline-photo";

afterEach(() => {
  setOfflineImageDownscaler(null);
});

describe("canEmbedOffline", () => {
  it("allows small images and rejects oversized", () => {
    expect(canEmbedOffline(1000)).toBe(true);
    expect(canEmbedOffline(MAX_OFFLINE_PHOTO_BYTES)).toBe(true);
    expect(canEmbedOffline(MAX_OFFLINE_PHOTO_BYTES + 1)).toBe(false);
    expect(canEmbedOffline(0)).toBe(false);
  });
});

describe("computeDownscaleDimensions", () => {
  it("shrinks long edge to max while preserving aspect", () => {
    const d = computeDownscaleDimensions(4000, 3000, 1600);
    expect(d.width).toBe(1600);
    expect(d.height).toBe(1200);
    expect(d.scale).toBeCloseTo(0.4);
  });

  it("leaves small images unchanged", () => {
    const d = computeDownscaleDimensions(800, 600, 1600);
    expect(d).toEqual({ width: 800, height: 600, scale: 1 });
  });
});

describe("dataUrlToBlob", () => {
  it("round-trips a tiny data URL used on sync upload", () => {
    const dataUrl =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const blob = dataUrlToBlob(dataUrl);
    expect(blob.type).toBe("image/png");
    expect(blob.size).toBeGreaterThan(0);
  });
});

describe("prepareFileForOfflineEmbed + buildOfflinePhotos (downscale path)", () => {
  it("downscales oversized files via injected downscaler so they queue", async () => {
    const tinyDataUrl =
      "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGcP//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//Z";
    const embeddedSize = dataUrlApproximateBytes(tinyDataUrl);
    expect(embeddedSize).toBeLessThan(MAX_OFFLINE_PHOTO_BYTES);

    setOfflineImageDownscaler(async () => ({
      dataUrl: tinyDataUrl,
      size: embeddedSize,
      type: "image/jpeg",
    }));

    // Synthetic oversized File (content irrelevant — downscaler is injected)
    const big = new File([new Uint8Array(MAX_OFFLINE_PHOTO_BYTES + 50_000)], "site.jpg", {
      type: "image/jpeg",
    });
    expect(canEmbedOffline(big.size)).toBe(false);

    const prepared = await prepareFileForOfflineEmbed(big);
    expect(prepared.skippedForSize).toBe(false);
    expect(prepared.wasDownscaled).toBe(true);
    expect(prepared.dataUrl).toBeTruthy();
    expect(canEmbedOffline(prepared.size)).toBe(true);

    const list = await buildOfflinePhotos([
      { id: "p1", name: "site.jpg", file: big },
    ]);
    expect(countEmbeddedPhotos(list)).toBe(1);
    expect(countSkippedPhotos(list)).toBe(0);
    expect(list[0]?.wasDownscaled).toBe(true);
    expect(formatOfflinePhotoStatusCopy(list)).toMatch(/queued offline/i);
    expect(formatOfflinePhotoStatusCopy(list)).toMatch(/downscaled/i);
  });

  it("marks skipped when downscaler cannot fit", async () => {
    setOfflineImageDownscaler(async () => null);
    const big = new File([new Uint8Array(MAX_OFFLINE_PHOTO_BYTES + 10_000)], "huge.jpg", {
      type: "image/jpeg",
    });
    const list = await buildOfflinePhotos([{ id: "p2", name: "huge.jpg", file: big }]);
    expect(countEmbeddedPhotos(list)).toBe(0);
    expect(countSkippedPhotos(list)).toBe(1);
    expect(formatOfflinePhotoStatusCopy(list)).toMatch(/skipped/i);
  });

  it("caps photo count at MAX_OFFLINE_PHOTOS", async () => {
    const files = Array.from({ length: MAX_OFFLINE_PHOTOS + 3 }, (_, i) => {
      const f = new File([new Uint8Array(100)], `p${i}.jpg`, { type: "image/jpeg" });
      return { id: `id-${i}`, name: `p${i}.jpg`, file: f };
    });
    const list = await buildOfflinePhotos(files);
    expect(list.length).toBe(MAX_OFFLINE_PHOTOS);
  });
});

describe("countEmbeddedPhotos", () => {
  it("counts only photos with dataUrl", () => {
    expect(
      countEmbeddedPhotos([
        { id: "1", name: "a.jpg", type: "image/jpeg", size: 10, dataUrl: "data:..." },
        {
          id: "2",
          name: "b.jpg",
          type: "image/jpeg",
          size: 9_000_000,
          skippedForSize: true,
        },
      ])
    ).toBe(1);
  });
});

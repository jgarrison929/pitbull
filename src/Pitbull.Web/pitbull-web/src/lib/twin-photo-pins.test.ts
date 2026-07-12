import { describe, expect, it } from "vitest";
import {
  TWIN_PHOTO_THUMBS_EMPTY,
  buildPhotoPinsUrl,
  photoThumbsEmptyMessage,
  pinsWithThumbnails,
  type TwinPhotoPinDto,
} from "./twin-photo-pins";

const basePin = (over: Partial<TwinPhotoPinDto> = {}): TwinPhotoPinDto => ({
  photoId: "p1",
  placementSource: "zone",
  ...over,
});

describe("twin-photo-pins", () => {
  it("builds photo-pins URL with optional zone filter", () => {
    expect(buildPhotoPinsUrl("proj-1")).toBe(
      "/api/projects/proj-1/spatial/photo-pins"
    );
    expect(buildPhotoPinsUrl("proj-1", "zone-a")).toBe(
      "/api/projects/proj-1/spatial/photo-pins?spatialNodeId=zone-a"
    );
  });

  it("pinsWithThumbnails skips missing or blank URLs", () => {
    expect(pinsWithThumbnails(null)).toEqual([]);
    expect(
      pinsWithThumbnails([
        basePin({ photoId: "a", thumbnailUrl: null }),
        basePin({ photoId: "b", thumbnailUrl: "  " }),
        basePin({ photoId: "c", thumbnailUrl: "/thumbs/c.jpg" }),
      ])
    ).toEqual([basePin({ photoId: "c", thumbnailUrl: "/thumbs/c.jpg" })]);
  });

  it("empty message is neutral, never all-clear", () => {
    expect(photoThumbsEmptyMessage([])).toBe(TWIN_PHOTO_THUMBS_EMPTY);
    expect(photoThumbsEmptyMessage([], "No photo pins yet")).toBe(
      "No photo pins yet"
    );
    // Must deny "all clear", not claim it
    expect(photoThumbsEmptyMessage([])).toMatch(/not all-clear/i);
    expect(photoThumbsEmptyMessage([])).not.toMatch(/all green|everything is clear/i);
    expect(
      photoThumbsEmptyMessage([
        basePin({ thumbnailUrl: "https://x/t.jpg" }),
      ])
    ).toBe("");
  });
});

import { describe, expect, it } from "vitest";
import {
  buildModelAssetsUrl,
  isModelAssetReady,
  modelAssetStatusLabel,
  type ModelAssetDto,
} from "./model-assets";

const base = (over: Partial<ModelAssetDto> = {}): ModelAssetDto => ({
  id: "a1",
  projectId: "p1",
  displayName: "Primary",
  sourceFormat: "Gltf",
  conversionStatus: "Pending",
  isActiveVersion: false,
  versionNumber: 1,
  isReady: false,
  ...over,
});

describe("model-assets (2.16.4)", () => {
  it("builds model-assets URL", () => {
    expect(buildModelAssetsUrl("proj")).toBe(
      "/api/projects/proj/spatial/model-assets"
    );
  });

  it("never labels pending/processing as Ready", () => {
    expect(modelAssetStatusLabel(base({ conversionStatus: "Pending", isReady: false }))).toMatch(
      /Pending|not ready/i
    );
    expect(modelAssetStatusLabel(base({ conversionStatus: "Processing", isReady: false }))).toMatch(
      /Processing/i
    );
    expect(
      modelAssetStatusLabel(base({ conversionStatus: "Succeeded", isReady: true }))
    ).toBe("Ready");
  });

  it("isModelAssetReady only when isReady true", () => {
    expect(isModelAssetReady(base({ isReady: false }))).toBe(false);
    expect(isModelAssetReady(base({ isReady: true, conversionStatus: "Succeeded" }))).toBe(
      true
    );
  });
});

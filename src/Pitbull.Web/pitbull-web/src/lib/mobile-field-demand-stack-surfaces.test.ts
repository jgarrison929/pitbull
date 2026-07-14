/**
 * Structural proof for docs/roadmap/mobile-field-demand-stack-and-version-plan.md
 * — asserts cited field surfaces and documented offline limits still match shipped code.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  canEmbedOffline,
  MAX_OFFLINE_PHOTO_BYTES,
  MAX_OFFLINE_PHOTOS,
} from "./offline-photo";
import { isPlanSetsMetadataUrl } from "./plan-metadata-cache";

const webRoot = path.resolve(__dirname, "../..");

function webPath(...parts: string[]) {
  return path.join(webRoot, ...parts);
}

describe("mobile field demand stack — surface files exist", () => {
  const surfaces: { label: string; rel: string }[] = [
    { label: "field report", rel: "src/app/(dashboard)/daily-reports/mobile/page.tsx" },
    { label: "bottom nav", rel: "src/components/layout/mobile-bottom-nav.tsx" },
    { label: "service worker", rel: "public/sw.js" },
    { label: "offline store", rel: "src/lib/offline-store.ts" },
    { label: "daily report offline", rel: "src/lib/daily-report-offline.ts" },
    { label: "offline photo", rel: "src/lib/offline-photo.ts" },
    { label: "plan metadata cache", rel: "src/lib/plan-metadata-cache.ts" },
    { label: "plans-specs", rel: "src/app/(dashboard)/projects/[id]/plans-specs/page.tsx" },
    { label: "site-walk", rel: "src/app/(dashboard)/projects/[id]/site-walk/page.tsx" },
    { label: "schedule", rel: "src/app/(dashboard)/projects/[id]/schedule/page.tsx" },
    { label: "twin", rel: "src/app/(dashboard)/projects/[id]/twin/page.tsx" },
    { label: "help", rel: "src/app/(dashboard)/help/page.tsx" },
  ];

  it.each(surfaces)("$label exists at $rel", ({ rel }) => {
    expect(existsSync(webPath(rel)), `missing surface: ${rel}`).toBe(true);
  });
});

describe("mobile field demand stack — offline limits (G1/G2 evidence)", () => {
  it("embeds only small photos under documented caps (partial offline capture)", () => {
    expect(MAX_OFFLINE_PHOTO_BYTES).toBe(1_200_000);
    expect(MAX_OFFLINE_PHOTOS).toBe(10);
    expect(canEmbedOffline(1_200_000)).toBe(true);
    expect(canEmbedOffline(1_200_001)).toBe(false);
  });

  it("plan-sets cache helper targets metadata URLs only (not PDF binary paths)", () => {
    expect(isPlanSetsMetadataUrl("/api/projects/x/plan-sets?page=1")).toBe(true);
    expect(isPlanSetsMetadataUrl("/api/projects/x/plan-sets/abc/download")).toBe(false);
    expect(isPlanSetsMetadataUrl("/api/projects/x/documents/file.pdf")).toBe(false);
  });
});

describe("mobile field demand stack — roadmap artifact", () => {
  it("analysis + version plan doc exists under docs/roadmap", () => {
    const repoRoot = path.resolve(webRoot, "../../..");
    const doc = path.join(
      repoRoot,
      "docs/roadmap/mobile-field-demand-stack-and-version-plan.md"
    );
    expect(existsSync(doc), `missing planning doc: ${doc}`).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import {
  featurePrTouchesOwnedPaths,
  ownedPathBypassAllowed,
  touchesBuilderForbidden,
} from "./owned-paths";

describe("owned paths — verify-v5 / proxy.ts", () => {
  it("must-fail: feature PR that also edits verify-v5", () => {
    const paths = [
      "v5/src/server/cost-item-page.ts",
      ".cursor/skills/verify-v5/verify.mjs",
    ];
    expect(touchesBuilderForbidden(paths).length).toBeGreaterThan(0);
    expect(featurePrTouchesOwnedPaths(paths)).toBe(true);
  });

  it("must-fail: feature PR that also edits src/proxy.ts", () => {
    const paths = [
      "v5/src/components/app/page.tsx",
      "v5/src/proxy.ts",
    ];
    expect(featurePrTouchesOwnedPaths(paths)).toBe(true);
  });

  it("allows a verify-v5-only change set", () => {
    const paths = [
      ".cursor/skills/verify-v5/verify.mjs",
      ".cursor/skills/verify-v5/checks.mjs",
    ];
    expect(featurePrTouchesOwnedPaths(paths)).toBe(false);
  });

  it("allows product work that leaves owned paths alone", () => {
    const paths = [
      "v5/src/server/cost-item-page.ts",
      "v5/src/lib/agent-guards/paths.ts",
    ];
    expect(featurePrTouchesOwnedPaths(paths)).toBe(false);
  });

  it("bypass is PR title or label — not commit subject", () => {
    expect(
      ownedPathBypassAllowed({ prTitle: "[owned-path-ok] sync verify skill" }),
    ).toBe(true);
    expect(
      ownedPathBypassAllowed({ labels: ["owned-path-ok", "ready"] }),
    ).toBe(true);
    expect(ownedPathBypassAllowed({ prTitle: "feat: sync verify" })).toBe(
      false,
    );
    // Commit subjects must not grant bypass (past mistake on #731).
    expect(
      ownedPathBypassAllowed({
        prTitle: "feat: sync",
        labels: [],
      }),
    ).toBe(false);
  });
});

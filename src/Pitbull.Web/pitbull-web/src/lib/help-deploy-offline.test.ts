import { describe, it, expect } from "vitest";
import { HELP_DEPLOY_OFFLINE_CARDS, helpDeployOfflineCardIds } from "./help-deploy-offline";

describe("help-deploy-offline (3.2.7)", () => {
  it("includes deploy refresh and pin queue cards", () => {
    const ids = helpDeployOfflineCardIds();
    expect(ids).toContain("deploy-refresh");
    expect(ids).toContain("offline-pin-queue");
    expect(HELP_DEPLOY_OFFLINE_CARDS.every((c) => c.steps.length >= 2)).toBe(true);
  });
});

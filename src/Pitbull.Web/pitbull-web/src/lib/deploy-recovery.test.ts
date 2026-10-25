import { describe, it, expect } from "vitest";
import {
  isDeployStaleClientError,
  deployRecoveryCopy,
  DEPLOY_RECOVERY_MESSAGE,
} from "./deploy-recovery";

describe("deploy-recovery (3.2.3)", () => {
  it("detects Failed to find Server Action", () => {
    expect(isDeployStaleClientError("Failed to find Server Action for id xyz")).toBe(true);
  });

  it("detects ChunkLoadError", () => {
    expect(isDeployStaleClientError("ChunkLoadError: Loading chunk 5 failed")).toBe(true);
  });

  it("ignores normal api errors", () => {
    expect(isDeployStaleClientError("Request failed with status 500")).toBe(false);
    expect(deployRecoveryCopy("validation failed")).toBeNull();
  });

  it("returns honest refresh copy", () => {
    expect(deployRecoveryCopy("Failed to find Server Action")).toBe(DEPLOY_RECOVERY_MESSAGE);
  });
});

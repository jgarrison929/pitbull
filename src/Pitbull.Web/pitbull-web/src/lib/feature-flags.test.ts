import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { isDigitalTwinEnabled } from "./feature-flags";

describe("isDigitalTwinEnabled", () => {
  const key = "NEXT_PUBLIC_FEATURE_DIGITAL_TWIN";
  let prev: string | undefined;

  beforeEach(() => {
    prev = process.env[key];
  });

  afterEach(() => {
    if (prev === undefined) delete process.env[key];
    else process.env[key] = prev;
  });

  it("defaults on when unset", () => {
    delete process.env[key];
    expect(isDigitalTwinEnabled()).toBe(true);
  });

  it("can be turned off", () => {
    process.env[key] = "false";
    expect(isDigitalTwinEnabled()).toBe(false);
    process.env[key] = "0";
    expect(isDigitalTwinEnabled()).toBe(false);
  });

  it("stays on for true/empty", () => {
    process.env[key] = "true";
    expect(isDigitalTwinEnabled()).toBe(true);
  });
});

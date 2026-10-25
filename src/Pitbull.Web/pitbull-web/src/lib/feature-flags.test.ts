import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { isDigitalTwinEnabled, isFieldLlmEodEnabled } from "./feature-flags";

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

  it("defaults on when unset (prod default documented 2.17.1)", () => {
    delete process.env[key];
    expect(isDigitalTwinEnabled()).toBe(true);
    // empty string also means default ON
    process.env[key] = "";
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

describe("isFieldLlmEodEnabled (2.20.1)", () => {
  const key = "NEXT_PUBLIC_FEATURE_FIELD_LLM_EOD";
  let prev: string | undefined;

  beforeEach(() => {
    prev = process.env[key];
  });

  afterEach(() => {
    if (prev === undefined) delete process.env[key];
    else process.env[key] = prev;
  });

  it("defaults OFF when unset (prod default)", () => {
    delete process.env[key];
    expect(isFieldLlmEodEnabled()).toBe(false);
    process.env[key] = "";
    expect(isFieldLlmEodEnabled()).toBe(false);
  });

  it("enables only for explicit true values", () => {
    process.env[key] = "true";
    expect(isFieldLlmEodEnabled()).toBe(true);
    process.env[key] = "1";
    expect(isFieldLlmEodEnabled()).toBe(true);
    process.env[key] = "false";
    expect(isFieldLlmEodEnabled()).toBe(false);
  });
});

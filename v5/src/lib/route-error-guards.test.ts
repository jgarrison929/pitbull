import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  rendersRawErrorMessage,
  retryWired,
} from "@/lib/route-error-guards";

describe("route error recovery guards", () => {
  it("live fallback wires Try again to retry() and hides raw errors", () => {
    const fallback = readFileSync(
      join(process.cwd(), "src/components/app/route-error-fallback.tsx"),
      "utf8",
    );
    expect(retryWired(fallback)).toBe(true);
    expect(rendersRawErrorMessage(fallback)).toBe(false);
  });

  it("must-fail: a no-op Try again would fail the wiring check", () => {
    expect(retryWired(`onClick={() => {}}`)).toBe(false);
    expect(retryWired(`onClick={() => reset()}`)).toBe(false);
  });

  it("must-fail: rendering error.message or Error id would be caught", () => {
    expect(rendersRawErrorMessage(`<p>{error.message}</p>`)).toBe(true);
    expect(rendersRawErrorMessage(`<p>Error id {digest}</p>`)).toBe(true);
    expect(rendersRawErrorMessage(`<p>{String(error)}</p>`)).toBe(true);
  });
});

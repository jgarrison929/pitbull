import { describe, expect, it } from "vitest";
import { actions, WRITES } from "@/server/assistant/actions";
import { WRITE_ACTIONS } from "@/server/job-changes";

describe("job change feed WRITE_ACTIONS", () => {
  it("must match actions with writes: true (cannot drift from the table)", () => {
    const derived = (Object.keys(actions) as (keyof typeof actions)[])
      .filter((name) => actions[name].writes)
      .slice()
      .sort();
    expect([...WRITE_ACTIONS].sort()).toEqual(derived);
    expect([...WRITES].sort()).toEqual(derived);
  });
});

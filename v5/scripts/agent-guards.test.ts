import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ALLOWED_COAUTHOR,
  commitMessageFailures,
  harnessTimeoutFailures,
  journalPinFailures,
  proveFixtures,
  proveHistorical,
  scanTree,
  snapshotConflictFailures,
} from "./agent-guards.mjs";

describe("agent guards", () => {
  it("rejects the saved past mistakes and accepts the fixed twins", () => {
    const proof = proveFixtures();
    expect(proof.problems, proof.problems.join("\n")).toEqual([]);
    expect(proof.notes.length).toBeGreaterThan(0);
  });

  it("rejects the same mistakes when the git objects are in this clone", () => {
    const proof = proveHistorical();
    expect(proof.problems, proof.problems.join("\n")).toEqual([]);
  });

  it("the working tree has no journal pin and no silent harness timeout", () => {
    expect(scanTree()).toEqual([]);
  });

  it("allows the noreply co-author and a message with no trailer", () => {
    expect(
      commitMessageFailures(
        `Co-authored-by: jgarrison929 <${ALLOWED_COAUTHOR}>\n`,
      ),
    ).toEqual([]);
    expect(commitMessageFailures("Keep the spine closed.\n")).toEqual([]);
  });

  it("the 0020 claim file and the current viewport helper are clean", () => {
    const journal = readFileSync(
      join(process.cwd(), "src/db/0020_schedule_activities.test.ts"),
      "utf8",
    );
    expect(journalPinFailures(journal, "v5/src/db/0020_schedule_activities.test.ts")).toEqual([]);
    const visual = readFileSync(
      join(process.cwd(), "tests/e2e/visual.spec.ts"),
      "utf8",
    );
    expect(harnessTimeoutFailures(visual, "v5/tests/e2e/visual.spec.ts")).toEqual([]);
  });

  it("a clean merge-tree oid is not a snapshot conflict", () => {
    expect(snapshotConflictFailures("abcdef\n")).toEqual([]);
  });
});

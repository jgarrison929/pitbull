/**
 * Part E (5.0.3) unknown-job refusal — acceptance checks + must-fail twins.
 */
import { describe, expect, it } from "vitest";
import {
  formatUnknownJobRefusal,
  pickUnknownJobChoices,
} from "./unknown-job";

const DEMO = [
  { job: { number: "25-031", estimateStatus: "approved" } },
  { job: { number: "26-010", estimateStatus: "draft" } },
  { job: { number: "24-118", estimateStatus: "approved" } },
  { job: { number: "24-077", estimateStatus: "approved" } },
];

describe("Part E unknown-job refusal", () => {
  it("acceptance: three approved demo jobs, ascending, draft excluded", () => {
    const choices = pickUnknownJobChoices(DEMO);
    expect(choices).toEqual(["24-077", "24-118", "25-031"]);
    expect(
      formatUnknownJobRefusal("99-999", choices),
    ).toBe("There is no job 99-999. Try 24-077, 24-118, or 25-031");
  });

  it("acceptance: two choices use or", () => {
    expect(
      formatUnknownJobRefusal("99-999", ["24-077", "25-031"]),
    ).toBe("There is no job 99-999. Try 24-077 or 25-031");
  });

  it("acceptance: one choice", () => {
    expect(formatUnknownJobRefusal("99-999", ["25-031"])).toBe(
      "There is no job 99-999. Try 25-031",
    );
  });

  it("acceptance: zero choices names only the missing number", () => {
    expect(formatUnknownJobRefusal("99-999", [])).toBe(
      "There is no job 99-999.",
    );
    expect(pickUnknownJobChoices([])).toEqual([]);
    expect(
      pickUnknownJobChoices([
        { job: { number: "26-010", estimateStatus: "draft" } },
      ]),
    ).toEqual([]);
  });

  it("must-fail: old sandbox Jobs-here wording", () => {
    const got = formatUnknownJobRefusal("99-999", [
      "24-077",
      "24-118",
      "25-031",
    ]);
    expect(got).not.toContain("in this sandbox");
    expect(got).not.toContain("Jobs here");
    expect(got).not.toBe(
      "There is no job 99-999 in this sandbox. Jobs here: 24-077, 24-118, 25-031, 26-010.",
    );
  });

  it("must-fail: draft 26-010 never offered", () => {
    const choices = pickUnknownJobChoices(DEMO);
    expect(choices).not.toContain("26-010");
    expect(
      formatUnknownJobRefusal("99-999", choices),
    ).not.toContain("26-010");
  });

  it("must-fail: more than 3 choices", () => {
    const four = [
      ...DEMO,
      { job: { number: "27-001", estimateStatus: "approved" } },
    ];
    const choices = pickUnknownJobChoices(four);
    expect(choices).toHaveLength(3);
    expect(choices).toEqual(["24-077", "24-118", "25-031"]);
    expect(formatUnknownJobRefusal("99-999", choices)).not.toContain("27-001");
  });

  it("must-fail: non-ascending order", () => {
    const choices = pickUnknownJobChoices(DEMO);
    expect(choices).not.toEqual(["25-031", "24-118", "24-077"]);
    expect(choices).toEqual([...choices].sort());
  });

  it("must-fail: wrong joiner for two or three", () => {
    expect(
      formatUnknownJobRefusal("99-999", ["24-077", "25-031"]),
    ).not.toBe("There is no job 99-999. Try 24-077, 25-031");
    expect(
      formatUnknownJobRefusal("99-999", ["24-077", "24-118", "25-031"]),
    ).not.toBe("There is no job 99-999. Try 24-077, 24-118 or 25-031");
  });
});

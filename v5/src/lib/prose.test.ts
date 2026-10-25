import { describe, expect, it } from "vitest";
import { pluralCount, sentence } from "./prose";

describe("pluralCount", () => {
  it("singular for 1, plural for 2 (regular +s)", () => {
    expect(pluralCount(1, "worker")).toBe("1 worker");
    expect(pluralCount(2, "worker")).toBe("2 workers");
    expect(pluralCount(1, "cost code")).toBe("1 cost code");
    expect(pluralCount(2, "cost code")).toBe("2 cost codes");
  });

  it("accepts an irregular plural form", () => {
    expect(pluralCount(1, "activity", "activities")).toBe("1 activity");
    expect(pluralCount(2, "activity", "activities")).toBe("2 activities");
    expect(pluralCount(1, "leaf", "leaves")).toBe("1 leaf");
    expect(pluralCount(2, "leaf", "leaves")).toBe("2 leaves");
  });
});

describe("honesty: summary punctuation", () => {
  it("does not produce concrete.\". when a note already ends with a period", () => {
    // Bug: note "Forms checked — ready for concrete." + trailing summary "." → concrete.".
    const text = sentence("Changed 04-210 Pour Pier 3 column, lift 2 on Bridge Crew 2's plan: ", [
      'note "Forms checked — ready for concrete."',
    ]);
    expect(text).not.toMatch(/\."\./);
    expect(text).toBe(
      'Changed 04-210 Pour Pier 3 column, lift 2 on Bridge Crew 2\'s plan: note "Forms checked — ready for concrete."',
    );
  });
});

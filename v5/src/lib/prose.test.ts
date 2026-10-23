import { describe, expect, it } from "vitest";
import { sentence } from "./prose";

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

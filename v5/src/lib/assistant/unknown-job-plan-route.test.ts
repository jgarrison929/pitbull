/**
 * Verify FAIL (b): Plan today/tomorrow on 99-999 must not chip
 * "Couldn't show crew plan". Routing is role-agnostic; label coverage × roles.
 */
import { describe, expect, it } from "vitest";
import { actionRailLabel } from "./labels";
import { route } from "./route";

const jobs = [
  {
    number: "24-118",
    name: "SR-99 / Airport Way Interchange",
    shortName: "SR-99 Interchange",
  },
  {
    number: "25-031",
    name: "Cedar Creek Bridge Replacement",
    shortName: "Cedar Creek Bridge",
  },
  {
    number: "24-077",
    name: "I-5 Culvert & Drainage Rehab",
    shortName: "I-5 Culverts",
  },
  {
    number: "26-010",
    name: "Harbor Side Abutment — Phase 1",
    shortName: "Harbor Abutment",
  },
];

const ROLES = ["executive", "pm", "superintendent", "foreman"] as const;

const PROMPTS = [
  "Plan today on 99-999",
  "Plan tomorrow on 99-999",
  "Plan today on 99-999 for Bridge Crew 2",
  "plan today on 99-999 for culvert crew a",
] as const;

describe("unknown-job plan prompts → create refusal (not show)", () => {
  it.each(PROMPTS)("%s → dailyPlan.create with job 99-999", (prompt) => {
    const intent = route(prompt, jobs);
    expect(intent?.action).toBe("dailyPlan.create");
    expect(intent?.args.job).toBe("99-999");
    expect(intent?.action).not.toBe("dailyPlan.show");
  });

  it.each(ROLES)(
    "role %s: create refusal chip is not the show failure chip",
    (_role) => {
      // Chip text is action-derived; role only gates writes, not the label.
      for (const prompt of PROMPTS) {
        const intent = route(prompt, jobs)!;
        expect(intent.action).toBe("dailyPlan.create");
        const chip = actionRailLabel(intent.action, intent.args.job, {
          refused: true,
        });
        expect(chip).toBe("Couldn't create plan on 99-999");
        expect(chip).not.toBe("Couldn't show crew plan on 99-999");
        expect(chip).not.toMatch(/show crew plan/i);
      }
    },
  );

  it("must-fail: known job without crew still shows (not create)", () => {
    expect(route("Plan tomorrow on 24-077", jobs)).toEqual({
      action: "dailyPlan.show",
      args: { job: "24-077" },
    });
  });
});

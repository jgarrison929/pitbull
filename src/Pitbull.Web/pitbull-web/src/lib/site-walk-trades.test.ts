import { describe, expect, it } from "vitest";
import {
  crewDisplayName,
  extractTradeInterests,
  filterCrewOnProject,
  rankSubsForLookAhead,
  scoreSubForTrades,
} from "./site-walk-trades";

describe("extractTradeInterests", () => {
  it("detects pour / form language from look-ahead tasks", () => {
    const keys = extractTradeInterests([
      "Place concrete east vault walls",
      "Screed and finish slab",
    ]);
    expect(keys).toContain("concrete_form");
  });

  it("does not invent electrical interest from a pour", () => {
    const keys = extractTradeInterests(["Pour foundation", "Form strip"]);
    expect(keys).not.toContain("mep_elec");
  });
});

describe("rankSubsForLookAhead", () => {
  const subs = [
    {
      id: "1",
      name: "Spark Electric",
      trade: "Electrical",
      status: "Active",
    },
    {
      id: "2",
      name: "ABC Concrete",
      trade: "Concrete",
      scope: "Form, place, finish",
      status: "Active",
    },
    {
      id: "3",
      name: "Form Pros",
      trade: "Formwork",
      status: "Active",
    },
  ];

  it("ranks concrete/form crews above electrical for a pour look-ahead", () => {
    const ranked = rankSubsForLookAhead(subs, [
      "Pour water vault walls",
      "Rebar inspection",
    ]);
    expect(ranked[0]?.name).not.toBe("Spark Electric");
    expect(ranked.map((s) => s.name).slice(0, 2)).toEqual(
      expect.arrayContaining(["ABC Concrete", "Form Pros"])
    );
    expect(ranked.find((s) => s.name === "ABC Concrete")!.relevanceScore).toBeGreaterThan(
      ranked.find((s) => s.name === "Spark Electric")!.relevanceScore
    );
  });
});

describe("scoreSubForTrades", () => {
  it("scores zero when no interests (honest — no fake relevance)", () => {
    expect(
      scoreSubForTrades(
        { id: "1", name: "Anyone", trade: "Electrical", status: "Active" },
        []
      )
    ).toBe(0);
  });
});

describe("filterCrewOnProject", () => {
  it("keeps only members assigned to the active project", () => {
    const crew = [
      {
        fullName: "Sam Forman",
        assignedProjects: [{ projectId: "p1", isActive: true }],
      },
      {
        fullName: "Other Job",
        assignedProjects: [{ projectId: "p2", isActive: true }],
      },
    ];
    expect(filterCrewOnProject(crew, "p1").map((c) => c.fullName)).toEqual([
      "Sam Forman",
    ]);
  });
});

describe("crewDisplayName", () => {
  it("prefers fullName", () => {
    expect(crewDisplayName({ fullName: "A B", firstName: "X" })).toBe("A B");
  });
});

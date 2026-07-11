import { describe, expect, it } from "vitest";
import {
  applyEntitySelectionToFormState,
  filterAndRankEntities,
  getValidRecentIds,
  normalizeLookupQuery,
  selectEntity,
  type EntityOption,
} from "./entity-lookup";

const PROJECTS: EntityOption[] = [
  { id: "p-alpha", label: "P-100", sublabel: "Alpha Site", searchText: "alpha" },
  { id: "p-beta", label: "P-200", sublabel: "Beta Tower", searchText: "beta tower" },
  { id: "p-gamma", label: "P-300", sublabel: "Gamma Plaza", searchText: "gamma" },
];

const COST_CODES: EntityOption[] = [
  { id: "cc-1", label: "03-100", sublabel: "Concrete", searchText: "03 100" },
  { id: "cc-2", label: "05-200", sublabel: "Steel", searchText: "metals" },
  { id: "cc-3", label: "09-900", sublabel: "Paint", searchText: "finishes" },
];

describe("normalizeLookupQuery", () => {
  it("trims and lowercases", () => {
    expect(normalizeLookupQuery("  Beta  ")).toBe("beta");
  });
});

describe("filterAndRankEntities", () => {
  it("matches label, sublabel, and searchText", () => {
    expect(filterAndRankEntities(PROJECTS, "tower").map((p) => p.id)).toEqual([
      "p-beta",
    ]);
    expect(filterAndRankEntities(PROJECTS, "p-100").map((p) => p.id)).toEqual([
      "p-alpha",
    ]);
    expect(filterAndRankEntities(COST_CODES, "metals").map((c) => c.id)).toEqual([
      "cc-2",
    ]);
  });

  it("ranks recent ids first when query is empty", () => {
    const ranked = filterAndRankEntities(PROJECTS, "", ["p-gamma", "p-alpha"]);
    expect(ranked.map((p) => p.id)).toEqual(["p-gamma", "p-alpha", "p-beta"]);
  });

  it("keeps recent order among matches", () => {
    const ranked = filterAndRankEntities(
      PROJECTS,
      "p-",
      ["p-beta", "p-gamma"]
    );
    expect(ranked[0]?.id).toBe("p-beta");
    expect(ranked[1]?.id).toBe("p-gamma");
  });

  it("returns empty list when nothing matches", () => {
    expect(filterAndRankEntities(PROJECTS, "zzzz-nope")).toEqual([]);
  });
});

describe("selectEntity", () => {
  it("returns id-bound selection used on submit", () => {
    const selection = selectEntity(PROJECTS, "p-beta");
    expect(selection).toEqual({
      id: "p-beta",
      label: "P-200",
      sublabel: "Beta Tower",
    });
  });

  it("returns null for unknown or empty id (not free-text invent)", () => {
    expect(selectEntity(PROJECTS, "")).toBeNull();
    expect(selectEntity(PROJECTS, "not-in-list")).toBeNull();
  });
});

describe("applyEntitySelectionToFormState", () => {
  it("updates form entityId + label from catalog pick", () => {
    const next = applyEntitySelectionToFormState(
      { entityId: "", entityLabel: "" },
      COST_CODES,
      "cc-1"
    );
    expect(next.entityId).toBe("cc-1");
    expect(next.entityLabel).toContain("03-100");
    expect(next.entityLabel).toContain("Concrete");
  });

  it("clears form when selection cannot be resolved", () => {
    const next = applyEntitySelectionToFormState(
      { entityId: "cc-1", entityLabel: "stale" },
      COST_CODES,
      "missing"
    );
    expect(next).toEqual({ entityId: "", entityLabel: "" });
  });
});

describe("getValidRecentIds", () => {
  it("drops stale recents not in catalog", () => {
    const valid = getValidRecentIds(
      [{ id: "p-alpha" }, { id: "gone" }, { id: "p-beta" }],
      PROJECTS.map((p) => p.id)
    );
    expect(valid).toEqual(["p-alpha", "p-beta"]);
  });
});

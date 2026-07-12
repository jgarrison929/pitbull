import { describe, expect, it } from "vitest";
import {
  defaultStoreyFilter,
  isStoreyNode,
  zonesForStorey,
  type TwinNodeLike,
} from "./twin-storey-lazy";

const nodes: TwinNodeLike[] = [
  { id: "s1", parentNodeId: "b", nodeType: "Storey", code: "L1", name: "L1" },
  { id: "s2", parentNodeId: "b", nodeType: "Storey", code: "L2", name: "L2" },
  { id: "z1", parentNodeId: "s1", nodeType: "Zone", code: "A", name: "A" },
  { id: "z2", parentNodeId: "s1", nodeType: "Zone", code: "B", name: "B" },
  { id: "z3", parentNodeId: "s2", nodeType: "Zone", code: "C", name: "C" },
];

describe("twin-storey-lazy (2.17.4)", () => {
  it("detects storey nodes", () => {
    expect(isStoreyNode(nodes[0]!)).toBe(true);
    expect(isStoreyNode(nodes[2]!)).toBe(false);
  });

  it("filters zones under selected storey", () => {
    expect(zonesForStorey(nodes, "s1").map((z) => z.id)).toEqual(["z1", "z2"]);
    expect(zonesForStorey(nodes, "s2").map((z) => z.id)).toEqual(["z3"]);
    expect(zonesForStorey(nodes, "__all__")).toHaveLength(3);
  });

  it("defaults to first storey for lazy initial load", () => {
    expect(defaultStoreyFilter(nodes)).toBe("s1");
    expect(defaultStoreyFilter([])).toBe("__all__");
  });
});

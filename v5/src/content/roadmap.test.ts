import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { changelog } from "./changelog";
import {
  ROADMAP_BANNED,
  next,
  roadmapPageText,
  shipped,
} from "./roadmap";

const docsRoadmap = readFileSync(
  new URL("../../../docs/roadmap.md", import.meta.url),
  "utf8",
);

describe("roadmap content", () => {
  it("keeps every version and module name in docs/roadmap.md", () => {
    for (const r of shipped) {
      expect(docsRoadmap, `shipped version ${r.version}`).toContain(r.version);
      expect(docsRoadmap, `shipped name ${r.name}`).toContain(r.name);
    }
    for (const r of next) {
      expect(docsRoadmap, `next version ${r.version}`).toContain(r.version);
      expect(docsRoadmap, `next name ${r.name}`).toContain(r.name);
    }
  });

  it("gives every shipped version a changelog entry", () => {
    const versions = new Set(changelog.map((e) => e.version));
    for (const r of shipped) {
      expect(versions.has(r.version), `changelog missing ${r.version}`).toBe(
        true,
      );
    }
  });

  it("lists 5.0.3 as shipped and not under Next", () => {
    expect(shipped.map((r) => r.version)).toContain("5.0.3");
    expect(next.map((r) => r.version)).not.toContain("5.0.3");
    expect(next[0]?.version).toBe("5.0.4");
  });

  it("uses Next wording with no banned strings", () => {
    const text = roadmapPageText();
    expect(text).toMatch(/\bNext\b/);
    for (const ban of ROADMAP_BANNED) {
      expect(text, `banned ${ban}`).not.toMatch(ban);
    }
  });

  it("lists Next in release order with no dates", () => {
    expect(next.map((r) => r.version)).toEqual([
      "5.0.4",
      "5.0.5",
      "5.1",
      "5.2",
      "5.3",
      "5.4",
      "5.5",
      "5.6+",
    ]);
    for (const r of next) {
      expect(r).not.toHaveProperty("date");
      expect(JSON.stringify(r)).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    }
  });

  it("lists shipped newest first", () => {
    expect(shipped.map((r) => r.version)).toEqual(["5.0.3", "5.0.2", "5.0.1", "5.0.0"]);
  });
});

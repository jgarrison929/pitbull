import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { WRITES } from "@/server/assistant/actions";

const SRC = path.join(process.cwd(), "src");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules") continue;
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.tsx?$/.test(name) && !name.endsWith(".test.ts")) out.push(p);
  }
  return out;
}

/** import clauses, comments stripped. `import type` and `{ type X }` are not value imports. */
function valueImports(source: string, spec: string): string[] {
  const text = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const found: string[] = [];
  for (const m of text.matchAll(/import\s+([\s\S]*?)\s+from\s+["']([^"']+)["']/g)) {
    if (m[2] !== spec) continue;
    const body = m[1].trim();
    if (body.startsWith("type ") || body.startsWith("type{")) continue;
    if (body.startsWith("{")) {
      const inner = body.slice(1, body.lastIndexOf("}"));
      const names = inner
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .filter((s) => !s.startsWith("type "));
      if (names.length) found.push(names.join(", "));
      continue;
    }
    found.push(body);
  }
  return found;
}

function namedImports(source: string, spec: string): string[] {
  const text = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const names: string[] = [];
  for (const m of text.matchAll(/import\s+([\s\S]*?)\s+from\s+["']([^"']+)["']/g)) {
    if (m[2] !== spec) continue;
    const body = m[1].trim().replace(/^type\s+/, "");
    if (!body.startsWith("{")) {
      names.push(body);
      continue;
    }
    for (const part of body.slice(1, body.lastIndexOf("}")).split(",")) {
      const cleaned = part.trim().replace(/^type\s+/, "");
      if (!cleaned) continue;
      names.push(cleaned.split(/\s+as\s+/)[0]!.trim());
    }
  }
  return names;
}

describe("change-order public surface", () => {
  it("app, components, and the assistant router do not value-import the pure module", () => {
    const roots = ["app", "components", "lib/assistant"].map((d) =>
      path.join(SRC, d),
    );
    const hits = roots.flatMap(walk).flatMap((file) =>
      valueImports(readFileSync(file, "utf8"), "@/lib/change-order").map(
        (clause) => `${path.relative(SRC, file)}: ${clause}`,
      ),
    );
    expect(hits).toEqual([]);
  });

  it("actions.ts imports only the two domain functions", () => {
    const source = readFileSync(
      path.join(SRC, "server/assistant/actions.ts"),
      "utf8",
    );
    const names = namedImports(source, "@/server/change-orders").sort();
    expect(names).toEqual(["changeOrderCommand", "listChangeOrders"]);
  });

  it("job change history includes every change-order write and not the read", () => {
    for (const name of ["create", "price", "approve", "reject", "void"] as const)
      expect(WRITES).toContain(`changeOrder.${name}`);
    expect(WRITES).not.toContain("changeOrder.show");
    expect(WRITES).toContain("estimate.approve");
    expect(WRITES).not.toContain("portfolio.summary");
  });
});

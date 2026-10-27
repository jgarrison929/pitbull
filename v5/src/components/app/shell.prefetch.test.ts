import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("AppShell chrome links", () => {
  const src = readFileSync(
    fileURLToPath(new URL("./shell.tsx", import.meta.url)),
    "utf8",
  );

  it("does not import next/link for Brand / Switch-role (plain <a>)", () => {
    expect(src).not.toMatch(/from ["']next\/link["']/);
    expect(src).toMatch(/aria-label="Pitbull home"/);
    expect(src).toMatch(/Switch role/);
  });

  it("shell nav still lists Status and Changelog (plain NavLink destinations)", () => {
    // Crawl aborts were /app?_rsc= from docs pages; shell must keep these
    // routes as NavLink (already plain <a>) without reintroducing next/link.
    expect(src).toMatch(/href: "\/status"/);
    expect(src).toMatch(/href: "\/changelog"/);
  });
});

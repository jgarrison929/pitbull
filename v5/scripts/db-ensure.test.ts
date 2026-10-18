import { describe, expect, it } from "vitest";
import { splitDatabaseUrl } from "./db-ensure.mjs";

describe("splitDatabaseUrl", () => {
  it("targets the maintenance database and keeps credentials and host", () => {
    expect(splitDatabaseUrl("postgresql://u:p%40ss@db.internal:5432/pcs_v5?sslmode=disable")).toEqual({
      name: "pcs_v5",
      adminUrl: "postgresql://u:p%40ss@db.internal:5432/postgres?sslmode=disable",
    });
  });

  it("rejects a URL without a database name", () => {
    expect(() => splitDatabaseUrl("postgresql://u:p@db:5432/")).toThrow("no database name");
  });
});

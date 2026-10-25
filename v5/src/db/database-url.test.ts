import { describe, expect, it } from "vitest";
import { classifyDatabaseUrl } from "@/db";

describe("classifyDatabaseUrl", () => {
  it("flags private Railway DNS", () => {
    const c = classifyDatabaseUrl(
      "postgres://u:p@postgres.railway.internal:5432/railway",
    );
    expect(c.privateRailway).toBe(true);
    expect(c.publicProxy).toBe(false);
    expect(c.host).toBe("postgres.railway.internal");
  });

  it("flags the public TCP proxy host", () => {
    const c = classifyDatabaseUrl(
      "postgres://u:p@switchyard.proxy.rlwy.net:12345/railway",
    );
    expect(c.publicProxy).toBe(true);
    expect(c.privateRailway).toBe(false);
  });

  it("must-fail: public proxy must not be classified as private", () => {
    const c = classifyDatabaseUrl(
      "postgres://u:p@crossover.proxy.rlwy.net:5432/railway",
    );
    expect(c.privateRailway).toBe(false);
    expect(c.publicProxy).toBe(true);
  });

  it("must-fail: proxy.rlwy.net appearing mid-hostname is not public", () => {
    // Substring includes() would false-positive; hostname suffix must not.
    const c = classifyDatabaseUrl(
      "postgres://u:p@proxy.rlwy.net.evil.example:5432/railway",
    );
    expect(c.host).toBe("proxy.rlwy.net.evil.example");
    expect(c.publicProxy).toBe(false);
    expect(c.privateRailway).toBe(false);
  });
});

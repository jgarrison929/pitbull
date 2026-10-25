import { describe, expect, it } from "vitest";
import {
  classifyDatabaseUrl,
  containsUserinfoLeak,
  databaseUrlHost,
  parsePostgresUrl,
} from "@/db";

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
    const c = classifyDatabaseUrl(
      "postgres://u:p@proxy.rlwy.net.evil.example:5432/railway",
    );
    expect(c.host).toBe("proxy.rlwy.net.evil.example");
    expect(c.publicProxy).toBe(false);
    expect(c.privateRailway).toBe(false);
  });
});

describe("databaseUrlHost (single WHATWG parser, encoded userinfo)", () => {
  it("reads hostname from a normal URL", () => {
    expect(
      databaseUrlHost("postgres://u:p@postgres.railway.internal:5432/railway"),
    ).toBe("postgres.railway.internal");
  });

  it("must-fail: user:5432/x@ must not return the username as host", () => {
    expect(
      databaseUrlHost("postgres://user:5432/x@hostname.example:5432/db"),
    ).toBe("hostname.example");
    expect(
      databaseUrlHost("postgres://user:5432/x@hostname.example:5432/db"),
    ).not.toBe("user");
  });

  it("must-fail: user:/x@ and user:99?x@", () => {
    expect(databaseUrlHost("postgres://user:/x@hostname.example:5432/db")).toBe(
      "hostname.example",
    );
    expect(
      databaseUrlHost("postgres://user:99?x@hostname.example:5432/db"),
    ).toBe("hostname.example");
    expect(
      databaseUrlHost("postgresql://user:99?x@hostname.example:5432/db"),
    ).toBe("hostname.example");
  });

  it("must-fail: usernames with / # ?", () => {
    expect(databaseUrlHost("postgres://us/er:x@hostname.example:5432/db")).toBe(
      "hostname.example",
    );
    expect(databaseUrlHost("postgres://us#er:pw@hostname.example:5432/db")).toBe(
      "hostname.example",
    );
    expect(databaseUrlHost("postgres://us?er:pw@hostname.example:5432/db")).toBe(
      "hostname.example",
    );
    expect(databaseUrlHost("postgres://us/er:x@hostname.example:5432/db")).not.toBe(
      "us",
    );
  });

  it("accepts unencoded / ? # @ in the password", () => {
    expect(
      databaseUrlHost("postgres://MyUser:pass/word@hostname.example:5432/db"),
    ).toBe("hostname.example");
    expect(
      databaseUrlHost("postgres://u:secr3t?x@hostname.example:5432/db"),
    ).toBe("hostname.example");
    expect(
      databaseUrlHost("postgres://u:secr3t#x@hostname.example:5432/db"),
    ).toBe("hostname.example");
    expect(
      databaseUrlHost("postgres://u:p@ss@word@hostname.example:5432/db"),
    ).toBe("hostname.example");
  });

  it("classifyDatabaseUrl keeps private/public flags with slash passwords", () => {
    const privateSlash = classifyDatabaseUrl(
      "postgres://u:ab/cd@postgres.railway.internal:5432/railway",
    );
    expect(privateSlash.host).toBe("postgres.railway.internal");
    expect(privateSlash.privateRailway).toBe(true);

    const publicSlash = classifyDatabaseUrl(
      "postgres://u:ab/cd@switchyard.proxy.rlwy.net:12345/railway",
    );
    expect(publicSlash.host).toBe("switchyard.proxy.rlwy.net");
    expect(publicSlash.publicProxy).toBe(true);
  });

  it("must-fail: never expose any credential part", () => {
    const secret = "s3cr3t/with/slashes";
    const url = `postgres://pcs:${secret}@127.0.0.1:5432/pcs_v5`;
    const host = databaseUrlHost(url);
    const classified = classifyDatabaseUrl(url);
    const parsed = parsePostgresUrl(url);
    expect(host).toBe("127.0.0.1");
    const dumped = JSON.stringify({ host, classified, parsedHost: parsed?.host });
    expect(dumped).not.toContain(secret);
    expect(dumped).not.toContain("pcs:");
    expect(dumped).not.toContain("s3cr3t");
    expect(containsUserinfoLeak(url, dumped)).toBe(false);
  });

  it("property: host never contains any userinfo substring (fuzz)", () => {
    const schemes = ["postgres://", "postgresql://", "POSTGRES://"] as const;
    const users = [
      "u",
      "admin",
      "MyUser",
      "us/er",
      "us#er",
      "us?er",
      "PvUser",
    ];
    const passes = [
      "p",
      "ab/cd",
      "5432/x",
      "/x",
      "99?x",
      "secr3t#x",
      "p@ss",
      "x:y/z",
      "",
    ];
    const hosts = [
      "hostname.example",
      "127.0.0.1",
      "postgres.railway.internal",
      "switchyard.proxy.rlwy.net",
      "[::1]",
    ];
    let cases = 0;
    for (const scheme of schemes) {
      for (const user of users) {
        for (const pass of passes) {
          for (const host of hosts) {
            const url = `${scheme}${user}:${pass}@${host}:5432/db`;
            const got = databaseUrlHost(url);
            cases += 1;
            expect(got, url).not.toBeNull();
            const bare = host.replace(/^\[|\]$/g, "").toLowerCase();
            expect(got, url).toBe(bare);
            // Must not be a userinfo fragment (username / first path piece)
            expect(got, url).not.toBe(user.toLowerCase().split(/[/#?]/)[0]);
            expect(got, url).not.toBe(user.toLowerCase());
            // Classified dump (what /health exposes) must not leak raw userinfo
            const dump = JSON.stringify(classifyDatabaseUrl(url));
            expect(containsUserinfoLeak(url, dump), url).toBe(false);
          }
        }
      }
    }
    expect(cases).toBeGreaterThan(500);
  });

  it("returns null for non-postgres / empty", () => {
    expect(databaseUrlHost("")).toBeNull();
    expect(databaseUrlHost("not-a-url")).toBeNull();
    expect(databaseUrlHost("http://u:p@h/db")).toBeNull();
  });
});

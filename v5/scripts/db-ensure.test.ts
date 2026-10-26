import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { containsUserinfoLeak } from "../src/db/database-url";
import { ensureDatabase, splitDatabaseUrl } from "./db-ensure.mjs";

const SPECIAL_PASSWORD = "Zq:/?#@%x";
const SPECIAL_URL = `postgres://pcs:${SPECIAL_PASSWORD}@127.0.0.1:5432/pcs_v5`;
/** Closed port — connection fails without echoing userinfo (no auth error). */
const SPECIAL_URL_CLOSED = `postgres://pcs:${SPECIAL_PASSWORD}@127.0.0.1:1/pcs_v5`;

describe("splitDatabaseUrl", () => {
  it("targets the maintenance database and keeps credentials and host", () => {
    expect(
      splitDatabaseUrl(
        "postgresql://u:p%40ss@db.internal:5432/pcs_v5?sslmode=disable",
      ),
    ).toEqual({
      name: "pcs_v5",
      adminUrl:
        "postgresql://u:p%40ss@db.internal:5432/postgres?sslmode=disable",
    });
  });

  it("rejects a URL without a database name", () => {
    expect(() => splitDatabaseUrl("postgresql://u:p@db:5432/")).toThrow(
      "no database name",
    );
  });

  it("parses passwords with / ? # @ % without ERR_INVALID_URL", () => {
    const { name, adminUrl } = splitDatabaseUrl(SPECIAL_URL);
    expect(name).toBe("pcs_v5");
    expect(adminUrl).toContain("@127.0.0.1:5432/postgres");
    expect(adminUrl).toMatch(/^postgres:\/\//);
    // Encoded form is safe for WHATWG / postgres.js
    expect(() => new URL(adminUrl)).not.toThrow();
    expect(adminUrl).not.toContain(SPECIAL_PASSWORD);
  });
});

describe("ensureDatabase special-char password security", () => {
  it("connects via encoded admin URL and never leaks the password", async () => {
    const connectCalls: string[] = [];
    const lines: string[] = [];
    const capture = (...args: unknown[]) => {
      lines.push(args.map(String).join(" "));
    };
    const log = console.log;
    const err = console.error;
    const warn = console.warn;
    const info = console.info;
    console.log = capture;
    console.error = capture;
    console.warn = capture;
    console.info = capture;

    try {
      const fakeSql = Object.assign(
        async () => [{ "?column?": 1 }],
        {
          end: async () => {},
        },
      );
      const connect = (url: string) => {
        connectCalls.push(url);
        // Reject raw slash-password URLs the way Node/postgres.js would.
        if (url.includes(SPECIAL_PASSWORD) || url.includes("Zq:/")) {
          const e = new TypeError("Invalid URL") as TypeError & {
            input?: string;
          };
          e.input = url;
          throw e;
        }
        return fakeSql;
      };

      const result = await ensureDatabase(SPECIAL_URL, connect as never);
      expect(result).toEqual({ name: "pcs_v5", created: false });
      expect(connectCalls).toHaveLength(1);
      expect(connectCalls[0]).toMatch(/^postgres:\/\/pcs:.*@127\.0\.0\.1:5432\/postgres$/);
      expect(connectCalls[0]).not.toContain(SPECIAL_PASSWORD);
    } finally {
      console.log = log;
      console.error = err;
      console.warn = warn;
      console.info = info;
    }

    const dumped = lines.join("\n");
    expect(dumped).not.toContain(SPECIAL_PASSWORD);
    expect(containsUserinfoLeak(SPECIAL_URL, dumped)).toBe(false);
  });

  it("CLI stdout/stderr never contain the special password", () => {
    const script = fileURLToPath(new URL("./db-ensure.mjs", import.meta.url));
    const proc = spawnSync(process.execPath, [script], {
      env: { ...process.env, DATABASE_URL: SPECIAL_URL_CLOSED },
      encoding: "utf8",
      timeout: 15_000,
    });
    const out = `${proc.stdout ?? ""}\n${proc.stderr ?? ""}`;
    expect(out).not.toContain(SPECIAL_PASSWORD);
    expect(containsUserinfoLeak(SPECIAL_URL_CLOSED, out)).toBe(false);
    // Must not dump Node's ERR_INVALID_URL `input` field with the raw URL.
    expect(out).not.toMatch(/input:\s*'postgres:\/\//);
    expect(out).not.toMatch(/ERR_INVALID_URL/);
    // Failure path must still be redacted (connect refused), not a raw throw.
    expect(proc.status).not.toBe(0);
    expect(out).toMatch(/db:ensure failed:/);
  });
});

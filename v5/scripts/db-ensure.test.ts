import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { containsUserinfoLeak } from "../src/db/database-url";
import {
  ensureDatabase,
  redactDbEnsureError,
  splitDatabaseUrl,
} from "./db-ensure.mjs";

const SPECIAL_PASSWORD = "Zq:/?#@%x";
/** Username is long enough for leak checks and must not appear in npm script noise (avoid `pcs`). */
const SPECIAL_USER = "dbensure_role";
const SPECIAL_URL = `postgres://${SPECIAL_USER}:${SPECIAL_PASSWORD}@127.0.0.1:5432/pcs_v5`;
/** Closed port — connection fails without echoing userinfo (no auth error). */
const SPECIAL_URL_CLOSED = `postgres://${SPECIAL_USER}:${SPECIAL_PASSWORD}@127.0.0.1:1/pcs_v5`;

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const v5Root = path.dirname(scriptsDir);
const nodeNoTypeWarn = [
  "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
] as const;

function spawnScript(scriptName: string, databaseUrl: string) {
  return spawnSync(
    process.execPath,
    [...nodeNoTypeWarn, path.join(scriptsDir, scriptName)],
    {
      env: { ...process.env, DATABASE_URL: databaseUrl },
      encoding: "utf8",
      timeout: 30_000,
      cwd: v5Root,
    },
  );
}

function assertNoPasswordLeak(out: string, url: string) {
  expect(out).not.toContain(SPECIAL_PASSWORD);
  expect(containsUserinfoLeak(url, out)).toBe(false);
  // Must not dump Node's ERR_INVALID_URL `input` field with the raw URL.
  expect(out).not.toMatch(/input:\s*'postgres:\/\//);
  expect(out).not.toMatch(/ERR_INVALID_URL/);
}

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

describe("redactDbEnsureError", () => {
  // R4 must-fail: a no-op redactor that returns the message unchanged must fail.
  // The CLI connect-refused path never puts the URL in err.message, so only a
  // direct unit call locks this helper.
  it("strips postgres URLs and userinfo from error messages", () => {
    const leak = `connect failed for postgres://${SPECIAL_USER}:${SPECIAL_PASSWORD}@127.0.0.1/pcs_v5 please retry`;
    const redacted = redactDbEnsureError(new Error(leak));
    expect(redacted).not.toContain(SPECIAL_PASSWORD);
    expect(redacted).not.toContain(`${SPECIAL_USER}:${SPECIAL_PASSWORD}`);
    expect(redacted).not.toContain(SPECIAL_USER);
    expect(containsUserinfoLeak(SPECIAL_URL, redacted)).toBe(false);
    expect(redacted).toContain("postgres://[redacted]");
    expect(redacted).toMatch(/connect failed for postgres:\/\/\[redacted\]/);
  });

  it("redacts postgresql:// scheme URLs too", () => {
    const leak = `bad postgresql://${SPECIAL_USER}:${SPECIAL_PASSWORD}@h/db detail`;
    const redacted = redactDbEnsureError(new Error(leak));
    expect(redacted).not.toContain(SPECIAL_PASSWORD);
    expect(redacted).not.toContain(SPECIAL_USER);
    expect(containsUserinfoLeak(
      `postgresql://${SPECIAL_USER}:${SPECIAL_PASSWORD}@h/db`,
      redacted,
    )).toBe(false);
    expect(redacted).toContain("postgres://[redacted]");
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
      expect(connectCalls[0]).toMatch(
        new RegExp(
          `^postgres://${SPECIAL_USER}:.*@127\\.0\\.0\\.1:5432/postgres$`,
        ),
      );
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
    const proc = spawnScript("db-ensure.mjs", SPECIAL_URL_CLOSED);
    const out = `${proc.stdout ?? ""}\n${proc.stderr ?? ""}`;
    assertNoPasswordLeak(out, SPECIAL_URL_CLOSED);
    // Failure path must still be redacted (connect refused), not a raw throw.
    expect(proc.status).not.toBe(0);
    expect(out).toMatch(/db:ensure failed:/);
  });
});

describe("db:migrate and db:prepare special-char password security", () => {
  it("db-migrate CLI stdout/stderr never contain the special password", () => {
    const proc = spawnScript("db-migrate.mjs", SPECIAL_URL_CLOSED);
    const out = `${proc.stdout ?? ""}\n${proc.stderr ?? ""}`;
    assertNoPasswordLeak(out, SPECIAL_URL_CLOSED);
    expect(proc.status).not.toBe(0);
    expect(out).toMatch(/db:migrate failed:/);
  });

  it("npm run db:prepare never prints the special password (ensure + migrate)", () => {
    // npm uses `db:ensure && db:migrate`, so a failing ensure skips migrate.
    // Run ensure then migrate sequentially with the same env so both halves of
    // db:prepare are exercised, then also run the npm script itself.
    const ensure = spawnScript("db-ensure.mjs", SPECIAL_URL_CLOSED);
    const migrate = spawnScript("db-migrate.mjs", SPECIAL_URL_CLOSED);
    const prepare = spawnSync("npm", ["run", "db:prepare"], {
      cwd: v5Root,
      env: { ...process.env, DATABASE_URL: SPECIAL_URL_CLOSED },
      encoding: "utf8",
      timeout: 60_000,
    });

    const combined = [
      ensure.stdout,
      ensure.stderr,
      migrate.stdout,
      migrate.stderr,
      prepare.stdout,
      prepare.stderr,
    ]
      .map((s) => s ?? "")
      .join("\n");

    assertNoPasswordLeak(combined, SPECIAL_URL_CLOSED);
    expect(ensure.status).not.toBe(0);
    expect(migrate.status).not.toBe(0);
    expect(prepare.status).not.toBe(0);
    expect(combined).toMatch(/db:ensure failed:/);
    expect(combined).toMatch(/db:migrate failed:/);
  });
});

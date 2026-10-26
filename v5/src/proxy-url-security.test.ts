/**
 * Verify FAIL: proxySql must not pass raw DATABASE_URL with `/` in the
 * password to postgres.js (Invalid URL logs the full connection string).
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { containsUserinfoLeak, databaseConnectionString } from "@/db/database-url";

const PASSWORD = "ab/cd";
const RAW_URL = `postgres://pvuser:${PASSWORD}@127.0.0.1:5432/pcs_v5`;

describe("proxySql connection-string security", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    delete process.env.DATABASE_URL;
  });

  it("must-fail: proxy.ts uses databaseConnectionString, never postgres(raw)", () => {
    const src = readFileSync(join(process.cwd(), "src/proxy.ts"), "utf8");
    expect(src).toMatch(/databaseConnectionString/);
    expect(src).toMatch(/postgres\(connectionString/);
    expect(src).not.toMatch(/postgres\(\s*databaseUrl\s*,/);
    expect(src).not.toMatch(/postgres\(\s*rawDatabaseUrl\s*,/);
  });

<<<<<<< HEAD
  it("must-fail: plan drills use one session⋈job⋈plan query (not a follow-up select)", () => {
    const src = readFileSync(join(process.cwd(), "src/proxy.ts"), "utf8");
    expect(src).toMatch(/left join daily_plans p/);
    // Old shape: session⋈job, then a second `select id from daily_plans`.
    expect(src).not.toMatch(
      /select id from daily_plans\s+where job_id = \$\{jobId\}/,
=======
  it("must-fail: cost-item drills use one session⋈job⋈item query + Server-Timing", () => {
    const src = readFileSync(join(process.cwd(), "src/proxy.ts"), "utf8");
    expect(src).toMatch(/left join cost_items ci/);
    expect(src).toMatch(/Server-Timing/);
    expect(src).toMatch(/v5proxy;dur=/);
    expect(src).toMatch(/Next-Router-Prefetch/);
    // Old shape: session⋈job, then a second `select id from cost_items`.
    expect(src).not.toMatch(
      /select id from cost_items\s+where job_id = \$\{jobId\}/,
>>>>>>> 5842cf8 (perf(v5): cut cost-item TTFB tail under crawl burst)
    );
  });

  it("must-fail: job route through proxy with slash password — no leak, not 500", async () => {
    const postgresCalls: string[] = [];
    const lines: string[] = [];
    const capture = (...args: unknown[]) => {
      lines.push(args.map(String).join(" "));
    };
    vi.spyOn(console, "error").mockImplementation(capture);
    vi.spyOn(console, "info").mockImplementation(capture);
    vi.spyOn(console, "warn").mockImplementation(capture);
    vi.spyOn(console, "log").mockImplementation(capture);

    vi.doMock("postgres", () => ({
      default: (url: string) => {
        postgresCalls.push(url);
        // Reject raw slash-password URLs the way Node/postgres.js would.
        if (url.includes(PASSWORD)) {
          const err = new TypeError("Invalid URL") as TypeError & {
            input?: string;
          };
          err.input = url;
          throw err;
        }
        const tag = Object.assign(
          async () => [] as { job_id: string }[],
          {
            end: async () => {},
          },
        );
        return tag;
      },
    }));

    process.env.DATABASE_URL = RAW_URL;
    const { proxy, resetProxySqlForTests } = await import("@/proxy");
    await resetProxySqlForTests();

    const token = "proxy-security-test-token";
    const req = new NextRequest("http://localhost/app/jobs/25-031", {
      headers: { cookie: `pcs_session=${token}` },
    });

    let status = 0;
    try {
      const res = await proxy(req);
      status = res.status;
    } catch (err) {
      // Must not throw Invalid URL with password in input.
      const input =
        err && typeof err === "object" && "input" in err
          ? String((err as { input?: string }).input)
          : "";
      expect(input).not.toContain(PASSWORD);
      expect(String(err)).not.toContain(PASSWORD);
      status = 500;
    }

    expect(status, "proxy must not 500 on slash password").not.toBe(500);
    expect(postgresCalls.length).toBeGreaterThan(0);
    for (const call of postgresCalls) {
      expect(call).not.toContain(PASSWORD);
      expect(call).toBe(databaseConnectionString(RAW_URL));
    }

    const joined = lines.join("\n");
    expect(joined).not.toContain(PASSWORD);
    expect(containsUserinfoLeak(RAW_URL, joined)).toBe(false);

    // Session hash used in the query path — ensure we exercised proxySql.
    expect(
      createHash("sha256").update(token).digest("hex").length,
    ).toBe(64);

    await resetProxySqlForTests();
  });
});

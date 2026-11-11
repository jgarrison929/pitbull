/**
 * SECURITY: DATABASE_URL passwords with / # ? @ must not 500 /health or leak
 * into logs. Degraded DB still returns HTTP 503 (Railway healthcheck).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  classifyDatabaseUrl,
  containsUserinfoLeak,
  databaseConnectionString,
  databaseUrlHost,
} from "@/db";
import { resetDbClient } from "@/db/test-hooks";

vi.mock("next/server", () => ({
  connection: async () => {},
}));

const SPECIAL_PASSWORDS = ["ab/cd", "secr#et", "p?ass", "p@ss/word"] as const;

describe("/health URL security (special-char passwords)", () => {
  const originalUrl = process.env.DATABASE_URL;

  beforeEach(async () => {
    await resetDbClient();
  });

  afterEach(async () => {
    process.env.DATABASE_URL = originalUrl;
    await resetDbClient();
    vi.restoreAllMocks();
  });

  it.each(SPECIAL_PASSWORDS)(
    "must-fail: password %s → host only, connection string encodes, no leak",
    (password) => {
      const url = `postgres://PvUser:${password}@127.0.0.1:5432/pcs_v5`;
      const host = databaseUrlHost(url);
      const classified = classifyDatabaseUrl(url);
      const conn = databaseConnectionString(url);

      expect(host).toBe("127.0.0.1");
      expect(classified.host).toBe("127.0.0.1");
      expect(host).not.toBe("pvuser");
      expect(conn).not.toBeNull();
      expect(conn).not.toContain(password);
      expect(() =>
        new URL(conn!.replace(/^postgres(ql)?/i, "http")),
      ).not.toThrow();

      const publicDump = JSON.stringify({ host, classified });
      expect(containsUserinfoLeak(url, publicDump)).toBe(false);
      expect(publicDump).not.toContain(password);
    },
  );

  it("must-fail: raw postgres(url) with slash password is unsafe; encoded is constructible", async () => {
    const postgres = (await import("postgres")).default;
    const raw = "postgres://PvUser:ab/cd@127.0.0.1:5432/pcs_v5";
    const encoded = databaseConnectionString(raw)!;

    let rawThrew = false;
    try {
      postgres(raw, { max: 1 });
    } catch {
      rawThrew = true;
    }
    expect(rawThrew || encoded.includes("%2F")).toBe(true);

    const client = postgres(encoded, { max: 1, connect_timeout: 1 });
    expect(client).toBeTruthy();
    await client.end({ timeout: 1 }).catch(() => {});
  });

  it("must-fail: special-char password → not 500, no leak (503 when DB rejects)", async () => {
    const lines: string[] = [];
    const capture = (...args: unknown[]) => {
      lines.push(args.map(String).join(" "));
    };
    vi.spyOn(console, "error").mockImplementation(capture);
    vi.spyOn(console, "info").mockImplementation(capture);
    vi.spyOn(console, "warn").mockImplementation(capture);
    vi.spyOn(console, "log").mockImplementation(capture);

    const { GET } = await import("@/app/health/route");

    for (const password of SPECIAL_PASSWORDS) {
      // Wrong role/password on local Postgres → degraded 503, never 500/leak.
      const url = `postgres://PvUser:${password}@127.0.0.1:5432/pcs_v5`;
      process.env.DATABASE_URL = url;
      await resetDbClient();
      lines.length = 0;

      const res = await GET();
      expect(res.status, password).not.toBe(500);
      expect([200, 503], password).toContain(res.status);
      const body = (await res.json()) as {
        status?: string;
        db?: string;
        dbNetwork?: { host?: string | null };
      };
      expect(body.dbNetwork?.host, password).toBe("127.0.0.1");
      expect(body.dbNetwork?.host, password).not.toBe("pvuser");
      if (res.status === 503) {
        expect(body.status).toBe("degraded");
        expect(body.db).toBe("error");
      }

      const joined = lines.join("\n");
      expect(joined, password).not.toContain(password);
      expect(containsUserinfoLeak(url, joined), password).toBe(false);
      expect(JSON.stringify(body), password).not.toContain(password);
    }
  });

  it("must-fail: unparseable but set DATABASE_URL is degraded/error (not ok/not-configured)", async () => {
    process.env.DATABASE_URL = "postgres://pvuser:ab/cd@";
    await resetDbClient();
    const { GET } = await import("@/app/health/route");
    const res = await GET();
    expect(res.status).toBe(503);
    const body = (await res.json()) as { status?: string; db?: string };
    expect(body.status).toBe("degraded");
    expect(body.db).toBe("error");
    expect(body.db).not.toBe("not-configured");
    expect(body.status).not.toBe("ok");
  });

  it("must-fail: reachable DB still reports 200 when ping succeeds", async () => {
    if (!originalUrl) return;
    process.env.DATABASE_URL = originalUrl;
    await resetDbClient();
    const { GET } = await import("@/app/health/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status?: string; db?: string };
    expect(body.status).toBe("ok");
    expect(body.db).toBe("ok");
  });
});

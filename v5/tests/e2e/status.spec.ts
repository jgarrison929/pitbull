import { expect, test } from "@playwright/test";
import pkg from "../../package.json";

test("status page shows version, commit, ci-gate, last-verify and health", async ({
  page,
}) => {
  await page.goto("/status");
  const main = page.locator("main");
  await expect(main.getByRole("heading", { name: "Status" })).toBeVisible();
  await expect(main.getByTestId("page-purpose")).toHaveCount(1);
  await expect(main.getByTestId("page-purpose")).toContainText(
    /which build is live/i,
  );
  await expect(page.getByTestId("status-version")).toHaveText(pkg.version);
  await expect(page.getByTestId("status-version")).not.toHaveText("0.0.0");
  await expect(page.getByTestId("status-commit")).toHaveText(
    process.env.EXPECT_COMMIT ?? /.+/,
  );
  if (process.env.EXPECT_COMMIT) {
    await expect(page.getByTestId("status-commit")).toHaveText(
      /^[0-9a-f]{40}$/i,
    );
  }
  await expect(page.getByTestId("status-ci-gate")).toHaveText(
    /^(pass|fail|pending|unknown)( \(stale( \d+s)?\))?$/,
  );
  // Playwright webServer sets LAST_VERIFY_AT + LAST_VERIFY_COMMIT (full SHA).
  await expect(page.getByTestId("status-last-verify")).toHaveText(
    /\d{4}-\d{2}-\d{2}T.+ · [0-9a-f]{40}/i,
  );
  await expect(page.getByTestId("health-status")).toHaveText("Operational");
  await expect(page.getByTestId("status-database")).toHaveText(
    process.env.DATABASE_URL ? "ok" : "not-configured",
  );
  if (process.env.DATABASE_URL) {
    await expect(page.getByTestId("status-migrations")).toContainText(
      "0000_init",
    );
    await expect(page.getByTestId("status-migrations")).toContainText(
      "0012_drop_average_performance",
    );
    await expect(page.getByTestId("status-migrations")).toContainText(
      "0017_average_performance",
    );
  } else {
    await expect(page.getByTestId("status-migrations")).toHaveText(
      "not-configured",
    );
  }
});

test("health route reports deploy status shape", async ({ request }) => {
  const res = await request.get("/health");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.status).toBe("ok");
  expect(body.version).toBe(pkg.version);
  expect(body.version).not.toBe("0.0.0");
  expect(typeof body.commit).toBe("string");
  expect(body.commit.length).toBeGreaterThan(0);
  if (process.env.EXPECT_COMMIT) {
    expect(body.commit).toMatch(/^[0-9a-f]{40}$/i);
    expect(body.commit).toBe(process.env.EXPECT_COMMIT);
  }
  expect(["pass", "fail", "pending", "unknown"]).toContain(body.ciGate);
  expect(typeof body.ciGateStale).toBe("boolean");
  expect(
    body.ciGateAgeMs === null || typeof body.ciGateAgeMs === "number",
  ).toBe(true);
  expect(
    body.lastVerifyAt === null || typeof body.lastVerifyAt === "string",
  ).toBe(true);
  expect(
    body.lastVerifyCommit === null ||
      typeof body.lastVerifyCommit === "string",
  ).toBe(true);
  if (typeof body.lastVerifyCommit === "string") {
    expect(body.lastVerifyCommit).toMatch(/^[0-9a-f]{40}$/i);
  }
  expect(typeof body.buildTime).toBe("string");
  expect(["ok", "error", "not-configured"]).toContain(body.db);
  if (process.env.DATABASE_URL) {
    expect(Array.isArray(body.migrations)).toBe(true);
    expect(body.migrations).not.toBe("unavailable");
    expect(body.migrations).toContain("0000_init");
    expect(body.migrations).toContain("0012_drop_average_performance");
    expect(body.migrations).toContain("0017_average_performance");
  } else {
    expect(body.migrations).toBeNull();
  }
});

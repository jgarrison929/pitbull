import { expect, test } from "@playwright/test";
import pkg from "../../package.json";

test("status page shows version, commit, ci-gate, last-verify and health", async ({
  page,
}) => {
  await page.goto("/status");
  await expect(page.getByText("Pitbull status")).toBeVisible();
  await expect(page.getByTestId("status-version")).toHaveText(pkg.version);
  await expect(page.getByTestId("status-version")).not.toHaveText("0.0.0");
  await expect(page.getByTestId("status-commit")).toHaveText(
    process.env.EXPECT_COMMIT ?? /.+/,
  );
  await expect(page.getByTestId("status-ci-gate")).toHaveText(
    /^(pass|fail|pending|unknown)( \(stale( \d+s)?\))?$/,
  );
  await expect(page.getByTestId("status-last-verify")).toHaveText(/.+/);
  await expect(page.getByTestId("health-status")).toHaveText("Operational");
  await expect(page.getByTestId("status-database")).toHaveText(
    process.env.DATABASE_URL ? "ok" : "not-configured",
  );
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
  expect(["pass", "fail", "pending", "unknown"]).toContain(body.ciGate);
  expect(typeof body.ciGateStale).toBe("boolean");
  expect(
    body.ciGateAgeMs === null || typeof body.ciGateAgeMs === "number",
  ).toBe(true);
  expect(
    body.lastVerifyAt === null || typeof body.lastVerifyAt === "string",
  ).toBe(true);
  expect(typeof body.buildTime).toBe("string");
  expect(["ok", "error", "not-configured"]).toContain(body.db);
});

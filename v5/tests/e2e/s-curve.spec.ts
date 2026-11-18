import { expect, test, type Page } from "@playwright/test";
import { THEME_COOKIE } from "@/lib/theme";

async function signIn(page: Page, role: string) {
  await page.goto("/login");
  await page.getByTestId(`role-${role}`).click();
  await expect(page).toHaveURL(/\/app$/);
}

async function seedDarkTheme(page: Page, baseURL: string | undefined) {
  await page.context().addCookies([
    {
      name: THEME_COOKIE,
      value: "dark",
      url: baseURL ?? "http://localhost:3100",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

async function cents(page: Page, testId: string) {
  return Number(
    await page.getByTestId(testId).locator("[data-cents]").first().getAttribute(
      "data-cents",
    ),
  );
}

async function curvePoint(page: Page, on: string) {
  const el = page.locator(
    `[data-testid="curve-point"][data-on="${on}"]`,
  );
  await expect(el).toHaveCount(1);
  return {
    planned: Number(await el.getAttribute("data-planned-cents")),
    earned: Number(await el.getAttribute("data-earned-cents")),
    actual: Number(await el.getAttribute("data-actual-cents")),
  };
}

/**
 * Verify probe: path[data-series="earnedCents"] must be a real polyline.
 * A lone M (one command) yields a 0×0 bbox — EV listed in the legend but
 * invisible. Unit/SQL coverage alone does not catch a broken stepPath.
 */
async function expectEarnedPathDrawn(
  page: Page,
  chartTestId: string = "s-curve",
) {
  const path = page.locator(
    `[data-testid="${chartTestId}"] path[data-series="earnedCents"]`,
  );
  await expect(path, "EV path present").toHaveCount(1);
  const d = (await path.getAttribute("d")) ?? "";
  expect(d.length, "EV path d empty").toBeGreaterThan(0);
  const commands = d.match(/[MmLlHhVvCcSsQqTtAaZz]/g) ?? [];
  expect(
    commands.length,
    `EV path must not be a lone M (d=${JSON.stringify(d)})`,
  ).toBeGreaterThan(1);
  const box = await path.boundingBox();
  expect(box, "EV path bbox").toBeTruthy();
  expect(
    (box!.width > 0 ? 1 : 0) + (box!.height > 0 ? 1 : 0),
    `EV path bbox collapsed (${box!.width}×${box!.height}); d=${JSON.stringify(d)}`,
  ).toBeGreaterThan(0);
}

/**
 * Verify probe12b: every svg `<text>` bbox must sit inside the svg viewport.
 * Sub-pixel slack only — clipped `$` / trailing date digits must go RED.
 */
async function expectTicksInsideSvg(
  page: Page,
  chartTestId: string = "s-curve",
) {
  const svg = page.locator(
    `[data-testid="${chartTestId}"] [data-testid="s-curve-svg"]`,
  );
  await expect(svg).toBeVisible();
  const clipped = await svg.evaluate((el) => {
    const svgRect = el.getBoundingClientRect();
    const slack = 0.75; // sub-pixel antialias only
    const out: string[] = [];
    for (const t of el.querySelectorAll("text")) {
      const r = t.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) {
        out.push(`${t.textContent ?? ""}: empty bbox`);
        continue;
      }
      if (
        r.left < svgRect.left - slack ||
        r.top < svgRect.top - slack ||
        r.right > svgRect.right + slack ||
        r.bottom > svgRect.bottom + slack
      ) {
        out.push(
          `${JSON.stringify(t.textContent)} ` +
            `text=[${r.left.toFixed(1)},${r.top.toFixed(1)}–${r.right.toFixed(1)},${r.bottom.toFixed(1)}] ` +
            `svg=[${svgRect.left.toFixed(1)},${svgRect.top.toFixed(1)}–${svgRect.right.toFixed(1)},${svgRect.bottom.toFixed(1)}]`,
        );
      }
    }
    return out;
  });
  expect(clipped, `clipped tick labels on ${chartTestId}`).toEqual([]);
}

test("check 1+2: job S-curve last PV = budget; cutoff matches tiles on 25-031", async ({
  page,
}) => {
  await signIn(page, "pm");
  await page.goto("/app/jobs/25-031");
  const section = page.getByTestId("s-curve-section");
  await expect(section).toBeVisible();
  const chart = page.getByTestId("s-curve");
  await expect(chart).toBeVisible();

  const budget = await cents(page, "job-budget");
  const lastPlanned = Number(
    await chart.getAttribute("data-last-planned-cents"),
  );
  expect(lastPlanned).toBe(budget);

  const cutoff = await chart.getAttribute("data-cutoff");
  expect(cutoff).toBeTruthy();
  const at = await curvePoint(page, cutoff!);
  expect(at.planned).toBe(await cents(page, "job-planned"));
  expect(at.earned).toBe(await cents(page, "job-earned"));
  expect(at.actual).toBe(await cents(page, "job-actual"));
  await expectEarnedPathDrawn(page, "s-curve");
  await expectTicksInsideSvg(page, "s-curve");
});

test("check 2: cutoff matches tiles on 24-118 and 24-077", async ({ page }) => {
  await signIn(page, "pm");
  for (const number of ["24-118", "24-077"] as const) {
    await page.goto(`/app/jobs/${number}`);
    const chart = page.getByTestId("s-curve");
    await expect(chart).toBeVisible();
    const cutoff = await chart.getAttribute("data-cutoff");
    expect(cutoff, number).toBeTruthy();
    const at = await curvePoint(page, cutoff!);
    expect(at.planned, number).toBe(await cents(page, "job-planned"));
    expect(at.earned, number).toBe(await cents(page, "job-earned"));
    expect(at.actual, number).toBe(await cents(page, "job-actual"));
    await expectEarnedPathDrawn(page, "s-curve");
    await expectTicksInsideSvg(page, "s-curve");
  }
});

test("EV path draws on job S-curve (not a lone M / 0×0 bbox)", async ({
  page,
}) => {
  await signIn(page, "pm");
  await page.goto("/app/jobs/25-031");
  await expect(page.getByTestId("s-curve")).toBeVisible();
  await expectEarnedPathDrawn(page, "s-curve");
});

test("axis tick labels stay inside the svg viewport (light + dark, 1440→320)", async ({
  page,
  baseURL,
}) => {
  const widths = [1440, 1280, 768, 390, 320] as const;
  for (const theme of ["light", "dark"] as const) {
    await page.context().clearCookies();
    if (theme === "dark") await seedDarkTheme(page, baseURL);
    await signIn(page, "pm");
    if (theme === "dark") {
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    }
    for (const width of widths) {
      await page.setViewportSize({ width, height: width <= 390 ? 844 : 900 });
      await page.goto("/app/jobs/25-031");
      await expect(page.getByTestId("s-curve")).toBeVisible();
      await expectTicksInsideSvg(page, "s-curve");
    }
    await page.goto("/login");
    await page.getByTestId("role-executive").click();
    await expect(page).toHaveURL(/\/app$/);
    for (const width of widths) {
      await page.setViewportSize({ width, height: width <= 390 ? 844 : 900 });
      await page.goto("/app");
      await expect(page.getByTestId("portfolio-s-curve")).toBeVisible();
      await expectTicksInsideSvg(page, "portfolio-s-curve");
    }
  }
});

test("phone axis ticks are readable at 320 and 390", async ({ page }) => {
  await signIn(page, "pm");
  for (const width of [320, 390] as const) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/app/jobs/25-031");
    const tick = page.getByTestId("s-curve-tick-y").first();
    await expect(tick).toBeVisible();
    const box = await tick.boundingBox();
    expect(box, `${width}px tick bbox`).toBeTruthy();
    // Floor: TICK_FONT=24 in the 720 viewBox → ≥9px at 320/390.
    expect(box!.height, `${width}px tick height`).toBeGreaterThanOrEqual(9);
    expect(box!.width, `${width}px tick width`).toBeGreaterThan(0);
    await expectTicksInsideSvg(page, "s-curve");
  }
});

test("check 5: portfolio S-curve last PV = active budgets; cutoff = tiles", async ({
  page,
}) => {
  await signIn(page, "executive");
  await page.goto("/app");
  const chart = page.getByTestId("portfolio-s-curve");
  await expect(chart).toBeVisible();
  const cutoff = await chart.getAttribute("data-cutoff");
  expect(cutoff).toBeTruthy();
  const at = await curvePoint(page, cutoff!);
  expect(at.earned).toBe(await cents(page, "kpi-earned"));
  expect(at.planned).toBe(await cents(page, "kpi-planned"));
  await expectEarnedPathDrawn(page, "portfolio-s-curve");
  await expectTicksInsideSvg(page, "portfolio-s-curve");
});

test("check 6: draft 26-010 has no curve section and no empty chart", async ({
  page,
}) => {
  await signIn(page, "pm");
  await page.goto("/app/jobs/26-010");
  await expect(page.getByTestId("draft-label")).toBeVisible();
  await expect(page.getByTestId("s-curve-section")).toHaveCount(0);
  await expect(page.getByTestId("s-curve")).toHaveCount(0);
  await expect(page.getByTestId("curve-points")).toHaveCount(0);
  await expect(page.getByTestId("s-curve-svg")).toHaveCount(0);
});
